import { BIODY_COLUMNS, type EngineInput, type EngineModelContext, type Sex } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// Arma el EngineInput desde los datos persistidos de una evaluacion. PURO (sin BD).
//
// El motor real consume la fila CRUDA del Biody con los headers EXACTOS del contrato de
// 94 columnas (corre su puerta dura, fail-loud). B8 guarda los crudos con el header
// NORMALIZADO como nombre de variable (normalizeHeader: trim + tokens BiodyLife +
// colapsar espacios). Aqui se reconstruye la fila exacta aplicando la MISMA
// normalizacion al header del contrato: bisRaw[normalizeHeader(BIODY_COLUMNS[f].header)].
// Asi el mapeo es completo (los 94 campos, incluido FM y los secundarios) y no puede
// desincronizarse de B8: usa su misma funcion (fuente unica de la normalizacion).

export type RawEvaluationData = {
  sex: string | null;
  birthDate: string | null; // 'YYYY-MM-DD'
  surveyAnswers: Record<string, string>;
  bisRaw: Record<string, number>; // header normalizado (B8) -> valor
};

// Edad en anos cumplidos desde birthDate hasta now (UTC, determinista). now se inyecta
// para poder testear. Sin fecha o fecha invalida -> 0.
export function computeAge(birthDate: string | null, now: Date): number {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return 0;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - b.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age < 0 ? 0 : age;
}

// Sexo a 'M' | 'F'. El motor revalida y canoniza en su borde (normalizeSexo, fail-loud);
// aqui solo se da forma. Cualquier variante que empiece por f/F -> 'F'; el resto -> 'M'.
export function normalizeSex(sex: string | null): Sex {
  return (sex ?? "").trim().toLowerCase().startsWith("f") ? "F" : "M";
}

// Reconstruye la fila cruda con headers EXACTOS del Biody desde los crudos normalizados
// de B8, aplicando la misma normalizacion a cada header del contrato de columnas.
export function buildBisRow(bisRaw: Record<string, number>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const col of Object.values(BIODY_COLUMNS)) {
    const v = bisRaw[normalizeHeader(col.header)];
    if (typeof v === "number" && Number.isFinite(v)) {
      row[col.header] = v;
    }
  }
  return row;
}

export function buildEngineInput(
  raw: RawEvaluationData,
  model: EngineModelContext,
  now: Date,
): EngineInput {
  return {
    sexo: normalizeSex(raw.sex),
    edad: computeAge(raw.birthDate, now),
    bisRow: buildBisRow(raw.bisRaw),
    // La encuesta se pasa tal cual; el contenido real (IDs d*) se integra en su propio
    // item (post-B11). Hasta entonces el DFI corre degradado (marcado en el output).
    survey: { ...raw.surveyAnswers },
    model,
  };
}
