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
import { CHECKOUT_TTL_MS } from "./data/checkout-reader";
import { enteroDeTexto } from "@/core/pesos";

import type { CanalDePago } from "./medio-de-pago";
import { leerLineas } from "./lineas-del-formulario";
import { canCreateCheckout } from "./policies/can-create-checkout";
import { canDeliverSale } from "./policies/can-deliver-sale";
import { MODALIDAD_LABEL } from "./modalidad";
import { cambiarModalidad, ModalidadError } from "./data/modalidad-writer";
import { canViewRevenue } from "./policies/can-view-revenue";
import { resumirDiscrepancias } from "./conciliacion";
import { cotejarConWompi } from "./services/conciliacion-service";
import { abrirContracargo, registrarNotaCreditoDeReversa, resolverReversa } from "./services/reversas-service";
import {
  DevolucionNoRegistrableError,
  registrarDevolucionFisica,
  verificarDevuelta,
} from "./data/devolucion-fisica-writer";
import {
  borrarVentaRetroactiva,
  registrarVentaRetroactiva,
  VentaRetroactivaError,
} from "./data/venta-retroactiva-writer";
import { lineasRetroactivasSchema } from "./validations/venta-retroactiva";
import {
  descartarLiquidacion,
  liquidarHasta,
  LiquidacionError,
  registrarPagoDeLiquidacion,
} from "./data/liquidacion-writer";
import { descontarInventarioDeVenta } from "./services/inventario-venta-service";
import { ReversaError } from "./data/reversas-writer";
import { reintentarFacturasPendientes } from "./services/facturacion-service";
import { reintentarDescuentosPendientes } from "./services/inventario-venta-service";
import {
  anularLink,
  CheckoutError,
  createCheckout,
  entregarVenta,
  linksPendientesQueBloquean,
  registerCashSale,
  registrarNotaCreditoDeVenta,
  registrarVersionDeVenta,
  resolverRevisionDeVenta,
  VentaError,
} from "./services/payments-service";
import type { CurrentUser } from "@/modules/auth/roles";

import {
  abrirContracargoSchema,
  accionDeVentaSchema,
  notaCreditoDeReversaSchema,
  notaCreditoManualSchema,
  resolverReversaSchema,
  comprobanteDeDevolucionSchema,
  versionDelIntegranteSchema,
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
    // EL MOTIVO DE LA MODALIDAD LLEGA A LA PANTALLA, y no es un detalle: sin este caso, el bloqueo de
    // Distribucion caia en el catch generico y decia "No se pudo crear el checkout", que manda a buscar un
    // fallo tecnico donde hay una regla del modelo. Ademas ensuciaba Sentry con un error que no es un error.
    if (e instanceof ModalidadError) return err(appError("validation", e.message));
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

  const result = await createCheckoutAction({
    patientId,
    items: lineas,
    treatmentId,
    desdeLaBodega: String(formData.get("desdeLaBodega") ?? "") === "true",
  });
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
    desdeLaBodega: String(formData.get("desdeLaBodega") ?? "") === "true",
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
          // ═══ LA RAZON DEPENDE DE SI EL LINK SIGUE VIVO (Santiago, 2026-09-24) ═══
          //
          // El aviso decia siempre "para que no quede cobrado dos veces", y se lo mostro sobre un link de
          // 117 horas. Un link vencido NO SE PUEDE PAGAR (el checkout lo rechaza a las 24 h y la pagina de
          // Wompi vence con su firma), asi que esa razon era falsa. Y tampoco retiene inventario: lo
          // disponible ya descuenta solo las reservas VIVAS (`expires_at > now()`), verificado en
          // `lotesDisponibles`. La accion sigue valiendo, pero por otra cosa: cierra un link que si no se
          // queda pendiente para siempre. Un aviso que da una razon falsa enseña a no creerle a los avisos.
          pendingLinkWarning: `Este paciente tiene ${links.length === 1 ? "un link de pago sin pagar" : `${links.length} links de pago sin pagar`} con el mismo producto (${detalle}). ${
            links.every((l) => vencido(l.createdAt))
              ? "Ya venció y no se puede pagar; al cobrar en efectivo, Atlas lo cierra para que deje de aparecer como pendiente."
              : "Si cobras en efectivo, Atlas lo anula, para que no quede cobrado dos veces."
          }`,
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
      // COMO LLEGO LA PLATA (2026-09-25). Las dos nacen pagadas y ninguna pasa por la pasarela, pero no son
      // lo mismo para la DIAN ni para la cuenta del pago: registrar una transferencia como efectivo diria
      // que el dinero sigue en el bolsillo del Integrante cuando ya esta en una cuenta.
      canal: String(formData.get("canal") ?? "") === "transferencia" ? "transferencia" : "efectivo",
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
    if (e instanceof ModalidadError) return { ...vacio, error: e.message };
    reportServerError("cash-sale.register", e);
    return { ...vacio, error: "No se pudo registrar la venta en efectivo." };
  }
}

