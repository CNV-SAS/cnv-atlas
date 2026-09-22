import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { bisMeasurements, bisRawValues, evaluations } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";
import { BIODY_COLUMNS } from "@/clinical-engine";

import { filasDeCircunferencias } from "../services/circunferencias-tecleadas";
import { MEASURED_HIPS_HEADER, MEASURED_WAIST_HEADER, normalizeHeader } from "../services/header-map";

// Guarda la cintura y la cadera que el profesional teclea en una consulta IMPORTADA del HTML, y los dos
// indices que dependen de ellas, con la formula de Gildardo. Todo en una transaccion, con audit inline
// (regla dura 8): cambiar un dato de la medicion es un evento clinico.
//
// LAS TRES GUARDAS, en el servidor y no solo en la pantalla:
//   1. la evaluacion tiene que ser IMPORTADA (import_batch_id no nulo);
//   2. no puede tener diagnostico: despues de diagnosticar, cambiar una medida va por la correccion, que
//      versiona (es la misma regla que sella la tabla de composicion);
//   3. y tiene que existir la medicion, que es donde cuelgan los valores.

export class CircunferenciasNoEditablesError extends Error {}

export async function guardarCircunferenciasTecleadas(input: {
  evaluationId: string;
  cintura: number | null;
  cadera: number | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
}): Promise<{ escritas: number }> {
  return db.transaction(async (tx) => {
    const [ev] = await tx
      .select({ id: evaluations.id, importBatchId: evaluations.importBatchId })
      .from(evaluations)
      .where(eq(evaluations.id, input.evaluationId));
    if (!ev) throw new CircunferenciasNoEditablesError("Esa evaluación no existe.");
    if (ev.importBatchId == null) {
      throw new CircunferenciasNoEditablesError(
        "Esta medición no se importó del HTML: la cintura y la cadera se toman en el equipo y llegan en el XLSX.",
      );
    }
    const [medicion] = await tx
      .select({ id: bisMeasurements.id })
      .from(bisMeasurements)
      .where(eq(bisMeasurements.evaluationId, input.evaluationId));
    if (!medicion) throw new CircunferenciasNoEditablesError("Esta evaluación todavía no tiene medición.");

    const headers = {
      cintura: normalizeHeader(MEASURED_WAIST_HEADER),
      cadera: normalizeHeader(MEASURED_HIPS_HEADER),
      icc: normalizeHeader(BIODY_COLUMNS.icc.header),
      ict: normalizeHeader(BIODY_COLUMNS.ict.header),
    };
    // La talla y lo que ya estaba: la talla alimenta el ICT, y las circunferencias que no se tecleen ahora
    // (porque ya estaban) siguen contando para los indices.
    const existentes = await tx
      .select({ name: bisRawValues.variableName, value: bisRawValues.value })
      .from(bisRawValues)
      .where(eq(bisRawValues.measurementId, medicion.id));
    const por = new Map(existentes.map((r) => [r.name, Number(r.value)]));
    const tallaHeader = normalizeHeader(BIODY_COLUMNS.talla.header);

    const filas = filasDeCircunferencias({
      cintura: input.cintura ?? por.get(headers.cintura) ?? null,
      cadera: input.cadera ?? por.get(headers.cadera) ?? null,
      talla: por.get(tallaHeader) ?? null,
      headers,
    })
      // SOLO SE REESCRIBE LO QUE SE TECLEA AHORA, y los indices que dependen de ello. La circunferencia que
      // ya estaba MEDIDA se queda como estaba: reescribirla la convertiria en tecleada sin que nadie la
      // tecleara, y el origen dejaria de decir la verdad.
      .filter(
        (f) =>
          (f.variableName !== headers.cintura || input.cintura != null) &&
          (f.variableName !== headers.cadera || input.cadera != null),
      );
    if (filas.length === 0) return { escritas: 0 };

    // Se reemplazan: una medicion tiene UN valor por variable.
    await tx.delete(bisRawValues).where(
      and(
        eq(bisRawValues.measurementId, medicion.id),
        inArray(
          bisRawValues.variableName,
          filas.map((f) => f.variableName),
        ),
      ),
    );
    await tx.insert(bisRawValues).values(
      filas.map((f) => ({
        measurementId: medicion.id,
        variableName: f.variableName,
        value: String(f.value),
        // CON SU MARCA: un dato tecleado despues no es uno medido, y el origen ya distinguia lo medido de
        // lo derivado.
        origin: "tecleado" as const,
      })),
    );

    await recordAudit(tx, {
      event: "bis.circunferencias_tecleadas",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "evaluation",
      entityId: input.evaluationId,
      payload: {
        cintura: input.cintura,
        cadera: input.cadera,
        indices_recalculados: filas.filter((f) => f.variableName === headers.icc || f.variableName === headers.ict).length,
      },
      ip: input.ip,
    });
    return { escritas: filas.length };
  });
}
