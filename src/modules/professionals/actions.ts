"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { sendTaxStatusEmail } from "@/lib/email/resend";
import { requireUser } from "@/modules/auth/session";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";

import { getRutPath, isPdfBuffer, uploadRutPdf } from "./data/rut-storage";
import { documentoTributarioGuardado, saveBankAccount, saveMisDatos, saveTaxIdentity } from "./data/tax-status-writer";
import { getProfessionalEmail } from "./data/tax-verification-reader";
import { rejectTaxRut, verifyTaxStatus } from "./data/tax-verification-writer";
import { canVerifyTaxStatus } from "./policies/can-verify-tax-status";
import { bankHolderMatchesIntegrante, rutNeedsRenewal, validateTaxIdentity } from "./tax-rules";
import {
  bankAccountSchema,
  misDatosSchema,
  taxIdentitySchema,
  taxRejectSchema,
  taxVerifySchema,
  type TaxStatusFormState,
  type TaxVerificationFormState,
} from "./validations";

// Avisa al integrante por correo del resultado de la verificacion. Fuera del camino de respuesta (after):
// operacion, no requisito; un fallo del correo no revierte la verificacion/rechazo.
async function notifyTaxStatus(
  professionalId: string,
  kind: "verified" | "rejected",
  reason?: string,
): Promise<void> {
  const email = await getProfessionalEmail(professionalId);
  if (email) await sendTaxStatusEmail(email, kind, reason);
}

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

// El integrante guarda su parte tributaria (A2): lo que sabe + el RUT. Los campos certificados los llena CNV
// al verificar. El professionalId sale de la sesion; solo escribe su propia fila.
//
// SON DOS ACCIONES desde que el perfil tiene pestañas: esta y la bancaria. La marca de "dio su parte" no la
// pone ninguna de las dos (la calcula el escritor exigiendo las dos mitades); ver el comentario del schema.
export async function saveTaxIdentityAction(
  _prev: TaxStatusFormState,
  formData: FormData,
): Promise<TaxStatusFormState> {
  const user = await requireUser();
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) return fail("Tu cuenta no tiene un perfil profesional.");

  const parsed = taxIdentitySchema.safeParse({
    personType: str(formData, "personType"),
    hasRut: ynBool(formData, "hasRut"),
    idType: str(formData, "idType"),
    idNumber: str(formData, "idNumber"),
    idDv: str(formData, "idDv") || null,
  });
  if (!parsed.success) return fail("Revisa el formulario: falta responder algún campo.");
  const data = parsed.data;

  // Validacion cruzada (reglas puras): juridica sin RUT es imposible, y el DV del NIT debe cuadrar.
  const idErr = validateTaxIdentity(data);
  if (idErr) return fail(idErr);

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

  await saveTaxIdentity(professionalId, data, newRutPath, user.id);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

/**
 * La cuenta a donde se gira el margen.
 *
 * VALIDA EL TITULAR CONTRA EL DOCUMENTO GUARDADO, no contra uno que venga en el envio: partido el formulario,
 * ese numero ya no viaja aqui. Y si no hay documento guardado todavia, NO se acepta la cuenta: sin saber quien
 * es el integrante, "el titular eres tu" no se puede comprobar, y guardarla sin comprobar es justo el
 * requisito tributario que esta regla existe para sostener (dos incidentes reales).
 */
export async function saveBankAccountAction(
  _prev: TaxStatusFormState,
  formData: FormData,
): Promise<TaxStatusFormState> {
  const user = await requireUser();
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) return fail("Tu cuenta no tiene un perfil profesional.");

  const parsed = bankAccountSchema.safeParse({
    bankName: str(formData, "bankName"),
    bankAccountType: str(formData, "bankAccountType"),
    bankAccountNumber: str(formData, "bankAccountNumber"),
    bankAccountHolderName: str(formData, "bankAccountHolderName"),
    bankAccountHolderDocument: str(formData, "bankAccountHolderDocument"),
  });
  if (!parsed.success) return fail("Revisa la cuenta: falta responder algún campo.");

  const documento = await documentoTributarioGuardado(professionalId);
  if (!documento) {
    return fail(
      "Primero completa tus datos tributarios. Tu documento es lo que nos deja comprobar que la cuenta está a tu nombre.",
    );
  }
  if (!bankHolderMatchesIntegrante(documento, parsed.data.bankAccountHolderDocument)) {
    return fail(
      "El documento del titular de la cuenta debe ser el mismo del integrante (por requisito tributario, quien recibe el dinero debe ser quien emite el soporte).",
    );
  }

  await saveBankAccount(professionalId, parsed.data);
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  return { error: null, success: true };
}