/** Si un link ya pasó su TTL: vencido NO se puede pagar (el checkout lo rechaza y la firma de Wompi caduca). */
function vencido(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > CHECKOUT_TTL_MS;
}

/** El canal que llego del formulario, o efectivo si no es ninguno de los tres. */
function medioDePagoDeLaForma(valor: FormDataEntryValue | null): CanalDePago {
  const v = String(valor ?? "");
  return v === "wompi" || v === "transferencia" ? v : "efectivo";
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

// ----- Resolver una venta en revision (pago sobre link anulado) -----

// MISMA POLICY QUE VER EL INGRESO Y REINTENTAR FACTURAS (`canViewRevenue`): admin y direccion. Quien decide
// entre ellos (o contabilidad) es una pregunta abierta a contabilidad
// (docs/entregas/CONSULTA_CONTABILIDAD_PAGO_SOBRE_LINK_ANULADO.md, pregunta 4); mientras tanto no se abre a
// quien no ve el dinero.
async function resolverRevisionFormAction(
  resolucion: "segunda_compra" | "devuelto" | "efectivo_no_recibido",
  formData: FormData,
): Promise<AccionDeVentaState> {
  const vacio = { error: null, success: null, warning: null };
  const user = await getCurrentUser();
  if (!user) return { ...vacio, error: "Inicia sesión." };
  if (!canViewRevenue(user)) return { ...vacio, error: "No tienes permiso para resolver esta venta." };
  const parsed = accionDeVentaSchema.safeParse({ transactionId: String(formData.get("transactionId") ?? "") });
  if (!parsed.success) return { ...vacio, error: "Venta inválida." };
  let comprobante: string | null = null;
  if (resolucion === "devuelto") {
    const c = comprobanteDeDevolucionSchema.safeParse(String(formData.get("comprobante") ?? ""));
    if (!c.success) return { ...vacio, error: c.error.issues[0]?.message ?? "Escribe el comprobante de la devolución." };
    comprobante = c.data;
  }
  try {
    await resolverRevisionDeVenta(parsed.data.transactionId, resolucion, user, comprobante);
    return {
      ...vacio,
      success:
        resolucion === "segunda_compra"
          ? "Marcada como segunda compra. Se descontó el inventario y se pidió la factura."
          : resolucion === "efectivo_no_recibido"
            ? "Marcada: el efectivo no se recibió. Se facturó el pago de Wompi y se revirtió la comisión del efectivo. Falta la nota crédito manual en Alegra."
            : "Marcada como devuelta. No se factura ni se descuenta.",
    };
  } catch (e) {
    if (e instanceof VentaError) return { ...vacio, error: e.message };
    reportServerError("venta.resolver-revision", e);
    return { ...vacio, error: "No se pudo resolver la venta." };
  }
}

export async function resolverComoSegundaCompraFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  return resolverRevisionFormAction("segunda_compra", formData);
}

export async function resolverComoEfectivoNoRecibidoFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  return resolverRevisionFormAction("efectivo_no_recibido", formData);
}

export async function resolverComoDevueltoFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  return resolverRevisionFormAction("devuelto", formData);
}

// ----- La version del Integrante sobre un pago en revision -----

/**
 * La escribe el Integrante de la venta (o un admin), y tambien quien resuelve (admin o direccion) cuando el
 * Integrante se lo conto. La venta tiene que ser visible para el usuario (RLS).
 */
