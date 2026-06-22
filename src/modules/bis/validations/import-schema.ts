import { appError, err, ok, type Result } from "@/core/errors";

import { classifyHeaders } from "../services/header-map";
import type { BisRawValue, ExtractedMeasurement, ParsedSheet } from "../types";

// Validacion del export ya parseado: la frontera de confianza critica (SECURITY.md).
// Decide que se persiste y rechaza con detalle lo malformado (-> validation_failed en
// bis_import_logs). NO es la validacion clinica final: los rangos de abajo son un
// subconjunto curado y PROVISIONAL hasta que el motor (B11) fije variables y cortes.

export const MEASUREMENT_DATE_HEADER = "Measurement date";

// Un export real de Biody trae decenas de variables; muchas menos delata un archivo
// que no es el export esperado (otra hoja, plantilla vacia, columnas recortadas).
export const MIN_VARIABLE_COLUMNS = 10;

// Limite global de cordura: descarta NaN/Infinity y magnitudes absurdas. Permite
// negativos (reactancias y desviaciones teoricas lo son legitimamente).
export const GLOBAL_VALUE_ABS_BOUND = 1_000_000;

// Rangos fisiologicos curados (PROVISIONAL, ver arriba). Clave = nombre de variable
// normalizado por header-map. Solo cubre variables claramente identificables; el
// resto pasa por el limite global. Pensados para atrapar errores groseros de import,
// no para juzgar correccion clinica (eso lo firma Gildardo sobre el motor).
export const PHYSIOLOGICAL_RANGES: Record<string, { min: number; max: number }> = {
  "Peso kg": { min: 1, max: 500 },
  "Altura cm": { min: 30, max: 260 },
  Edad: { min: 0, max: 120 },
  "Ángulo de fase a 50 kHz °": { min: 0, max: 30 },
  "Resistencia a 50khz Ohm": { min: 50, max: 2000 },
  "Reactancia à 50khz Ohm": { min: 0, max: 500 },
  "Body Mass Index (BMI) valor kg/m²": { min: 5, max: 80 },
};

// Fecha de Biody: "DD-MM-YYYY HH:MM" (hora opcional). Se interpreta en UTC para que el
// parseo sea determinista e independiente del huso de la maquina; el instante exacto
// es secundario frente a la fecha. Acepta ISO como respaldo. Devuelve null si no es
// una fecha real (valida coherencia de dia/mes/ano).
export function parseBiodyDate(raw: string): Date | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2}))?/.exec(raw.trim());
  if (!m) {
    const iso = new Date(raw);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }
  const [, dd, mm, yyyy, hh = "00", mi = "00"] = m;
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi));
  const coherent =
    d.getUTCFullYear() === +yyyy && d.getUTCMonth() === +mm - 1 && d.getUTCDate() === +dd;
  return coherent ? d : null;
}

// Valida la hoja parseada y extrae una medicion (fecha + valores numericos). Persiste
// fielmente todos los valores numericos de columnas-variable; omite PII y metadata; y
// rechaza el import completo (sin persistir nada parcial) si algun valor cae fuera de
// rango, recogiendo el detalle por variable en AppError.fields.
export function validateBisMeasurement(sheet: ParsedSheet): Result<ExtractedMeasurement> {
  if (sheet.dataRows.length !== 1) {
    return err(
      appError(
        "validation",
        `Se esperaba una unica fila de medicion; el archivo trae ${sheet.dataRows.length}.`,
      ),
    );
  }

  const classes = classifyHeaders(sheet.headers);

  const dateIndex = classes.findIndex((c) => c.role === "measurement_date");
  if (dateIndex === -1) {
    return err(
      appError("validation", `Falta la columna requerida "${MEASUREMENT_DATE_HEADER}".`),
    );
  }

  const variableColumns = classes
    .map((c, index) => ({ c, index }))
    .filter((x) => x.c.role === "variable");
  if (variableColumns.length < MIN_VARIABLE_COLUMNS) {
    return err(
      appError(
        "validation",
        `El archivo tiene muy pocas columnas de variables (${variableColumns.length}); no parece un export de Biody.`,
      ),
    );
  }

  const row = sheet.dataRows[0];

  const dateValue = row.cells[dateIndex]?.value;
  const measurementDate = typeof dateValue === "string" ? parseBiodyDate(dateValue) : null;
  if (!measurementDate) {
    return err(
      appError(
        "validation",
        `La fecha de medicion ("${MEASUREMENT_DATE_HEADER}") es invalida o esta vacia.`,
      ),
    );
  }

  const fields: Record<string, string> = {};
  const values: BisRawValue[] = [];
  for (const { c, index } of variableColumns) {
    const variableName = c.variableName as string;
    const value = row.cells[index]?.value;
    if (value === null || value === undefined) continue; // celda vacia: se omite
    // Valor no numerico en columna-variable: se omite. Segunda red contra fugas de
    // PII (un texto inesperado nunca llega a bis_raw_values, que es numerico).
    if (typeof value !== "number") continue;

    if (!Number.isFinite(value) || Math.abs(value) > GLOBAL_VALUE_ABS_BOUND) {
      fields[variableName] = `Valor fuera del rango admisible: ${value}.`;
      continue;
    }
    const range = PHYSIOLOGICAL_RANGES[variableName];
    if (range && (value < range.min || value > range.max)) {
      fields[variableName] = `Valor ${value} fuera del rango fisiologico [${range.min}, ${range.max}].`;
      continue;
    }
    values.push({ variableName, value });
  }

  if (Object.keys(fields).length > 0) {
    return err(appError("validation", "Una o mas variables estan fuera de rango.", fields));
  }
  if (values.length === 0) {
    return err(appError("validation", "El archivo no contiene ningun valor numerico de variable."));
  }

  return ok({ measurementDate, values });
}
