"use server";

import { revalidatePath } from "next/cache";

import { appError, err, ok, type AppError, type Result } from "@/core/errors";
import { getCurrentUser } from "@/modules/auth/session";

import { canCreateCheckout } from "./policies/can-create-checkout";
import { CheckoutError, createCheckout } from "./services/payments-service";
import {
  createCheckoutSchema,
  type CreateCheckoutInput,
  type PaymentFormState,
} from "./validations";

// Autorizacion comun (regla 3): crear checkout = professional o admin.
async function requireCheckoutCreator() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: appError("unauthorized", "Inicia sesion.") };
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
  if (!parsed.success) return err(appError("validation", "Datos del checkout invalidos."));

  try {
    const created = await createCheckout(parsed.data, user);
    revalidatePath("/pagos");
    return ok(created);
  } catch (e) {
    if (e instanceof CheckoutError) return err(appError("validation", e.message));
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
  const result = await createCheckoutAction({
    patientId: String(formData.get("patientId") ?? ""),
    items: [
      {
        nutraceuticalId: String(formData.get("nutraceuticalId") ?? ""),
        quantity: Number(String(formData.get("quantity") ?? "")),
      },
    ],
  });
  if (!result.ok) return { error: result.error.message, success: null, checkoutUrl: null };
  return {
    error: null,
    success: "Checkout creado. Comparte el link con el paciente.",
    checkoutUrl: result.value.checkoutUrl,
  };
}
