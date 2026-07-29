import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";

import { getDiagnosisForConfirmation } from "../data/diagnosis-confirm-reader";
import {
  confirmDiagnosis as writeConfirm,
  DiagnosisStateError,
} from "../data/diagnosis-confirm-writer";
import type { ConfirmDiagnosisInput } from "../validations";

type Actor = { actorId: string; actorEmail: string; ip: string | null };

// Confirma el diagnostico de una evaluacion. Gates: ownership por RLS (el reader devuelve null si no
// es del profesional) + chequeo EXPLICITO de asignacion (el professional_profiles.id del actor debe
// ser el asignado a la evaluacion, no solo RLS, mismo criterio que approveProtocol) + no re-confirmar.
export async function confirmDiagnosis(
  input: ConfirmDiagnosisInput,
  actor: Actor,
): Promise<Result<void>> {
  const d = await getDiagnosisForConfirmation(input.evaluationId);
  if (!d) return err(appError("not_found", "Diagnostico no encontrado."));

  const professionalId = await getProfessionalProfileIdByUser(actor.actorId);
  if (!professionalId || professionalId !== d.evaluationProfessionalId) {
    return err(appError("forbidden", "No estas asignado a este paciente."));
  }
  if (d.alreadyConfirmed) {
    return err(appError("conflict", "El diagnostico ya fue confirmado."));
  }

  try {
    await writeConfirm({ diagnosisId: d.diagnosisId, ...actor });
  } catch (e) {
    if (e instanceof DiagnosisStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}
