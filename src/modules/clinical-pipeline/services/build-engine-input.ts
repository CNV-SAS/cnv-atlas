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
  // field_key que DECLARA la version de la encuesta (todas las preguntas con field_key de esa
  // version, respondidas o no). Es la lista contra la cual el motor mide dfi.complete (regla 7).
  expectedFieldKeys: string[];
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
// Texto libre de la opcion "Otra"/"Otros": el intake lo guarda como un elemento "Otra: <texto>".
// DOS conductas, decididas por Gildardo (2026-08-13):
//   - d5_39 (diagnosticos personales), §4: el texto libre SI alimenta el motor (es una condicion real del
//     paciente). Se conserva el texto, SIN el prefijo "Otra:" (centinela de UI, no parte de la condicion),
//     para que el match por substring del motor (renal/cancer/diabet) lo lea. El filo conocido (un "sin
//     enfermedad renal" activa la restriccion renal por substring) es responsabilidad del profesional:
//     TODO lo que el motor produzca es editable por el (motor propone, profesional dispone).
//   - Las otras preguntas con "Otra" (§3, las 9 aprobadas): su texto libre es REGISTRO, NO alimenta el
//     motor. Se stripea aqui, en la GLUE, antes de que el frozen lea el campo.
// No toca las cadenas sembradas ni el candado de acoplamiento.
// Cubre las cuatro flexiones (otra/otro/otras/otros), en sync con survey-widgets y survey-completeness.
const isFreeTextOther = (el: string): boolean => /^otr[oa]s?\s*:/i.test(el.trim());
const stripOtherPrefix = (el: string): string => el.replace(/^otr[oa]s?\s*:\s*/i, "");
// Campos cuyo texto libre de "Otra" SI alimenta el motor. d5_39 (diagnosticos personales) desde el inicio;
// d5_38 y d6_44 se suman por RESPUESTA_GILDARDO 2026-08-15 §4 ("el mismo criterio que d5_39: el texto libre
// alimenta el motor, y todo lo que resulte lo puede cambiar el profesional"). Una sola regla para las tres;
// el resto de las "Otra" (§3, registro) se stripea. Inerte hasta que esas preguntas tengan la opcion "Otra"
// (bump de encuesta v5): sin texto "Otra:" que procesar, no cambia nada para las respuestas existentes.
const FREE_TEXT_TO_ENGINE = new Set(["d5_39", "d5_38", "d6_44"]);

function buildSurvey(answers: SurveyFieldAnswer[]): Record<string, unknown> {
  const survey: Record<string, unknown> = {};
  for (const a of answers) {
    if (a.type !== "opcion_multiple") {
      survey[a.fieldKey] = a.value;
      continue;
    }
    const els = decodeMulti(a.value);
    survey[a.fieldKey] = FREE_TEXT_TO_ENGINE.has(a.fieldKey)
      ? els.map(stripOtherPrefix) // d5_39: conserva el texto libre (sin el centinela "Otra:")
      : els.filter((el) => !isFreeTextOther(el)); // resto: registro, no alimenta el motor
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

// Sexo a 'M' | 'F', ESTRICTO (decision A, 2026-08-10). El intake guarda exactamente "F"/"M" (select con
// esos valores). Antes esta funcion adivinaba ("empieza por f -> F, el resto -> M"), y "mujer" caia en M
// en silencio: como todos los clasificadores del motor son sexo-especificos (FFMI, ASMI, umbrales), un
// sexo mal asignado corrompe el diagnostico ENTERO. Ahora NO adivina: acepta F/M (indiferente a
// mayusculas) y ante cualquier otra cosa FALLA EN VOZ ALTA, diciendo QUE valor llego (para no perder una
// hora buscandolo). El frozen (normalizeSexo) valida despues; esta es la barrera que impide que algo que
// no sea F/M exacto llegue al motor.
export function normalizeSex(sex: string | null): Sex {
  const v = (sex ?? "").trim().toUpperCase();
  if (v === "F" || v === "M") return v;
  throw new Error(`normalizeSex: sexo invalido, esperado "F" o "M", llego: ${JSON.stringify(sex)}`);
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
    // La encuesta llega keyed por field_key (d-field) con los multi ya decodificados a array.
    survey: buildSurvey(raw.surveyAnswers),
    // Lista declarada por la version (regla 7): el motor mide dfi.complete contra ella. Viene
    // del reader; si esta vacia, run-pipeline ya fallo antes (no se llega aqui con lista vacia).
    expectedFieldKeys: raw.expectedFieldKeys,
    model,
  };
}
