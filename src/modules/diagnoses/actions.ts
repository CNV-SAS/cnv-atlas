"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";

import { canAddDiagnosisNote } from "./policies/can-add-diagnosis-note";
import { canConfirmDiagnosis } from "./policies/can-confirm-diagnosis";
import { confirmDiagnosis } from "./services/diagnosis-confirm-service";
import { addDiagnosisNote } from "./services/diagnosis-notes-service";
import { addDiagnosisNoteSchema, confirmDiagnosisSchema } from "./validations";

// Action de la nota de criterio del profesional (thin, regla 2): autoriza por policy, valida
// con Zod y delega en el service. El estado sigue el shape generico de useFormToast.
export type DiagnosisActionState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

const fail = (error: string): DiagnosisActionState => ({ error, success: null, warning: null });

export async function addDiagnosisNoteAction(
  _prev: DiagnosisActionState,
  form: FormData,
): Promise<DiagnosisActionState> {
  const user = await requireUser();
  if (!canAddDiagnosisNote(user)) return fail("No autorizado.");

  const parsed = addDiagnosisNoteSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    note: (form.get("note") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Criterio invalido.");
  }

  const ip = await getClientIp();
  const result = await addDiagnosisNote(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Criterio agregado.", warning: null };
}

// Confirma el diagnostico (mini-bloque): la firma clinica que habilita prescribir. PROFESIONAL-SOLO
// (admin no); la asignacion explicita y el estado los verifica el service.
export async function confirmDiagnosisAction(
  _prev: DiagnosisActionState,
  form: FormData,
): Promise<DiagnosisActionState> {
  const user = await requireUser();
  if (!canConfirmDiagnosis(user)) return fail("No autorizado.");

  const parsed = confirmDiagnosisSchema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Evaluacion invalida.");
  }

  const ip = await getClientIp();
  const result = await confirmDiagnosis(parsed.data, {
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Diagnostico confirmado.", warning: null };
}
