"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/modules/auth/session";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";

import { saveTaxStatus } from "./data/tax-status-writer";
import { taxStatusSchema, type TaxStatusFormState } from "./validations";

// Radio si/no -> boolean. Solo "true"/"false" son validos; cualquier otra cosa se rechaza en el schema
// (undefined no es boolean), asi que un campo sin responder no pasa como false silencioso.
function ynBool(form: FormData, name: string): boolean | undefined {
  const v = form.get(name);
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

// El integrante guarda su propio estado tributario. El professionalId se resuelve de la SESION (no del
// cliente); solo se escribe su propia fila. Marca completado y refresca el banner del perfil y el dashboard.
export async function saveTaxStatusAction(
  _prev: TaxStatusFormState,
  formData: FormData,
): Promise<TaxStatusFormState> {
  const user = await requireUser();
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) return { error: "Tu cuenta no tiene un perfil profesional.", success: false };

  const parsed = taxStatusSchema.safeParse({
    personType: (formData.get("personType") as string | null)?.trim() ?? "",
    hasRut: ynBool(formData, "hasRut"),
    isIncomeDeclarant: ynBool(formData, "isIncomeDeclarant"),
    isVatResponsible: ynBool(formData, "isVatResponsible"),
    idNumber: (formData.get("idNumber") as string | null)?.trim() ?? "",
    mustInvoice: ynBool(formData, "mustInvoice"),
  });
  if (!parsed.success) {
    return { error: "Revisa el formulario: falta responder algún campo.", success: false };
  }

  await saveTaxStatus(professionalId, parsed.data);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