export async function registrarVersionFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  const vacio = { error: null, success: null, warning: null };
  const user = await getCurrentUser();
  if (!user) return { ...vacio, error: "Inicia sesión." };
  const parsed = versionDelIntegranteSchema.safeParse({
    transactionId: String(formData.get("transactionId") ?? ""),
    version: String(formData.get("version") ?? ""),
  });
  if (!parsed.success) return { ...vacio, error: parsed.error.issues[0]?.message ?? "Versión inválida." };
  try {
    const venta = await getVentaVisible(parsed.data.transactionId);
    if (!venta) return { ...vacio, error: "No encontramos esa venta." };
    const propio = await getProfessionalProfileIdByUser(user.id);
    if (!canDeliverSale(user, venta, propio) && !canViewRevenue(user)) {
      return { ...vacio, error: "Solo el profesional de la venta o Dirección registran la versión." };
    }
    await registrarVersionDeVenta(venta.id, parsed.data.version, user);
    return { ...vacio, success: "Versión registrada." };
  } catch (e) {
    if (e instanceof VentaError) return { ...vacio, error: e.message };
    reportServerError("venta.version-integrante", e);
    return { ...vacio, error: "No se pudo registrar la versión." };
  }
}

// ----- La nota credito manual de un efectivo que no se recibio -----

/** Direccion escribe el numero de la nota credito que contabilidad emitio a mano en Alegra. */
export async function registrarNotaCreditoFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  const vacio = { error: null, success: null, warning: null };
  const user = await getCurrentUser();
  if (!user) return { ...vacio, error: "Inicia sesión." };
  if (!canViewRevenue(user)) return { ...vacio, error: "No tienes permiso para registrar la nota crédito." };
  const parsed = notaCreditoManualSchema.safeParse({
    transactionId: String(formData.get("transactionId") ?? ""),
    numero: String(formData.get("numero") ?? ""),
  });
  if (!parsed.success) return { ...vacio, error: parsed.error.issues[0]?.message ?? "Número inválido." };
  try {
    await registrarNotaCreditoDeVenta(parsed.data.transactionId, parsed.data.numero);
    return { ...vacio, success: "Nota crédito registrada." };
  } catch (e) {
    if (e instanceof VentaError) return { ...vacio, error: e.message };
    reportServerError("venta.nota-credito-manual", e);
    return { ...vacio, error: "No se pudo registrar la nota crédito." };
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

/**
 * EL COTEJO CON WOMPI A MANO (Bloque 3b, sesion 3). La tarea lo corre cada manana; este boton es para cuando
 * alguien SABE que un pago no llego y no quiere esperar a manana. Es el mismo servicio, con el mismo candado de
 * idempotencia, asi que pulsarlo dos veces no aplica nada dos veces.
 */
export async function cotejarConWompiAction(
  _prev: RetryFormState,
  _formData: FormData,
): Promise<RetryFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Inicia sesión.", success: null, warning: null };
  // Recuperar un pago SELLA plata (ingreso, comision, factura): lo mismo que reintentar facturas.
  if (!canViewRevenue(user)) {
    return { error: "No tienes permiso para cotejar los pagos con Wompi.", success: null, warning: null };
  }
  try {
    const r = await cotejarConWompi({ origen: "manual", actorId: user.id });
    if (r.falloPor) return { error: `No se pudo consultar a Wompi: ${r.falloPor}`, success: null, warning: null };
    if (r.discrepancias.length > 0) {
      // CON EL MOTIVO, NO SOLO EL NUMERO (smoke del 2026-09-17): "1 no cuadra" sin decir cual ni por que no le
      // sirve a quien tiene que resolverlo. El detalle completo queda ademas en el panel, bajo la ultima revisión.
      return {
        error: null,
        success: null,
        warning: `De las ${r.revisadas} ventas revisadas, ${resumirDiscrepancias(r.discrepancias).join(" · ")}`,
      };
    }
    return {
      error: null,
      success:
        r.recuperadas.length === 0
          ? `Se revisaron las ${r.revisadas} venta${r.revisadas === 1 ? "" : "s"} con link de pago de los últimos 3 días, y ninguna estaba pagada sin registrar. Todo al día.`
          : `Se recuperó ${r.recuperadas.length} pago${r.recuperadas.length === 1 ? "" : "s"} que Wompi había aprobado. Quedó registrado como cualquier otro: lo ves abajo, en Transacciones, y en "Ventas por revisar" si el link estaba anulado.`,
      warning: null,
    };
  } catch (e) {
    reportServerError("pagos.cotejo-wompi", e);
    return { error: "No se pudo cotejar con Wompi.", success: null, warning: null };
  }
}

