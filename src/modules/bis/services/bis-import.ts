import "server-only";

import { appError, err, ok, type Result } from "@/core/errors";

import {
  BisAlreadyImportedError,
  logBisImportFailure,
  writeBisMeasurement,
} from "../data/bis-writer";
import { validateBisMeasurement } from "../validations/import-schema";
import { parseBisXlsx } from "./xlsx-parser";

// Orquesta el import BIS: parsear -> validar -> persistir, registrando cada fallo en
// bis_import_logs con su estado (parse_failed / validation_failed) y mapeando todo a
// Result para el action (que no hace throw). La autorizacion y el ownership ya se
// verificaron en el action; aqui se asume una evaluacion legitima del profesional.

export type ImportBisInput = {
  buffer: Buffer | ArrayBuffer;
  evaluationId: string;
  deviceId: string | null;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export type ImportBisOutput = { measurementId: string; valueCount: number };

// Detalle para bis_import_logs: mensaje + errores por campo. Nunca lleva PII (los
// mensajes referencian estructura o nombres de variable y valores, no a la persona).
function detail(message: string, fields?: Record<string, string>): string {
  if (!fields || Object.keys(fields).length === 0) return message;
  const perField = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  return `${message} (${perField})`;
}

export async function importBisMeasurement(
  input: ImportBisInput,
): Promise<Result<ImportBisOutput>> {
  // 1. Parseo estructural. Fallo -> parse_failed.
  const parsed = await parseBisXlsx(input.buffer);
  if (!parsed.ok) {
    await logBisImportFailure({
      evaluationId: input.evaluationId,
      status: "parse_failed",
      errorDetail: detail(parsed.error.message),
    });
    return parsed;
  }

  // 2. Validacion de datos (rangos, fecha, una sola fila). Fallo -> validation_failed.
  const validated = validateBisMeasurement(parsed.value);
  if (!validated.ok) {
    await logBisImportFailure({
      evaluationId: input.evaluationId,
      status: "validation_failed",
      errorDetail: detail(validated.error.message, validated.error.fields),
    });
    return validated;
  }

  // 3. Persistencia transaccional + audit. El reimport es un conflicto, no un fallo de
  //    archivo: se mapea a Result sin fila de log.
  try {
    const written = await writeBisMeasurement({
      evaluationId: input.evaluationId,
      deviceId: input.deviceId,
      deviceCalibrationDate: null, // enlace de equipo/calibracion diferido (B8 minimo)
      measurementDate: validated.value.measurementDate,
      values: validated.value.values,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
    });
    return ok(written);
  } catch (e) {
    if (e instanceof BisAlreadyImportedError) {
      return err(
        appError("conflict", "Esta evaluacion ya tiene una medicion BIS importada."),
      );
    }
    throw e; // error inesperado: que suba (lo captura el action / Sentry)
  }
}
