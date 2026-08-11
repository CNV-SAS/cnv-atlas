"use server";

import { revalidatePath } from "next/cache";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { reportServerError } from "@/lib/observability/report-error";
import { getCurrentUser } from "@/modules/auth/session";

import { findLivePendingDuplicate } from "./data/payments-repository";
import { canCreateCheckout } from "./policies/can-create-checkout";
import { CheckoutError, createCheckout, registerCashSale } from "./services/payments-service";
import {
  createCheckoutSchema,
  registerCashSaleSchema,
  type CashSaleFormState,
  type CreateCheckoutInput,
  type PaymentFormState,
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

// La UI minima crea una orden de una sola linea; el action y el servicio soportan
// varias (lo ejercitan los tests). El refinamiento a multilinea es de un bloque
// posterior junto con el catalogo de Alegra.
export async function createCheckoutFormAction(
  _prev: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const patientId = String(formData.get("patientId") ?? "");
  const nutraceuticalId = String(formData.get("nutraceuticalId") ?? "");
  const confirmDuplicate = String(formData.get("confirmDuplicate") ?? "") === "true";

  // Avisa antes de crear un cobro DUPLICADO vivo (mismo paciente + mismo producto, pending y < 24h): no
  // es solo la pantalla vieja, tambien el olvido con la pantalla al dia. No bloquea: el profesional puede
  // confirmar con "Generar de todos modos". Un pago de mas no tiene reembolso en el MVP (ver BACKLOG).
  if (!confirmDuplicate && patientId && nutraceuticalId) {
    const dup = await findLivePendingDuplicate(patientId, [nutraceuticalId]);
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
    items: [{ nutraceuticalId, quantity: Number(String(formData.get("quantity") ?? "")) }],
  });
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
  if (authzError) return { error: authzError.message, success: null };

  const parsed = registerCashSaleSchema.safeParse({
    patientId: String(formData.get("patientId") ?? ""),
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    items: [
      {
        nutraceuticalId: String(formData.get("nutraceuticalId") ?? ""),
        quantity: Number(String(formData.get("quantity") ?? "")),
      },
    ],
  });
  if (!parsed.success) return { error: "Datos de la venta inválidos.", success: null };

  try {
    const { idempotencyKey, ...sale } = parsed.data;
    const { amount } = await registerCashSale(sale, user, idempotencyKey);
    revalidatePath("/pagos");
    return {
      error: null,
      success: `Venta en efectivo registrada por ${amount.toLocaleString("es-CO")} COP.`,
    };
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message, success: null };
    reportServerError("cash-sale.register", e);
    return { error: "No se pudo registrar la venta en efectivo.", success: null };
  }
}
