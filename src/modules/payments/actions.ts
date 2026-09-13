"use server";

import { revalidatePath } from "next/cache";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { reportServerError } from "@/lib/observability/report-error";
import { getCurrentUser } from "@/modules/auth/session";

import {
  findLivePendingDuplicate,
  findRecentCashSaleDuplicate,
} from "./data/payments-repository";
import { leerLineas } from "./lineas-del-formulario";
import { canCreateCheckout } from "./policies/can-create-checkout";
import { canViewRevenue } from "./policies/can-view-revenue";
import { reintentarFacturasPendientes } from "./services/facturacion-service";
import { CheckoutError, createCheckout, registerCashSale } from "./services/payments-service";
import {
  createCheckoutSchema,
  registerCashSaleSchema,
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

  const result = await createCheckoutAction({ patientId, items: lineas });
  if (!result.ok) {
    return { error: result.error.message, success: null, checkoutUrl: null, duplicateWarning: null };
  }
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
  const { user, error: authzError } = await requireCheckoutCreator();
  if (authzError) return { error: authzError.message, success: null, duplicateWarning: null };

  const patientId = String(formData.get("patientId") ?? "");
  const lineas = leerLineas(formData);
  const confirmDuplicate = String(formData.get("confirmDuplicate") ?? "") === "true";

  // Aviso de venta en efectivo DUPLICADA reciente (mismo paciente + producto, pagada, en la ventana): NO
  // registra, el profesional confirma con "Registrar de todos modos". Reusa el patron del checkout. Esto
  // es lo que atrapa el re-registro secuencial (la clave de idempotencia solo cubre el doble-clic
  // simultaneo). En efectivo importa mas: un cobro duplicado se revierte con nota credito, no con un clic.
  // AVISA POR LINEA, igual que el checkout: si ya se registro una venta con MULTI-CELL y la nueva lleva
  // MULTI-CELL y OMEGA, lo que se duplica es el primero. En efectivo importa mas, porque el cobro ya
  // ocurrio: revertirlo es una nota credito, no un clic.
  if (!confirmDuplicate && patientId && lineas.length > 0) {
    const dup = await findRecentCashSaleDuplicate(patientId, lineas.map((l) => l.nutraceuticalId));
    if (dup) {
      const cuando = dup.minutesAgo <= 0 ? "hace menos de un minuto" : `hace ${dup.minutesAgo} min`;
      return {
        error: null,
        success: null,
        duplicateWarning: `Ya registraste una venta en efectivo de ${dup.product} a este paciente ${cuando}. Si es otra venta, confirma; si fue un doble registro, no la repitas (un cobro en efectivo duplicado se revierte con nota credito).`,
      };
    }
  }

  const parsed = registerCashSaleSchema.safeParse({
    patientId,
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    items: lineas,
  });
  if (!parsed.success) return { error: "Datos de la venta inválidos.", success: null, duplicateWarning: null };

  try {
    const { idempotencyKey, ...sale } = parsed.data;
    const { amount } = await registerCashSale(sale, user, idempotencyKey);
    revalidatePath("/pagos");
    return {
      error: null,
      success: `Venta en efectivo registrada por ${amount.toLocaleString("es-CO")} COP.`,
      duplicateWarning: null,
    };
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message, success: null, duplicateWarning: null };
    reportServerError("cash-sale.register", e);
    return { error: "No se pudo registrar la venta en efectivo.", success: null, duplicateWarning: null };
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
