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

// Respuesta de encuesta ya resuelta a la variable del motor (field_key: d5_39, d3_24...),
// con el tipo de la pregunta para decodificar los multi-select. Solo llegan aqui las
// preguntas con field_key (las que alimentan el motor); el resto del instrumento no.
export type SurveyFieldAnswer = { fieldKey: string; type: string; value: string };

export type RawEvaluationData = {
  sex: string | null;
  birthDate: string | null; // 'YYYY-MM-DD'
  surveyAnswers: SurveyFieldAnswer[];
  bisRaw: Record<string, number>; // header normalizado (B8) -> valor
};

// Decodifica el valor almacenado de una pregunta multi-select a array. El intake guarda
// los multi como JSON (["HTA","Prediabetes"]); si no parsea a array, cae a valor unico o
// vacio. El motor hace Array.isArray sobre estos campos (d2_21, d5_38, d5_39).
function decodeMulti(value: string): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
  } catch {
    // no era JSON; se trata como valor unico abajo
  }
  return [value];
}

// Arma el objeto survey que consume el motor, keyed por field_key (d-field). Los
// multi-select se expanden a array; el resto queda como string. Con al menos un d-field
// presente, el motor corre el DFI completo (hasSurveyData); sin encuesta, degradado.
// Nota (GILDARDO_QUERIES.md Q3): la encuesta no aporta d1_9/d1_10/d1_16, asi que los
// dominios Alimentacion e Hidratacion del LE8 quedan en su valor por defecto. No se
// inventa mapeo: los campos simplemente no estan en el objeto.
function buildSurvey(answers: SurveyFieldAnswer[]): Record<string, unknown> {
  const survey: Record<string, unknown> = {};
  for (const a of answers) {
    survey[a.fieldKey] = a.type === "opcion_multiple" ? decodeMulti(a.value) : a.value;
  }
  return survey;
}

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
    // La encuesta llega keyed por field_key (d-field) con los multi ya decodificados a
    // array. Con al menos un d-field presente, el DFI corre completo (dfi.complete=true).
    survey: buildSurvey(raw.surveyAnswers),
    model,
  };
}
