"use server";

import { revalidatePath } from "next/cache";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { reportServerError } from "@/lib/observability/report-error";
import { getCurrentUser } from "@/modules/auth/session";

import {
  findLivePendingDuplicate,
  findRecentCashSaleDuplicate,
  getProfessionalProfileIdByUser,
  getVentaVisible,
} from "./data/payments-repository";
import { leerLineas } from "./lineas-del-formulario";
import { canCreateCheckout } from "./policies/can-create-checkout";
import { canDeliverSale } from "./policies/can-deliver-sale";
import { canViewRevenue } from "./policies/can-view-revenue";
import { reintentarFacturasPendientes } from "./services/facturacion-service";
import { reintentarDescuentosPendientes } from "./services/inventario-venta-service";
import {
  anularLink,
  CheckoutError,
  createCheckout,
  entregarVenta,
  linksPendientesQueBloquean,
  registerCashSale,
  VentaError,
} from "./services/payments-service";
import {
  accionDeVentaSchema,
  createCheckoutSchema,
  registerCashSaleSchema,
  type AccionDeVentaState,
  type CashSaleFormState,
  type CreateCheckoutInput,
  type PaymentFormState,
  type RetryFormState,
} from "./validations";

// Autorizacion comun (regla 3): crear checkout = professional o admin.
async function requireCheckoutCreator() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesión.") };
  if (!canCreateCheckout(user)) {
    return { user: null, error: appError("forbidden", "No tienes permiso para crear checkouts.") };
  }
  return { user, error: null as null };
}

export async function createCheckoutAction(
  input: CreateCheckoutInput,
): Promise<Result<{ transactionId: string; checkoutUrl: string }, AppError>> {
  const { user, error: authzError } = await requireCheckoutCreator();
  if (authzError) return err(authzError);

  const parsed = createCheckoutSchema.safeParse(input);
  if (!parsed.success) return err(appError("validation", "Datos del checkout inválidos."));

  try {
    const created = await createCheckout(parsed.data, user);
    revalidatePath("/pagos");
    return ok(created);
  } catch (e) {
    if (e instanceof CheckoutError) return err(appError("validation", e.message));
    reportServerError("checkout.create", e);
    return err(appError("internal", "No se pudo crear el checkout."));
  }
}

// ----- Adaptador de formulario (useActionState) para la UI de B6.4 -----

export async function createCheckoutFormAction(
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const patientId = String(formData.get("patientId") ?? "");
  const lineas = leerLineas(formData);
  const confirmDuplicate = String(formData.get("confirmDuplicate") ?? "") === "true";
  const treatmentId = String(formData.get("treatmentId") ?? "") || undefined;
  const evaluationId = String(formData.get("evaluationId") ?? "");

  // Avisa antes de crear un cobro DUPLICADO vivo (mismo paciente + mismo producto, pending y < 24h): no
  // es solo la pantalla vieja, tambien el olvido con la pantalla al dia. No bloquea: el profesional puede
  // confirmar con "Generar de todos modos". Un pago de mas no tiene reembolso en el MVP (ver BACKLOG).
  //
  // AVISA POR LINEA, NO POR LA VENTA ENTERA, y la diferencia es la que importa: si el paciente ya tiene
  // pendiente un checkout con MULTI-CELL y ahora se le arma uno con MULTI-CELL y OMEGA, lo que se duplica
  // es el primero. Exigir que coincida la venta COMPLETA callaria ese caso, que es el habitual.
  //
  // No hizo falta construir nada:  ya recibia un arreglo y ya devolvia el
  // producto que colisiona por su nombre. Lo unico que mandaba un solo id era esta funcion.
  if (!confirmDuplicate && patientId && lineas.length > 0) {
    const dup = await findLivePendingDuplicate(patientId, lineas.map((l) => l.nutraceuticalId));
    if (dup) {
      const cuando = dup.hoursAgo <= 0 ? "hace menos de una hora" : `hace ${dup.hoursAgo} h`;
      return {
        error: null,
        success: null,
        checkoutUrl: null,
        duplicateWarning: `Este paciente ya tiene un cobro pendiente de ${dup.product}, generado ${cuando} y aún sin pagar. Si es a propósito, genera otro; si no, comparte el que ya existe.`,
      };
    }
  }

  const result = await createCheckoutAction({ patientId, items: lineas, treatmentId });
  if (!result.ok) {
    return { error: result.error.message, success: null, checkoutUrl: null, duplicateWarning: null };
  }
  // Desde Tratamiento, la seccion de la venta muestra el QR del link recien creado.
  if (evaluationId) revalidatePath(`/ani-bis-e/${evaluationId}`);
  return {
    error: null,
    success: "Checkout creado. Comparte el link con el paciente.",
    checkoutUrl: result.value.checkoutUrl,
    duplicateWarning: null,
  };
}

// ----- Venta en efectivo (useActionState) -----

