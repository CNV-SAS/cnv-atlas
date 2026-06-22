import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { bisImportLogs, bisMeasurements, bisRawValues } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import type { BisRawValue } from "../types";

// Escritura del import BIS en UNA transaccion de BD. Drizzle conecta como owner para
// poder dejar el audit INLINE (regla dura 8): bis_measurements, bis_raw_values, el log
// 'ok' y el evento bis.imported viajan juntos; si algo falla, no queda nada a medias.
// La autorizacion (que el profesional sea dueno de la evaluacion) se verifica antes,
// en el action, leyendo la evaluacion bajo RLS (regla dura 3).

// La evaluacion ya tiene una medicion: reimportar duplicaria datos clinicos. Se
// rechaza; el servicio la mapea a conflicto. No es un fallo de parseo ni de
// validacion, asi que no genera fila en bis_import_logs.
export class BisAlreadyImportedError extends Error {
  constructor(public readonly evaluationId: string) {
    super(`La evaluacion ${evaluationId} ya tiene una medicion BIS importada.`);
    this.name = "BisAlreadyImportedError";
  }
}

export type BisWriteInput = {
  evaluationId: string;
  deviceId: string | null;
  deviceCalibrationDate: string | null; // 'YYYY-MM-DD' (snapshot al escanear)
  measurementDate: Date;
  values: BisRawValue[];
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type BisWriteResult = { measurementId: string; valueCount: number };

export async function writeBisMeasurement(input: BisWriteInput): Promise<BisWriteResult> {
  return db.transaction(async (tx) => {
    // Guard de reimport dentro de la transaccion (evita TOCTOU): una evaluacion tiene
    // como mucho una medicion en el MVP.
    const existing = await tx
      .select({ id: bisMeasurements.id })
      .from(bisMeasurements)
      .where(eq(bisMeasurements.evaluationId, input.evaluationId))
      .limit(1);
    if (existing.length > 0) throw new BisAlreadyImportedError(input.evaluationId);

    const [measurement] = await tx
      .insert(bisMeasurements)
      .values({
        evaluationId: input.evaluationId,
        deviceId: input.deviceId,
        measurementDate: input.measurementDate,
        deviceCalibrationDate: input.deviceCalibrationDate,
      })
      .returning({ id: bisMeasurements.id });

    // Crudos como pares nombre+valor. numeric se inserta como string para no perder
    // precision (convencion del proyecto, ver payments-writer).
    if (input.values.length > 0) {
      await tx.insert(bisRawValues).values(
        input.values.map((v) => ({
          measurementId: measurement.id,
          variableName: v.variableName,
          value: String(v.value),
        })),
      );
    }

    // Log 'ok' INLINE: el registro del import exitoso es atomico con la medicion.
    await tx.insert(bisImportLogs).values({
      evaluationId: input.evaluationId,
      status: "ok",
      errorDetail: null,
    });

    // Audit inline (regla dura 8). Sin PII: solo ids y conteo de variables.
    await recordAudit(tx, {
      event: "bis.imported",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "bis_measurement",
      entityId: measurement.id,
      payload: { evaluation_id: input.evaluationId, variable_count: input.values.length },
      ip: input.ip,
    });

    return { measurementId: measurement.id, valueCount: input.values.length };
  });
}

export type BisImportFailureStatus = "parse_failed" | "validation_failed";

// Registra un import fallido en bis_import_logs (su proposito explicito). No es
// transaccional: no hay medicion que acompanar. El detalle nunca lleva PII (solo
// describe estructura o nombres de variable y valores fuera de rango). Se acota el
// largo por prudencia.
export async function logBisImportFailure(input: {
  evaluationId: string | null;
  status: BisImportFailureStatus;
  errorDetail: string;
}): Promise<void> {
  await db.insert(bisImportLogs).values({
    evaluationId: input.evaluationId,
    status: input.status,
    errorDetail: input.errorDetail.slice(0, 2000),
  });
}
