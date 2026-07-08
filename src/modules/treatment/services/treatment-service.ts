import "server-only";

import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";

import { getTreatmentProtocol } from "../data/treatment-reader";
import {
  addTreatmentNote,
  saveProtocol as writeProtocol,
  TreatmentStateError,
} from "../data/treatment-writer";
import type { AddNoteInput, SaveProtocolInput } from "../validations";

// Servicio del protocolo de tratamiento (la logica vive aqui; las actions son thin,
// regla 2). Deriva el treatmentId SIEMPRE de una lectura RLS por evaluationId (nunca se
// confia un treatmentId del formulario): si la evaluacion no es del profesional, el reader
// devuelve null y se corta con forbidden. El gate de diagnostico confirmado se verifica
// aqui y se re-chequea en el writer.

type Actor = { actorId: string; actorEmail: string; ip: string | null };

export async function saveProtocol(
  input: SaveProtocolInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  if (!protocol.diagnosisConfirmed) {
    return err(
      appError(
        "conflict",
        "El diagnostico debe estar confirmado (aprueba el reporte) antes de editar el protocolo.",
      ),
    );
  }

  try {
    await writeProtocol({
      treatmentId: protocol.treatmentId,
      kcalObjetivo: input.kcalObjetivo,
      proteinaGramos: input.proteinaGramos,
      restricciones: input.restricciones,
      nutraceuticals: input.nutraceuticals,
      guidelines: input.guidelines,
      ...actor,
    });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

export async function addNote(input: AddNoteInput, actor: Actor): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnostico debe estar confirmado antes de agregar notas."));
  }
  try {
    await addTreatmentNote({ treatmentId: protocol.treatmentId, note: input.note, ...actor });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}
