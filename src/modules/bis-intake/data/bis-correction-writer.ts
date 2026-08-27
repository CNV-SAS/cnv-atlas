import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { bisMeasurements, bisValueCorrections, diagnoses, evaluations } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// CORRECCION DE UNA MEDIDA ANTROPOMETRICA. Ver la migracion 0089 para el porque de la tabla aparte.
//
// Las CUATRO que se pueden corregir, y no es una lista arbitraria: son las que el profesional toma con
// cinta o bascula y que el equipo puede traer mal o no traer. La edad y el sexo NO (en su archivo
// tampoco son editables), y la fuerza prensil TAMPOCO, porque ya se captura en el bloque de condiciones
// BIS y tener dos sitios para editar el mismo dato es peor que no tener ninguno.
export const CORREGIBLES = ["peso", "talla", "cintura", "cadera"] as const;
export type VariableCorregible = (typeof CORREGIBLES)[number];

export class BisCorrectionError extends Error {}

/**
 * Corrige una medida de la medicion BIS de una evaluacion.
 *
 * SOLO ANTES DEL DIAGNOSTICO. Despues, la evaluacion queda sellada y el camino es el flujo de
 * correccion, que versiona evaluacion, diagnostico y reporte sin sobrescribir. La regla no es nueva:
 * la captura de condiciones BIS ya deja de ser editable tras el diagnostico, y esta la hereda. El
 * argumento de fondo es clinico y no tecnico: **cambiar una medicion sobre la que YA se emitio un
 * diagnostico no es una edicion, es una correccion, y tiene que dejar version.**
 *
 * El crudo del equipo NO se toca: la correccion vive en su propia tabla y el reader la hace ganar.
 */
export async function correctBisValue(input: {
  evaluationId: string;
  variableName: VariableCorregible;
  value: number;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  if (!(input.value > 0)) throw new BisCorrectionError("El valor debe ser mayor que cero.");

  await db.transaction(async (tx) => {
    const [med] = await tx
      .select({ id: bisMeasurements.id })
      .from(bisMeasurements)
      .where(eq(bisMeasurements.evaluationId, input.evaluationId))
      .limit(1);
    if (!med) throw new BisCorrectionError("Esta evaluación no tiene una medición BIS que corregir.");

    // EL GATE, dentro de la transaccion y no en la pantalla: un boton oculto no es un candado. Si el
    // diagnostico ya existe, la medicion esta sellada.
    const [diag] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .limit(1);
    if (diag) {
      throw new BisCorrectionError(
        "El diagnóstico ya se generó sobre esta medición. Para cambiarla, usa Corregir la evaluación: " +
          "así queda una versión nueva y no se reescribe lo que ya se emitió.",
      );
    }

    const [evalRow] = await tx
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(eq(evaluations.id, input.evaluationId))
      .limit(1);
    if (!evalRow) throw new BisCorrectionError("Evaluación no encontrada.");

    await tx
      .insert(bisValueCorrections)
      .values({
        measurementId: med.id,
        variableName: input.variableName,
        value: String(input.value),
        correctedBy: input.actorId,
        correctedByEmail: input.actorEmail,
      })
      // Corregir dos veces la misma medida no es historia, es la misma correccion: gana la ultima. El
      // rastro completo de intentos vive en el audit log, que es donde va la traza.
      .onConflictDoUpdate({
        target: [bisValueCorrections.measurementId, bisValueCorrections.variableName],
        set: {
          value: String(input.value),
          correctedBy: input.actorId,
          correctedByEmail: input.actorEmail,
        },
      });

    // Inline en la transaccion (regla dura 8), nunca por el bus.
    await recordAudit(tx, {
      event: "bis.value_corrected",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "bis_measurement",
      entityId: med.id,
      payload: {
        evaluation_id: input.evaluationId,
        variable: input.variableName,
        value: input.value,
      },
      ip: input.ip,
    });
  });
}

/** Quita la corrección y devuelve la medida al valor del equipo. */
export async function clearBisCorrection(input: {
  evaluationId: string;
  variableName: VariableCorregible;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [med] = await tx
      .select({ id: bisMeasurements.id })
      .from(bisMeasurements)
      .where(eq(bisMeasurements.evaluationId, input.evaluationId))
      .limit(1);
    if (!med) throw new BisCorrectionError("Esta evaluación no tiene una medición BIS.");

    const [diag] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .limit(1);
    if (diag) throw new BisCorrectionError("El diagnóstico ya se generó sobre esta medición.");

    await tx
      .delete(bisValueCorrections)
      .where(
        and(
          eq(bisValueCorrections.measurementId, med.id),
          eq(bisValueCorrections.variableName, input.variableName),
        ),
      );

    // Volver al valor del equipo tambien es una decision, y deja rastro igual que corregir.
    await recordAudit(tx, {
      event: "bis.correction_cleared",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "bis_measurement",
      entityId: med.id,
      payload: { evaluation_id: input.evaluationId, variable: input.variableName },
      ip: input.ip,
    });
  });
}
