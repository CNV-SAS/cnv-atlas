import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";

import { getDiagnosisCriterion } from "../data/diagnosis-notes-reader";
import { addDiagnosisNote as writeDiagnosisNote } from "../data/diagnosis-notes-writer";
import type { AddDiagnosisNoteInput } from "../validations";

type Actor = { actorId: string; actorEmail: string; ip: string | null };

// Agrega una nota de criterio del profesional al diagnostico de una evaluacion. El ownership se
// resuelve por RLS: getDiagnosisCriterion devuelve null si el diagnostico no es de un paciente
// del profesional (o si aun no hay diagnostico), y entonces no se escribe.
export async function addDiagnosisNote(
  input: AddDiagnosisNoteInput,
  actor: Actor,
): Promise<Result<void>> {
  const criterion = await getDiagnosisCriterion(input.evaluationId);
  if (!criterion) return err(appError("not_found", "Diagnostico no encontrado."));
  await writeDiagnosisNote({ diagnosisId: criterion.diagnosisId, note: input.note, ...actor });
  return ok(undefined);
}
