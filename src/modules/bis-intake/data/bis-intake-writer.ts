import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { bisMeasurements, evaluationBisIntake, evaluations } from "@/db/schema";
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

    // PESO META: NO va en esta tabla. Vive en `evaluations` (migracion 0096) porque es un dato de la
    // consulta y su fila siempre existe; esta es opcional. Comparte formulario con las condiciones porque
    // se llenan en el mismo momento, no porque sean lo mismo, y esa distincion ahora tambien esta en la
    // base. La escritura va abajo, en la misma transaccion.
    const [previo] = await tx
      .select({ pesoMeta: evaluations.weightGoalKg, origen: evaluations.weightGoalSetIn })
      .from(evaluations)
      .where(eq(evaluations.id, input.evaluationId))
      .limit(1);
    const pesoMetaAnterior = previo?.pesoMeta != null ? Number(previo.pesoMeta) : null;
    // La PROCEDENCIA solo cambia si cambia el VALOR: este formulario se re-guarda para corregir las
    // condiciones de la toma, y marcar "entrada" en ese caso borraria el rastro de que lo habia fijado el
    // nutricionista. Un guardado que no toco el dato no puede afirmar quien lo decidio.
    const pesoMetaCambio = pesoMetaAnterior !== input.weightGoalKg;
    const weightGoalSetIn =
      input.weightGoalKg == null
        ? null
        : pesoMetaCambio
          ? "entrada"
          : (previo?.origen ?? "entrada");

    const values = {
      evaluationId: input.evaluationId,
      bisConditionVersionId: input.versionId,
      conditionAnswers: input.answers,
      contraindicated: input.contraindicated,

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

          gripStrengthKg: values.gripStrengthKg,
          updatedAt: sql`now()`,
        },
      });

    // El peso meta, a la EVALUACION. En la MISMA transaccion que las condiciones: se capturan juntos en la
    // pantalla, asi que un guardado a medias dejaria al profesional sin saber que se grabo.
    await tx
      .update(evaluations)
      .set({
        weightGoalKg: input.weightGoalKg == null ? null : String(input.weightGoalKg),
        weightGoalSetIn,
      })
      .where(eq(evaluations.id, input.evaluationId));

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