// El integrante registra un cobro en efectivo (paciente + producto), que nace YA pagado. Reusa el guard
// del checkout (professional/admin) y el sellado contable (comision + ingreso de CNV sobre la base sin
// IVA). El idempotencyKey lo genera el cliente por intento: un doble-clic no cobra dos veces.
export async function registerCashSaleFormAction(
  _prev: CashSaleFormState,
  formData: FormData,
): Promise<CashSaleFormState> {
  const vacio = { error: null, success: null, duplicateWarning: null, pendingLinkWarning: null };
  const { user, error: authzError } = await requireCheckoutCreator();
  if (authzError) return { ...vacio, error: authzError.message };

  const patientId = String(formData.get("patientId") ?? "");
  const lineas = leerLineas(formData);
  const confirmDuplicate = String(formData.get("confirmDuplicate") ?? "") === "true";
  const anularLinks = String(formData.get("anularLinks") ?? "") === "true";

  const parsed = registerCashSaleSchema.safeParse({
    patientId,
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    items: lineas,
    treatmentId: String(formData.get("treatmentId") ?? "") || undefined,
  });
  if (!parsed.success) return { ...vacio, error: "Datos de la venta inválidos." };
  const { idempotencyKey, ...sale } = parsed.data;

  try {
    // ═══ UN LINK PENDIENTE CON EL MISMO PRODUCTO SE ANULA ANTES DE COBRAR EN EFECTIVO (decision (b)) ═══
    //
    // Va ANTES del aviso de duplicado en efectivo: es el caso de consulta (la tarjeta no paso y el paciente paga
    // en efectivo), y sin anularlo pasan dos cosas malas. El link retiene las unidades que esta venta
    // necesita, y la venta queda `sin_saldo` sin serlo; y si la pagina de Wompi sigue abierta, el paciente
    // puede pagar otra vez. No hay "cobrar sin anular": con el mismo producto, las dos cosas son el mismo cobro.
    if (!anularLinks) {
      const links = await linksPendientesQueBloquean(sale);
      if (links.length > 0) {
        const detalle = links
          .map((l) => `${l.productos} por ${Number(l.amount).toLocaleString("es-CO")} COP, generado ${haceCuanto(l.createdAt)}`)
          .join("; ");
        return {
          ...vacio,
          pendingLinkWarning: `Este paciente tiene ${links.length === 1 ? "un link de pago sin pagar" : `${links.length} links de pago sin pagar`} con el mismo producto (${detalle}). Si cobras en efectivo, Atlas lo anula, para que no quede cobrado dos veces.`,
        };
      }
    }

    // Aviso de venta en efectivo DUPLICADA reciente (mismo paciente + producto, pagada, en la ventana): NO
    // registra, el profesional confirma con "Registrar de todos modos". Es lo que atrapa el re-registro
    // secuencial (la clave de idempotencia solo cubre el doble-clic simultaneo). AVISA POR LINEA, igual que
    // el checkout: si ya se registro una venta con MULTI-CELL y la nueva lleva MULTI-CELL y OMEGA, lo que se
    // duplica es el primero. En efectivo importa mas, porque el cobro ya ocurrio: revertirlo es una nota
    // credito, no un clic.
    if (!confirmDuplicate && lineas.length > 0) {
      const dup = await findRecentCashSaleDuplicate(patientId, lineas.map((l) => l.nutraceuticalId));
      if (dup) {
        const cuando = dup.minutesAgo <= 0 ? "hace menos de un minuto" : `hace ${dup.minutesAgo} min`;
        return {
          ...vacio,
          duplicateWarning: `Ya registraste una venta en efectivo de ${dup.product} a este paciente ${cuando}. Si es otra venta, confirma; si fue un doble registro, no la repitas (un cobro en efectivo duplicado se revierte con nota crédito).`,
        };
      }
    }

    const { amount, linksAnulados } = await registerCashSale(sale, user, idempotencyKey, {
      anularLinksQueComparten: anularLinks,
    });
    revalidatePath("/pagos");
    const evaluationId = String(formData.get("evaluationId") ?? "");
    if (evaluationId) revalidatePath(`/ani-bis-e/${evaluationId}`);
    return {
      ...vacio,
      success:
        `Venta en efectivo registrada por ${amount.toLocaleString("es-CO")} COP.` +
        (linksAnulados > 0 ? ` Se anuló ${linksAnulados === 1 ? "el link de pago pendiente" : `${linksAnulados} links de pago pendientes`}.` : ""),
    };
  } catch (e) {
    if (e instanceof CheckoutError) return { ...vacio, error: e.message };
    reportServerError("cash-sale.register", e);
    return { ...vacio, error: "No se pudo registrar la venta en efectivo." };
  }
}

function haceCuanto(iso: string): string {
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / (60 * 60 * 1000));
  return horas <= 0 ? "hace menos de una hora" : `hace ${horas} h`;
}

