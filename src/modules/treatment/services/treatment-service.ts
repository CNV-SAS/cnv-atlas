import "server-only";

import { computeProtocoloEfectivo, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";
import { appError } from "@/core/errors/app-error";
import { err, ok, type Result } from "@/core/errors/result";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";

import { getTreatmentForApproval, getTreatmentProtocol } from "../data/treatment-reader";
import { requireConfiguredProfession } from "./require-profession";
import {
  acknowledgeRestrictions as writeAcknowledge,
  addTreatmentNote,
  saveAdjustments as writeAdjustments,
  saveProtocol as writeProtocol,
  TreatmentStateError,
  writeApproveProtocol,
} from "../data/treatment-writer";
import type {
  AcknowledgeRestrictionsInput,
  AddNoteInput,
  ApproveProtocolInput,
  SaveAdjustmentsInput,
  SaveProtocolInput,
} from "../validations";

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
  // Guard interino de ambito de practica: sin profesion configurada no se escribe (ver
  // require-profession.ts). Va tras el not_found (RLS) para no filtrar existencia.
  const prof = await requireConfiguredProfession(actor.actorId);
  if (!prof.ok) return err(prof.error);
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

// T2 A2: ajustes del profesional sobre el sugerido. Ownership por lectura RLS (derivamos el
// treatmentId de la evaluacion; si no es del profesional, el reader devuelve null).
export async function saveAdjustments(
  input: SaveAdjustmentsInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireConfiguredProfession(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(
      appError("conflict", "El diagnostico debe estar confirmado antes de ajustar el protocolo."),
    );
  }
  try {
    await writeAdjustments({
      treatmentId: protocol.treatmentId,
      adjGeb: input.adjGeb,
      adjPal: input.adjPal,
      adjKcalObj: input.adjKcalObj,
      adjProtGkg: input.adjProtGkg,
      adjFatPct: input.adjFatPct,
      adjPesoMeta: input.adjPesoMeta,
      ...actor,
    });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// T2 A2: reconocimiento de las restricciones del modelo (gate del generador de menu).
export async function acknowledgeRestrictions(
  input: AcknowledgeRestrictionsInput,
  actor: Actor,
): Promise<Result<void>> {
  const protocol = await getTreatmentProtocol(input.evaluationId);
  if (!protocol) return err(appError("not_found", "Tratamiento no encontrado."));
  const prof = await requireConfiguredProfession(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (!protocol.diagnosisConfirmed) {
    return err(appError("conflict", "El diagnostico debe estar confirmado."));
  }
  try {
    await writeAcknowledge({ treatmentId: protocol.treatmentId, ...actor });
  } catch (e) {
    if (e instanceof TreatmentStateError) return err(appError("conflict", e.message));
    throw e;
  }
  return ok(undefined);
}

// T2 A3: aprobar el protocolo = sellar la prescripcion EFECTIVA (el acto mas cargado). Gates, y solo
// estos (ver la precondicion de T2b en BACKLOG sobre por que NO se gatea en diagnostico confirmado):
//   - canApproveProtocol (rol profesional; admin NO) -> lo verifica la action.
//   - Asignacion EXPLICITA: el profesional que aprueba es el asignado a la evaluacion (no solo RLS).
//   - status == 'draft' (no re-aprobar).
//   - protocol_suggested no nulo (no se aprueba lo que nunca se computo).
// Sella protocol_approved con el set efectivo (adj_* sobre los inputs sellados del sugerido), LAS DOS
// VERSIONES del motor (la de ahora y la del sugerido) + versionMismatch, y LAS DOS FECHAS (aprobacion
// y medicion BIS), para que la traza no se rompa si el motor subio entre el diagnostico y la aprobacion.
export async function approveProtocol(
  input: ApproveProtocolInput,
  actor: Actor,
): Promise<Result<void>> {
  const t = await getTreatmentForApproval(input.evaluationId);
  if (!t) return err(appError("not_found", "Tratamiento no encontrado."));

  // Chequeo EXPLICITO de asignacion (defensa en profundidad, no solo el read RLS): el
  // professional_profiles.id del actor debe ser el asignado a la evaluacion.
  const professionalId = await getProfessionalProfileIdByUser(actor.actorId);
  if (!professionalId || professionalId !== t.evaluationProfessionalId) {
    return err(appError("forbidden", "No estas asignado a este paciente."));
  }
  // Guard interino de ambito de practica: sin profesion configurada no se prescribe (aprobar es
  // el acto mas cargado). Va tras la asignacion para no filtrar existencia (ver require-profession.ts).
  const prof = await requireConfiguredProfession(actor.actorId);
  if (!prof.ok) return err(prof.error);
  if (t.status !== "draft") {
    return err(appError("conflict", "El protocolo ya fue aprobado."));
  }
  if (!t.protocolSuggested) {
    return err(
      appError("conflict", "No se puede aprobar un protocolo que nunca se computo (sin sugerido)."),
    );
  }

  const suggested = t.protocolSuggested;
  const efectivo = computeProtocoloEfectivo(suggested, t.adjustments);
  const approvedAt = new Date();
  const versionApproved = PROTOCOL_ENGINE_VERSION;
  const versionSuggested = suggested.protocolEngineVersion;

  const protocolApproved = {
    protocolEngineVersionApproved: versionApproved,
    protocolEngineVersionSuggested: versionSuggested,
    versionMismatch: versionApproved !== versionSuggested,
    approvedAt: approvedAt.toISOString(),
    bisMeasurementDate: t.bisMeasurementDate,
    fenotipo: suggested.fenotipo,
    estrategia: suggested.estrategia,
    protMin: suggested.protMin,
    protMax: suggested.protMax,
    protRef: suggested.protRef,
    restricciones: suggested.restricciones,
    examenes: suggested.examenes,
    suplementacion: suggested.suplementacion,
    pesoEfectivo: efectivo.pesoEfectivo,
    ajustes: t.adjustments,
    calorico: efectivo.calorico,
  };

  try {
    await writeApproveProtocol({
      treatmentId: t.treatmentId,
      protocolApproved,
      kcalObjetivo: efectivo.calorico.kcalObj,
      proteinaGramos: efectivo.calorico.protG,
      approvedAt,
      versionApproved,
      versionSuggested,
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
  const prof = await requireConfiguredProfession(actor.actorId);
  if (!prof.ok) return err(prof.error);
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
