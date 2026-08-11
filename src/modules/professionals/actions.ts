"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/modules/auth/session";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";

import { getRutPath, isPdfBuffer, uploadRutPdf } from "./data/rut-storage";
import { saveTaxStatus } from "./data/tax-status-writer";
import { bankHolderMatchesIntegrante, validateTaxIdentity } from "./tax-rules";
import { taxStatusSchema, type TaxStatusFormState } from "./validations";

const MAX_RUT_BYTES = 10 * 1024 * 1024; // 10 MB

function ynBool(form: FormData, name: string): boolean | undefined {
  const v = form.get(name);
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function str(form: FormData, name: string): string {
  return (form.get(name) as string | null)?.trim() ?? "";
}

const fail = (error: string): TaxStatusFormState => ({ error, success: false });

// El integrante guarda su parte del estado tributario (A2): lo que sabe + el RUT. Los campos certificados
// los llena CNV al verificar. El professionalId sale de la sesion; solo escribe su propia fila.
export async function saveTaxStatusAction(
  _prev: TaxStatusFormState,
  formData: FormData,
): Promise<TaxStatusFormState> {
  const user = await requireUser();
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) return fail("Tu cuenta no tiene un perfil profesional.");

  const parsed = taxStatusSchema.safeParse({
    personType: str(formData, "personType"),
    hasRut: ynBool(formData, "hasRut"),
    idType: str(formData, "idType"),
    idNumber: str(formData, "idNumber"),
    idDv: str(formData, "idDv") || null,
    bankName: str(formData, "bankName"),
    bankAccountType: str(formData, "bankAccountType"),
    bankAccountNumber: str(formData, "bankAccountNumber"),
    bankAccountHolderName: str(formData, "bankAccountHolderName"),
    bankAccountHolderDocument: str(formData, "bankAccountHolderDocument"),
  });
  if (!parsed.success) return fail("Revisa el formulario: falta responder algún campo.");
  const data = parsed.data;

  // Validacion cruzada (reglas puras): juridica sin RUT es imposible, y el DV del NIT debe cuadrar.
  const idErr = validateTaxIdentity({
    personType: data.personType,
    hasRut: data.hasRut,
    idType: data.idType,
    idNumber: data.idNumber,
    idDv: data.idDv,
  });
  if (idErr) return fail(idErr);

  // El titular de la cuenta debe ser el integrante (por DOCUMENTO, no por nombre; juridica -> el NIT).
  if (!bankHolderMatchesIntegrante(data.idNumber, data.bankAccountHolderDocument)) {
    return fail(
      "El documento del titular de la cuenta debe ser el mismo del integrante (por requisito tributario, quien recibe la comisión debe ser quien emite el soporte).",
    );
  }

  // RUT: obligatorio si el integrante dice que tiene uno (y no lo habia subido antes). Se valida que sea un
  // PDF DE VERDAD (contenido, no extension) antes de subirlo.
  let newRutPath: string | null = null;
  if (data.hasRut) {
    const file = formData.get("rutFile");
    const hasFile = file instanceof File && file.size > 0;
    if (!hasFile) {
      const existing = await getRutPath(professionalId);
      if (!existing) return fail("Sube tu RUT en PDF para continuar.");
    } else {
      if (file.size > MAX_RUT_BYTES) return fail("El archivo del RUT es muy grande (máximo 10 MB).");
      const buf = Buffer.from(await file.arrayBuffer());
      if (!isPdfBuffer(buf)) {
        return fail("El archivo debe ser un PDF. El RUT que descargas del portal de la DIAN es un PDF; una imagen no sirve.");
      }
      const up = await uploadRutPdf(professionalId, buf);
      if (!up) return fail("No se pudo subir el RUT. Intenta de nuevo.");
      newRutPath = up.path;
    }
  }

  await saveTaxStatus(professionalId, data, newRutPath);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}