// ----- Anular un link de pago (decision (a) de Santiago, 2026-09-14) -----

/**
 * Anula un link pendiente y libera sus unidades. Misma policy que crear el checkout, y la venta tiene que ser
 * VISIBLE para el usuario (lectura con RLS): el profesional solo anula las suyas.
 */
export async function anularLinkFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  const vacio = { error: null, success: null, warning: null };
  const { user, error: authzError } = await requireCheckoutCreator();
  if (authzError) return { ...vacio, error: authzError.message };
  const parsed = accionDeVentaSchema.safeParse({ transactionId: String(formData.get("transactionId") ?? "") });
  if (!parsed.success) return { ...vacio, error: "Link de pago inválido." };

  try {
    const venta = await getVentaVisible(parsed.data.transactionId);
    if (!venta) return { ...vacio, error: "No encontramos ese link de pago." };
    await anularLink(venta.id, user);
    // SIN `revalidatePath`: el boton desaparece con el refresco, y lo hace la pantalla despues del toast
    // (`useFormToastAndRefresh`). Revalidar aqui desmonta el boton antes de que se vea el mensaje.
    return { ...vacio, success: "Link anulado. El paciente ya no puede pagarlo y sus unidades quedaron libres." };
  } catch (e) {
    if (e instanceof VentaError) return { ...vacio, error: e.message };
    reportServerError("checkout.anular", e);
    return { ...vacio, error: "No se pudo anular el link." };
  }
}

// ----- Entregar una venta (Bloque 3, sesion 2) -----

/** Registra que el paciente se llevo el producto de una venta pagada. */
export async function entregarVentaFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  const vacio = { error: null, success: null, warning: null };
  const user = await getCurrentUser();
  if (!user) return { ...vacio, error: "Inicia sesión." };
  const parsed = accionDeVentaSchema.safeParse({ transactionId: String(formData.get("transactionId") ?? "") });
  if (!parsed.success) return { ...vacio, error: "Venta inválida." };

  try {
    const venta = await getVentaVisible(parsed.data.transactionId);
    if (!venta) return { ...vacio, error: "No encontramos esa venta." };
    const propio = await getProfessionalProfileIdByUser(user.id);
    if (!canDeliverSale(user, venta, propio)) {
      return { ...vacio, error: "Solo el profesional de la venta registra su entrega." };
    }
    await entregarVenta(venta.id, user);
    return { ...vacio, success: "Entrega registrada." };
  } catch (e) {
    if (e instanceof VentaError) return { ...vacio, error: e.message };
    reportServerError("venta.entregar", e);
    return { ...vacio, error: "No se pudo registrar la entrega." };
  }
}

// ----- Reintentar las facturas pendientes (panel de /pagos) -----

/**
 * Vuelve a intentar las ventas cobradas sin documento fiscal.
 *
 * SE PUEDE PULSAR LAS VECES QUE HAGA FALTA. La idempotencia no la da este boton: la da el reclamo con
 * arriendo del servicio (dos pulsaciones a la vez no pasan las dos) y la regla de que una venta que ya
 * tiene id de factura se RELEE en vez de crear otra. Aqui solo se comprueba quien puede pulsarlo.
 *
 * MISMA POLICY QUE VER EL INGRESO (`canViewRevenue`), y no una nueva: quien puede ver el dinero de CNV es
 * quien tiene por que arreglar su facturacion. Inventar un permiso aparte para un boton habria sido una
 * segunda fuente de la misma decision.
 */
export async function reintentarFacturasAction(
  _prev: RetryFormState,
  _formData: FormData,
): Promise<RetryFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  if (!canViewRevenue(user)) {
    return { error: "No tienes permiso para reintentar facturas.", success: null, warning: null };
  }
  try {
    // EL MISMO BOTON REINTENTA EL INVENTARIO de las ventas pagadas (Bloque 3). Va primero porque es
    // independiente de la factura y no la bloquea. Un boton aparte seria una segunda puerta para cerrar
    // la misma venta.
    await reintentarDescuentosPendientes();
    const { intentadas } = await reintentarFacturasPendientes();
    // SIN `revalidatePath`: el refresco lo hace la pantalla (`useFormToastRefreshOnSuccess`). Hacer los
    // dos monta los segmentos dos veces, la pagina salta al inicio dos veces, y el formulario puede
    // desmontarse antes de que se vea el toast.
    return {
      error: null,
      success:
        intentadas === 0
          ? "No hay facturas pendientes por reintentar."
          : `Se reintentaron ${intentadas} factura${intentadas === 1 ? "" : "s"}. Mira el resultado en la lista.`,
      warning: null,
    };
  } catch (e) {
    reportServerError("facturas.reintentar", e);
    return { error: "No se pudieron reintentar las facturas.", success: null, warning: null };
  }
}