// ═══ LAS REVERSAS DE VENTA (Bloque 3b, sesion 1) ═══
//
// Un contracargo no lo decide CNV: llega. Abrirlo NO mueve el ingreso (la disputa se puede ganar y la factura
// sigue valida); perderla si, y ademas deja pendiente la nota credito manual. Quien resuelve deja la referencia
// de la respuesta del banco: esa transicion mueve dinero.

async function quienPuedeReversar(): Promise<{ user: CurrentUser } | { error: AccionDeVentaState }> {
  const user = await getCurrentUser();
  if (!user) return { error: { error: "Inicia sesión.", success: null, warning: null } };
  if (!canViewRevenue(user)) {
    return { error: { error: "No tienes permiso para registrar o resolver reversas.", success: null, warning: null } };
  }
  return { user };
}

export async function abrirContracargoFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  const quien = await quienPuedeReversar();
  if ("error" in quien) return quien.error;
  const parsed = abrirContracargoSchema.safeParse({
    transactionId: String(formData.get("transactionId") ?? ""),
    referencia: String(formData.get("referencia") ?? ""),
    montoDebitado: String(formData.get("montoDebitado") ?? ""),
    debitadoEn: String(formData.get("debitadoEn") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", success: null, warning: null };
  try {
    const r = await abrirContracargo({
      transactionId: parsed.data.transactionId,
      referenciaDeLaDisputa: parsed.data.referencia,
      montoDebitado: parsed.data.montoDebitado,
      debitadoEn: parsed.data.debitadoEn || null,
      nota: null,
      actorId: quien.user.id,
    });
    if ("yaHabiaUna" in r) {
      return { error: null, success: null, warning: "Esa venta ya tenía un caso abierto. Míralo en el panel de contracargos." };
    }
    return {
      error: null,
      success:
        "Caso abierto. El ingreso no se toca hasta que la disputa se resuelva. Responde al banco con los soportes: sin respuesta a tiempo se pierde.",
      warning: null,
    };
  } catch (e) {
    if (e instanceof ReversaError) return { error: e.message, success: null, warning: null };
    reportServerError("pagos.abrir-contracargo", e);
    return { error: "No se pudo abrir el caso.", success: null, warning: null };
  }
}

async function resolver(formData: FormData, resultado: "ganada" | "perdida"): Promise<AccionDeVentaState> {
  const quien = await quienPuedeReversar();
  if ("error" in quien) return quien.error;
  const parsed = resolverReversaSchema.safeParse({
    reversaId: String(formData.get("reversaId") ?? ""),
    referencia: String(formData.get("referencia") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", success: null, warning: null };
  try {
    await resolverReversa({
      reversaId: parsed.data.reversaId,
      resultado,
      referenciaDeLaRespuesta: parsed.data.referencia,
      actorId: quien.user.id,
    });
    return {
      error: null,
      success:
        resultado === "ganada"
          ? "Disputa ganada. El ingreso nunca se movió, así que no hay nada más que hacer."
          : "Disputa perdida. Se revirtieron el ingreso y la comisión, y queda pendiente la nota crédito manual en Alegra, POR EL VALOR DE LA VENTA.",
      warning: null,
    };
  } catch (e) {
    if (e instanceof ReversaError) return { error: e.message, success: null, warning: null };
    reportServerError("pagos.resolver-reversa", e);
    return { error: "No se pudo resolver el caso.", success: null, warning: null };
  }
}

export async function resolverReversaGanadaFormAction(_prev: AccionDeVentaState, formData: FormData) {
  return resolver(formData, "ganada");
}

export async function resolverReversaPerdidaFormAction(_prev: AccionDeVentaState, formData: FormData) {
  return resolver(formData, "perdida");
}

export async function registrarNotaCreditoDeReversaFormAction(
  _prev: AccionDeVentaState,
  formData: FormData,
): Promise<AccionDeVentaState> {
  const quien = await quienPuedeReversar();
  if ("error" in quien) return quien.error;
  const parsed = notaCreditoDeReversaSchema.safeParse({
    reversaId: String(formData.get("reversaId") ?? ""),
    numero: String(formData.get("numero") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", success: null, warning: null };
  try {
    const ok = await registrarNotaCreditoDeReversa(parsed.data.reversaId, parsed.data.numero);
    return ok
      ? { error: null, success: "Nota crédito registrada. El caso queda cerrado.", warning: null }
      : {
          error: "Esa reversa no pide nota crédito (solo una disputa perdida o una devolución), o ya tenía la suya.",
          success: null,
          warning: null,
        };
  } catch (e) {
    reportServerError("pagos.nota-credito-reversa", e);
    return { error: "No se pudo registrar la nota crédito.", success: null, warning: null };
  }
}

// ── LA DEVOLUCION FISICA (Bloque 3b, sesion 2) ────────────────────────────────────────────────────────
// Quien la registra y quien verifica es la misma gente que ya lleva las reversas (direccion, admin, soporte):
// decide sobre inventario y sobre dinero, no es del profesional.
export type DevolucionState = { error: string | null; success: string | null; warning: string | null };

const sinPermiso: DevolucionState = { error: "No autorizado.", success: null, warning: null };

export async function registrarDevolucionFisicaAction(
  _prev: DevolucionState,
  form: FormData,
): Promise<DevolucionState> {
  const user = await getCurrentUser();
  if (!user || !canViewRevenue(user)) return sinPermiso;
  const transactionItemId = String(form.get("transactionItemId") ?? "");
  // SE LEE COMO LO TECLEA UNA PERSONA (2026-09-25): era el unico sitio de inventario sin ningun schema, y
  // "1.000" pasaba como 1 (entero y positivo). En una devolucion las cantidades son de 1 a 3, asi que el
  // riesgo practico era bajo, pero el mensaje de un campo vacio decia "tiene que ser un numero entero mayor
  // que cero" sin decir que FALTABA el dato.
  const cantidad = enteroDeTexto(String(form.get("cantidad") ?? ""));
  if (cantidad == null) {
    return { error: "Escribe cuántas unidades devolvió, en números.", success: null, warning: null };
  }
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!transactionItemId) return { error: "Falta la línea de venta.", success: null, warning: null };
  if (motivo.length < 5) return { error: "Escribe por qué se devolvió (al menos cinco letras).", success: null, warning: null };
  try {
    const { alPaciente } = await registrarDevolucionFisica({
      transactionItemId,
      cantidad,
      motivo,
      actorId: user.id,
      actorEmail: user.email,
      ip: null,
    });
    return {
      error: null,
      // EL AVISO DICE LAS DOS COSAS, porque las dos pasaron: el producto y el dinero. Antes decia solo lo del
      // producto y el ingreso se quedaba entero sin que nadie lo notara.
      success: `Devolución registrada. La unidad queda en devueltas pendientes de verificación, no vendible. Se revirtió el ingreso y la comisión de esas unidades: hay que emitir la nota crédito por ${alPaciente.toLocaleString("es-CO")} en Alegra.`,
      warning: null,
    };
  } catch (e) {
    if (e instanceof DevolucionNoRegistrableError) return { error: e.message, success: null, warning: null };
    reportServerError("registrarDevolucionFisicaAction", e);
    return { error: "No se pudo registrar la devolución.", success: null, warning: null };
  }
}

export async function verificarDevueltaAction(_prev: DevolucionState, form: FormData): Promise<DevolucionState> {
  const user = await getCurrentUser();
  if (!user || !canViewRevenue(user)) return sinPermiso;
  const decision = String(form.get("decision") ?? "") === "reincorporar" ? "reincorporar" : "dar_de_baja";
  try {
    await verificarDevuelta({
      nutraceuticalId: String(form.get("nutraceuticalId") ?? ""),
      lotId: String(form.get("lotId") ?? ""),
      cantidad: enteroDeTexto(String(form.get("cantidad") ?? "")) ?? 0,
      decision,
      destinoId: String(form.get("destinoId") ?? "") || undefined,
      motivo: String(form.get("motivo") ?? "").trim(),
      actorId: user.id,
      actorEmail: user.email,
      ip: null,
    });
    return {
      error: null,
      success:
        decision === "reincorporar"
          ? "Reincorporada al lote, con tu nombre como quien verificó."
          : "Dada de baja contra gasto, con tu nombre y el motivo.",
      warning: null,
    };
  } catch (e) {
    if (e instanceof DevolucionNoRegistrableError) return { error: e.message, success: null, warning: null };
    reportServerError("verificarDevueltaAction", e);
    return { error: "No se pudo registrar la verificación.", success: null, warning: null };
  }
}

// ═══ LA VENTA RETROACTIVA (Bloque R) ═══
//
// Solo Direccion: reconstruir la historia comercial de una integrante toca ingresos, comisiones e inventario
// de otra persona, y no es una operacion de consultorio.

export async function registrarVentaRetroactivaAction(
  _prev: DevolucionState,
  form: FormData,
): Promise<DevolucionState> {
  const user = await getCurrentUser();
  if (!user || !canViewRevenue(user)) return sinPermiso;

  // Las lineas viajan como JSON en un campo oculto: la pantalla arma la lista y el servidor la valida entera.
  let lineas: { nutraceuticalId: string; cantidad: number; precioUnitario: number }[] = [];
  try {
    const crudo: unknown = JSON.parse(String(form.get("lineas") ?? "[]"));
    const parseada = lineasRetroactivasSchema.safeParse(crudo);
    if (!parseada.success) {
      // EL MENSAJE DICE CUAL Y QUE (Santiago, 2026-09-25). Antes decia "Revisa los productos, las cantidades
      // y los precios" sobre un formulario con varias lineas, asi que no decia nada: el primer intento real
      // se quedo ahi sin saber que mirar. La pantalla ademas ya avisa antes de enviar; esto es la red.
      const donde = parseada.error.issues
        .map((i) => {
          const linea = typeof i.path[0] === "number" ? i.path[0] + 1 : null;
          const campo = i.path[1] === "cantidad" ? "la cantidad" : i.path[1] === "precioUnitario" ? "el precio" : "el producto";
          return linea ? `producto ${linea} (${campo})` : campo;
        })
        .filter((x, i, a) => a.indexOf(x) === i)
        .slice(0, 4)
        .join(", ");
      return {
        error: `Revisa ${donde || "los productos, las cantidades y los precios"}. Las cifras se pueden escribir con puntos o comas (11.900 o 11900).`,
        success: null,
        warning: null,
      };
    }
    lineas = parseada.data;
  } catch {
    return { error: "No se pudieron leer los productos de la venta.", success: null, warning: null };
  }

  try {
    const { id, total } = await registrarVentaRetroactiva({
      organizationId: String(form.get("organizationId") ?? ""),
      patientId: String(form.get("patientId") ?? ""),
      professionalId: String(form.get("professionalId") ?? ""),
      fecha: String(form.get("fecha") ?? ""),
      numeroDeFactura: String(form.get("numeroDeFactura") ?? ""),
      medioDePago: medioDePagoDeLaForma(form.get("medioDePago")),
      lineas,
      actorId: user.id,
      actorEmail: user.email,
      ip: null,
    });
    // EL DESCUENTO DE INVENTARIO VA FUERA de la transaccion de la venta y por el camino de siempre, igual que
    // en la venta en efectivo: si el saldo no alcanza, la venta queda `sin_saldo` y se ve, en vez de perderse
    // el registro entero por una existencia que no cuadra.
    await descontarInventarioDeVenta(id);
    return {
      error: null,
      success: `Venta registrada por ${total.toLocaleString("es-CO")}, con su fecha real y su factura. Atlas no la va a facturar.`,
      warning: null,
    };
  } catch (e) {
    if (e instanceof VentaRetroactivaError) return { error: e.message, success: null, warning: null };
    reportServerError("registrarVentaRetroactivaAction", e);
    return { error: "No se pudo registrar la venta.", success: null, warning: null };
  }
}

export async function borrarVentaRetroactivaAction(
  _prev: DevolucionState,
  form: FormData,
): Promise<DevolucionState> {
  const user = await getCurrentUser();
  if (!user || !canViewRevenue(user)) return sinPermiso;
  try {
    await borrarVentaRetroactiva({
      transactionId: String(form.get("transactionId") ?? ""),
      actorId: user.id,
      actorEmail: user.email,
      ip: null,
    });
    return { error: null, success: "Venta retroactiva borrada.", warning: null };
  } catch (e) {
    if (e instanceof VentaRetroactivaError) return { error: e.message, success: null, warning: null };
    reportServerError("borrarVentaRetroactivaAction", e);
    return { error: "No se pudo borrar la venta.", success: null, warning: null };
  }
}

// ═══ LA LIQUIDACION DE COMISIONES (Bloque 4) ═══

export async function liquidarComisionAction(
  _prev: DevolucionState,
  form: FormData,
): Promise<DevolucionState> {
  const user = await getCurrentUser();
  if (!user || !canViewRevenue(user)) return sinPermiso;
  try {
    const { neto } = await liquidarHasta({
      professionalId: String(form.get("professionalId") ?? ""),
      hasta: String(form.get("hasta") ?? ""),
      actorId: user.id,
      actorEmail: user.email,
      ip: null,
    });
    return {
      error: null,
      success: `Liquidación calculada: $${neto.toLocaleString("es-CO")} a girar. Registra el giro cuando salga.`,
      warning: null,
    };
  } catch (e) {
    if (e instanceof LiquidacionError) return { error: e.message, success: null, warning: null };
    reportServerError("liquidarComisionAction", e);
    return { error: "No se pudo liquidar.", success: null, warning: null };
  }
}

export async function registrarPagoDeLiquidacionAction(
  _prev: DevolucionState,
  form: FormData,
): Promise<DevolucionState> {
  const user = await getCurrentUser();
  if (!user || !canViewRevenue(user)) return sinPermiso;
  try {
    await registrarPagoDeLiquidacion({
      settlementId: String(form.get("settlementId") ?? ""),
      referencia: String(form.get("referencia") ?? ""),
      actorId: user.id,
      actorEmail: user.email,
      ip: null,
    });
    return { error: null, success: "Giro registrado.", warning: null };
  } catch (e) {
    if (e instanceof LiquidacionError) return { error: e.message, success: null, warning: null };
    reportServerError("registrarPagoDeLiquidacionAction", e);
    return { error: "No se pudo registrar el giro.", success: null, warning: null };
  }
}

export async function descartarLiquidacionAction(
  _prev: DevolucionState,
  form: FormData,
): Promise<DevolucionState> {
  const user = await getCurrentUser();
  if (!user || !canViewRevenue(user)) return sinPermiso;
  try {
    await descartarLiquidacion({
      settlementId: String(form.get("settlementId") ?? ""),
      actorId: user.id,
      actorEmail: user.email,
      ip: null,
    });
    return { error: null, success: "Liquidación descartada: sus comisiones vuelven a quedar pendientes.", warning: null };
  } catch (e) {
    if (e instanceof LiquidacionError) return { error: e.message, success: null, warning: null };
    reportServerError("descartarLiquidacionAction", e);
    return { error: "No se pudo descartar la liquidación.", success: null, warning: null };
  }
}

// ═══ CAMBIAR LA MODALIDAD DE UN INTEGRANTE (0178, 2026-09-25) ═══
//
// SOLO DIRECCION/ADMIN, y no es una preferencia del integrante: la modalidad decide quien le factura al
// paciente, si su margen lleva retencion y quien asume la relacion de consumo. El modelo (§13) lo dice
// textual: "La modalidad activa la asigna un administrador de CNV".
//
// EL AVISO DICE DESDE CUANDO RIGE, y esa frase no es cortesia: el cambio se pide hoy y hoy NO PASA NADA
// (entra al inicio del siguiente corte, modelo §2). Sin decirlo, se lee como que el boton no funciono.
export async function cambiarModalidadFormAction(
  _prev: DevolucionState,
  form: FormData,
): Promise<DevolucionState> {
  const user = await getCurrentUser();
  if (!user || !canViewRevenue(user)) return sinPermiso;
  const professionalId = String(form.get("professionalId") ?? "");
  const hacia = String(form.get("hacia") ?? "");
  if (hacia !== "comision" && hacia !== "distribucion") {
    return { error: "Modalidad inválida.", success: null, warning: null };
  }
  const nota = String(form.get("nota") ?? "").trim();
  try {
    const { rigeDesde } = await cambiarModalidad({
      professionalId,
      hacia,
      actorId: user.id,
      actorEmail: user.email,
      requisitosVerificados: form.get("requisitos") === "on",
      nota: nota === "" ? null : nota,
      ip: null,
    });
    revalidatePath(`/admin/integrantes/${professionalId}`);
    return {
      error: null,
      success: `Modalidad ${MODALIDAD_LABEL[hacia]} registrada, y rige desde el ${rigeDesde}. Lo que se venda hasta ese día se liquida bajo la modalidad anterior, para no partir el período en dos regímenes.`,
      warning: null,
    };
  } catch (e) {
    if (e instanceof ModalidadError) return { error: e.message, success: null, warning: null };
    reportServerError("cambiarModalidadFormAction", e);
    return { error: "No se pudo cambiar la modalidad.", success: null, warning: null };
  }
}
