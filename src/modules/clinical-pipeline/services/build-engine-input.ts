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
  // Fuerza prensil (Kgf) de las condiciones de la toma. Criterio PRIMARIO de fuerza del EWGSOP2; sin
  // ella `dxSarcopenia` corta pidiendo el dato, que es lo correcto. null = no se registro.
  gripStrengthKg: number | null;
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
// AMPLIADO 2026-08-26 tras barrer las DOCE preguntas con opcion "Otra". La lista nombraba tres campos
// (RESPUESTA_GILDARDO 2026-08-15 §4) y nunca se volvio a mirar; no es que las hermanas se excluyeran, es
// que se escribio una vez. El criterio, ahora explicito: el texto libre ALIMENTA al motor cuando el motor
// ACTUA sobre su contenido, y se stripea cuando la respuesta es solo REGISTRO.
//
// Lo que esto arregla es un fallo silencioso en el peor sitio: la lista cerrada cubre los casos COMUNES,
// asi que lo que se perdia eran los RAROS, que son los que el profesional no adivina. Un alergico al kiwi
// marcaba "Otra", escribia "kiwi", y llegaba al motor COMO SI NO TUVIERA ALERGIAS.
//
// DOS DE ESTOS YA ERAN DEFECTO VIVO, no futuro: d2_21 y d5_40 tienen field_key desde siempre, asi que su
// dato ya llegaba y su texto libre ya se estaba tirando. En d2_21 eso significa que un "Otra: me provoco
// vomito" NO encendia la deteccion de metodos (engine.dfi.js:264, atlas-tratamiento.js:88). Y como la
// HISTORIA CLINICA lee crudo (survey-answers-reader, sin pasar por esta glue), el documento mostraba el
// medicamento o el metodo que el motor no habia visto: dos superficies leyendo fuentes distintas.
//
// d8_59 ("¿Quien prepara sus alimentos?") se queda FUERA a proposito: resumen-dieta.ts documenta que su
// "Otra" no se lista por no tener frase canonica. Es exclusion decidida, no olvido.
// d5_42 (contaminantes) se queda fuera por el criterio: es registro, ningun motor actua sobre el.
const FREE_TEXT_TO_ENGINE = new Set([
  "d5_39", // diagnosticos personales (original)
  "d5_38", // antecedentes familiares (original)
  "d6_44", // intolerancias (original)
  "d6_43", // ALERGIAS: seguridad. El alergeno no listado es el que hay que ver.
  "d6_qx", // cirugia digestiva: cambia absorcion y requerimiento proteico
  "d4_34", // patron alimentario: condiciona TODAS las comidas del plan
  "d4_35", // suplementos: para no duplicar el que no esta en la lista
  "d2_21", // metodos para cambiar de peso: alimenta la deteccion de TCA
  "d5_40", // medicamentos actuales: motorTratMedico actua sobre ellos
  "d3_25", // tipo de actividad: la prescripcion de ejercicio actua sobre el
]);

/**
 * El valor de UNA respuesta con la forma que el motor congelado espera: array para los multi-select,
 * string para el resto.
 *
 * EXPORTADA a proposito, y esa es la leccion: habia DOS constructores del `enc` y solo este decodificaba.
 * `dieta-resumen-reader` armaba el suyo dejando los multi como el JSON crudo, asi que el
 * `Array.isArray(e.d5_39)` de `motorTratNutri` daba false y TODAS las comorbilidades del multi-select
 * quedaban en falso: al de ERC no le bajaba la proteina, al de cancer no le subia las calorias, al de
 * dislipidemia no le ponia el limite de grasa saturada. Sin error, sin pantalla rota, con el numero
 * puesto. Quien arme un `enc` para un motor congelado usa ESTA funcion; no escribe la suya.
 */
export function decodeSurveyValue(fieldKey: string, type: string, value: string): unknown {
  if (type !== "opcion_multiple") return value;
  const els = decodeMulti(value);
  return FREE_TEXT_TO_ENGINE.has(fieldKey)
    ? els.map(stripOtherPrefix) // d5_39: conserva el texto libre (sin el centinela "Otra:")
    : els.filter((el) => !isFreeTextOther(el)); // resto: registro, no alimenta el motor
}

function buildSurvey(answers: SurveyFieldAnswer[]): Record<string, unknown> {
  const survey: Record<string, unknown> = {};
  for (const a of answers) survey[a.fieldKey] = decodeSurveyValue(a.fieldKey, a.type, a.value);
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
    fuerzaPrensil: raw.gripStrengthKg,
    model,
  };
}
