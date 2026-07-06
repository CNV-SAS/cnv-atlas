import { BIODY_COLUMNS, type EngineInput, type EngineModelContext, type Sex } from "@/clinical-engine";

// Arma el EngineInput desde los datos persistidos de una evaluacion. PURO (sin BD).
//
// El motor real consume la fila CRUDA del Biody con los headers EXACTOS del contrato de
// 94 columnas (corre su puerta dura, fail-loud). B8 guarda los crudos con headers
// NORMALIZADOS, asi que aqui se reconstruye la fila exacta: engineField -> header exacto
// (BIODY_COLUMNS) tomando el valor de bisRaw por el header normalizado de B8.
//
// El mapa header-normalizado <- engineField es PROVISIONAL/incompleto (le falta FM y los
// secundarios); se completa y se verifica contra el sample real en ST6 (cierre del
// PROVISIONAL_BIS_MAP). Mientras tanto, si falta un insumo requerido, el motor LANZA
// (fail-loud), que es el comportamiento correcto: nunca un diagnostico con datos a medias.

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

// engineField -> header NORMALIZADO de B8 (bis_raw_values.variable_name). PROVISIONAL,
// se cierra en ST6 (faltan FM y los secundarios FFW/MCA_dif/ECW_sg/ICW_sg).
export const PROVISIONAL_FIELD_TO_B8HEADER: Record<string, string> = {
  Re: "Extracellular resistance",
  Ri: "Intracellular resistance Ω",
  Rinf: "Infinite resistance",
  C: "Membrane capacitance nF",
  FFMI: "Indice de masa sin grasa (FFMI) valor kg/m²",
  FFM: "Masa sin grasa valor kg",
  peso: "Peso kg",
  talla: "Altura cm",
  imc: "Body Mass Index (BMI) valor kg/m²",
  AF: "Ángulo de fase a 50 kHz °",
  IR: "Impedance Ratio (IR)",
  MCA: "Masa celular activa valor kg",
  MCA_ref: "Masa celular activa referencia kg",
  smmW: "Skeletal muscle mass over weight (SMM/W) valor %",
  ASMI: "Indice de masa muscular esquelética des membres (ASMI) valor kg/m²",
  ECW: "Extracellular water valor L",
  ICW: "Intracellular water (ICW) valor L",
};

// Reconstruye la fila cruda con headers EXACTOS del Biody desde los crudos normalizados.
function buildBisRow(bisRaw: Record<string, number>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, b8Header] of Object.entries(PROVISIONAL_FIELD_TO_B8HEADER)) {
    const col = BIODY_COLUMNS[field];
    const v = bisRaw[b8Header];
    if (col && typeof v === "number" && Number.isFinite(v)) {
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
