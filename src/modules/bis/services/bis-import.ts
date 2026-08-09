import "server-only";

import { appError, err, ok, type Result } from "@/core/errors";

import {
  BisAlreadyImportedError,
  logBisImportFailure,
  writeBisMeasurement,
} from "../data/bis-writer";
import { validateBisMeasurement } from "../validations/import-schema";
import {
  DERIVED_FORMULA_VERSION,
  deriveMissingComposition,
  type DerivedValue,
} from "./derive-composition";
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

export type ImportBisOutput = {
  measurementId: string;
  valueCount: number;
  derivedCount: number;
};

// Deriva la composicion faltante a partir de lo MEDIDO. La derivacion es un EXTRA: la medicion ya es
// valida sin ella. Si algo revienta (nunca deberia; el helper tolera huecos), se importa lo que hay con
// composicion vacia en vez de tumbar el import. No hay PII que registrar; el audit derived_count queda en 0.
function safeDerive(values: { variableName: string; value: number }[]): DerivedValue[] {
  const measured: Record<string, number> = {};
  for (const v of values) measured[v.variableName] = v.value;
  try {
    // Defensa extra: nunca una fila derivada que colisione con una medida (el helper ya las excluye).
    return deriveMissingComposition(measured).filter((d) => measured[d.variableName] == null);
  } catch (e) {
    console.warn("[bis-import] derivacion de composicion fallo; se importa sin derivar:", e);
    return [];
  }
}

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
  // Derivacion de composicion (EA1): corre por composicion faltante sobre lo medido. El orden lo
  // resuelve derivarFaltantes internamente (re-lee los campos que el mismo deriva: MPM antes de MCA,
  // MCA antes de ECM/BCM), igual que el v8, que lo llama una sola vez.
  const derivedValues = safeDerive(validated.value.values);

  try {
    const written = await writeBisMeasurement({
      evaluationId: input.evaluationId,
      deviceId: input.deviceId,
      deviceCalibrationDate: null, // enlace de equipo/calibracion diferido (B8 minimo)
      measurementDate: validated.value.measurementDate,
      values: validated.value.values,
      derivedValues,
      derivedFormulaVersion: DERIVED_FORMULA_VERSION,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
    });
    return ok(written);
  } catch (e) {
    if (e instanceof BisAlreadyImportedError) {
      return err(
        appError("conflict", "Esta evaluación ya tiene una medición BIS importada."),
      );
    }
    throw e; // error inesperado: que suba (lo captura el action / Sentry)
  }
}
