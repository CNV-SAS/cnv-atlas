import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { bisMeasurements, evaluationBisIntake } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import type { BisConditionAnswers } from "../types";

// Escritura de la captura de condiciones BIS en UNA transaccion (Drizzle owner) con el audit
// INLINE (regla dura 8): la captura y el evento bis.conditions.recorded viajan juntos. La
// autorizacion (que la evaluacion sea del profesional) se verifico antes en el action, bajo RLS.

export type WriteBisIntakeInput = {
  evaluationId: string;
  versionId: string;
  answers: BisConditionAnswers; // ya validadas y selladas (con acknowledgedAt)
  contraindicated: boolean;
  weightGoalKg: number | null;
  gripStrengthKg: number | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// existingMeasurementDespiteContraindication: hay una medicion BIS previa Y se marco
// contraindicacion. NO se borra (es registro clinico, regla dura 14 y semantica de historia); el
// action/UI avisan que la medicion es anterior a la contraindicacion.
export type WriteBisIntakeResult = { existingMeasurementDespiteContraindication: boolean };

export async function writeBisConditionsIntake(
  input: WriteBisIntakeInput,
): Promise<WriteBisIntakeResult> {
  return db.transaction(async (tx) => {
    // Caso borde: ya existe una medicion BIS (p.ej. importada antes de este bloque, como el Demo
    // GoldenPath). No se toca. Solo se detecta para avisar si ademas hay contraindicacion.
    const existing = await tx
      .select({ id: bisMeasurements.id })
      .from(bisMeasurements)
      .where(eq(bisMeasurements.evaluationId, input.evaluationId))
      .limit(1);
    const hasMeasurement = existing.length > 0;

    const values = {
      evaluationId: input.evaluationId,
      bisConditionVersionId: input.versionId,
      conditionAnswers: input.answers,
      contraindicated: input.contraindicated,
      weightGoalKg: input.weightGoalKg == null ? null : String(input.weightGoalKg),
      gripStrengthKg: input.gripStrengthKg == null ? null : String(input.gripStrengthKg),
    };

    // Una captura por evaluacion (unique en evaluation_id): re-guardar actualiza el sello.
    await tx
      .insert(evaluationBisIntake)
      .values(values)
      .onConflictDoUpdate({
        target: evaluationBisIntake.evaluationId,
        set: {
          bisConditionVersionId: values.bisConditionVersionId,
          conditionAnswers: values.conditionAnswers,
          contraindicated: values.contraindicated,
          weightGoalKg: values.weightGoalKg,
          gripStrengthKg: values.gripStrengthKg,
          updatedAt: sql`now()`,
        },
      });

    // Audit inline (regla dura 8). Sin PII: ids, version, el flag de contraindicacion y las claves
    // de advertencias reconocidas (no la persona ni el detalle).
    await recordAudit(tx, {
      event: "bis.conditions.recorded",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: {
        evaluation_id: input.evaluationId,
        version_id: input.versionId,
        contraindicated: input.contraindicated,
        warnings_acknowledged: Object.entries(input.answers)
          .filter(([, a]) => a.acknowledgedAt)
          .map(([k]) => k),
        existing_measurement: hasMeasurement,
      },
      ip: input.ip,
    });

    return {
      existingMeasurementDespiteContraindication: input.contraindicated && hasMeasurement,
    };
  });
}