// CNV verifica el RUT de un integrante (A2): lee el PDF y registra los campos certificados + la fecha del
// documento. Rol verificador via canVerifyTaxStatus.
export async function verifyTaxStatusAction(
  _prev: TaxVerificationFormState,
  formData: FormData,
): Promise<TaxVerificationFormState> {
  const user = await requireUser();
  if (!canVerifyTaxStatus(user)) return { error: "No autorizado.", success: false };

  const parsed = taxVerifySchema.safeParse({
    professionalId: str(formData, "professionalId"),
    isIncomeDeclarant: ynBool(formData, "isIncomeDeclarant"),
    isVatResponsible: ynBool(formData, "isVatResponsible"),
    mustInvoice: ynBool(formData, "mustInvoice"),
    documentDate: str(formData, "documentDate"),
  });
  if (!parsed.success) return { error: "Revisa la verificación: falta un campo o la fecha del RUT.", success: false };
  const d = parsed.data;

  // Vigencia: un RUT de mas de un año NO se verifica (protege a CNV: la clasificacion vieja retiene mal).
  // Se bloquea y se pide uno actualizado, en vez de marcarlo igual.
  if (rutNeedsRenewal(d.documentDate, new Date())) {
    return {
      error: "Este RUT tiene más de un año (según su fecha). Pídele al integrante uno actualizado antes de verificar.",
      success: false,
    };
  }

  const { verified } = await verifyTaxStatus(
    d.professionalId,
    { id: user.id, email: user.email },
    {
      isIncomeDeclarant: d.isIncomeDeclarant,
      isVatResponsible: d.isVatResponsible,
      mustInvoice: d.mustInvoice,
      documentDate: d.documentDate,
    },
  );
  if (!verified) return { error: "No se pudo verificar (ya estaba verificado o no tiene RUT).", success: false };

  after(() => notifyTaxStatus(d.professionalId, "verified"));
  revalidatePath("/verificaciones");
  revalidatePath("/perfil");
  return { error: null, success: true };
}

// CNV RECHAZA el RUT (vencido, ilegible, no es un RUT), con motivo obligatorio que el integrante ve en su
// banner y por correo, para que suba uno nuevo.
export async function rejectTaxRutAction(
  _prev: TaxVerificationFormState,
  formData: FormData,
): Promise<TaxVerificationFormState> {
  const user = await requireUser();
  if (!canVerifyTaxStatus(user)) return { error: "No autorizado.", success: false };

  const parsed = taxRejectSchema.safeParse({
    professionalId: str(formData, "professionalId"),
    reason: str(formData, "reason"),
  });
  if (!parsed.success) return { error: "Escribe el motivo del rechazo (al menos unas palabras).", success: false };
  const d = parsed.data;

  const { rejected } = await rejectTaxRut(d.professionalId, { id: user.id, email: user.email }, d.reason);
  if (!rejected) return { error: "No se pudo rechazar (ya estaba verificado o no tiene RUT).", success: false };

  after(() => notifyTaxStatus(d.professionalId, "rejected", d.reason));
  revalidatePath("/verificaciones");
  revalidatePath("/perfil");
  return { error: null, success: true };
}

/** Sus datos de contacto. El unico formulario del perfil que edita lo que es SUYO y cambia. */
export async function saveMisDatosAction(
  _prev: TaxStatusFormState,
  formData: FormData,
): Promise<TaxStatusFormState> {
  const user = await requireUser();
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) return fail("Tu cuenta no tiene un perfil profesional.");

  const parsed = misDatosSchema.safeParse({
    phone: str(formData, "phone"),
    officeAddress: str(formData, "officeAddress"),
    officeCity: str(formData, "officeCity"),
  });
  if (!parsed.success) return fail("Revisa los datos: alguno es demasiado largo.");

  await saveMisDatos(professionalId, parsed.data);
  revalidatePath("/perfil");
  return { error: null, success: true };
}
