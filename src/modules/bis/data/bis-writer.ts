import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { bisImportLogs, bisMeasurements, bisRawValues, diagnoses } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

import type { DerivedValue } from "../services/derive-composition";
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
  values: BisRawValue[]; // MEDIDOS por el equipo (origin 'medido')
  // DERIVADOS de la composicion que el export corto no trae (EA1). Se insertan en la MISMA
  // transaccion que los medidos: si algo falla, no queda una medicion a medias.
  derivedValues: DerivedValue[];
  derivedFormulaVersion: string; // ESPECTRO_FORMULAS_V con la que se derivo (se sella por fila derivada)
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type BisWriteResult = {
  measurementId: string;
  valueCount: number;
  derivedCount: number;
};

export async function writeBisMeasurement(input: BisWriteInput): Promise<BisWriteResult> {
  return db.transaction(async (tx) => {
    // EL PORTON PASA DE "¿YA HAY MEDICION?" A "¿YA HAY DIAGNOSTICO?" (cotejo 2026-09-05, punto 6).
    //
    // LA INCONSISTENCIA QUE CIERRA, y la encontro Santiago: si el xlsx no parsea o no valida, no se
    // persiste nada y el profesional puede elegir otro archivo. Si parsea, queda bloqueado para siempre.
    // O sea que el sistema dejaba reintentar cuando el archivo era INSERVIBLE y bloqueaba cuando era
    // SERVIBLE PERO DEL PACIENTE EQUIVOCADO, que es el caso que de verdad importa. El porton preguntaba
    // "¿parseo?" cuando lo que decide es "¿ya se emitio algo sobre esto?".
    //
    // DESPUES DEL DIAGNOSTICO SIGUE BLOQUEADO, y eso no cambia: ahi hay un snapshot sellado, un
    // tratamiento y puede haber un reporte enviado. Ese caso se resuelve reiniciando la evaluacion
    // (bloque aparte, BACKLOG), no pisando la medicion por debajo de un diagnostico ya emitido.
    const [diagnostico] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, input.evaluationId))
      .limit(1);
    if (diagnostico) throw new BisAlreadyImportedError(input.evaluationId);

    // Y LA VIEJA SE REEMPLAZA DE VERDAD: se borra ANTES de insertar, en la misma transaccion. Dejarla
    // convertiria "una medicion por evaluacion" en dos, y todo lo que lee la medicion elige "la primera"
    // o "la ultima" sin que nadie lo haya decidido. El borrado arrastra sus valores por la FK en cascada.
    const previas = await tx
      .delete(bisMeasurements)
      .where(eq(bisMeasurements.evaluationId, input.evaluationId))
      .returning({ id: bisMeasurements.id });

    const [measurement] = await tx
      .insert(bisMeasurements)
      .values({
        evaluationId: input.evaluationId,
        deviceId: input.deviceId,
        measurementDate: input.measurementDate,
        deviceCalibrationDate: input.deviceCalibrationDate,
      })
      .returning({ id: bisMeasurements.id });

    // Crudos como pares nombre+valor. numeric se inserta como string para no perder precision
    // (convencion del proyecto, ver payments-writer). Medidos y derivados van en el MISMO insert
    // (misma transaccion, condicion 2): 'medido' es lo que trajo el equipo; 'derivado' lo que
    // reconstruyo la derivacion de composicion, con la version de la formula sellada por fila.
    const rows = [
      ...input.values.map((v) => ({
        measurementId: measurement.id,
        variableName: v.variableName,
        value: String(v.value),
        origin: "medido" as const,
        derivedFormulaVersion: null,
      })),
      ...input.derivedValues.map((v) => ({
        measurementId: measurement.id,
        variableName: v.variableName,
        value: String(v.value),
        origin: "derivado" as const,
        derivedFormulaVersion: input.derivedFormulaVersion,
      })),
    ];
    if (rows.length > 0) {
      await tx.insert(bisRawValues).values(rows);
    }

    // Log 'ok' INLINE: el registro del import exitoso es atomico con la medicion.
    await tx.insert(bisImportLogs).values({
      evaluationId: input.evaluationId,
      status: "ok",
      errorDetail: null,
    });

    // Audit inline (regla dura 8). Sin PII: solo ids y conteos. derived_count > 0 senala que ese archivo
    // venia CORTO (composicion reconstruida): sirve para saber despues que equipos exportan incompleto.
    await recordAudit(tx, {
      event: "bis.imported",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "bis_measurement",
      entityId: measurement.id,
      payload: {
        evaluation_id: input.evaluationId,
        variable_count: input.values.length,
        derived_count: input.derivedValues.length,
        // QUE FUE UN REEMPLAZO Y SOBRE CUAL, que es lo que hace auditable el porton nuevo: sin esto, un
        // reimport se ve igual que un import y no hay forma de saber que hubo una medicion antes.
        // Y NO VA EL NOMBRE DEL ARCHIVO (decision de Santiago, 2026-09-05). El rastro de QUE medicion se
        // reemplazo ya identifica el acto, y el nombre del xlsx suele traer el nombre del paciente: seria
        // meter PII en un log de auditoria que se conserva y se consulta por otras razones.
        replaced_measurement_ids: previas.map((m) => m.id),
      },
      ip: input.ip,
    });

    return {
      measurementId: measurement.id,
      valueCount: input.values.length,
      derivedCount: input.derivedValues.length,
    };
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
