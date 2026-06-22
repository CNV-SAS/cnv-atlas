import type { EngineBisInput, EngineInput, EngineModelContext, Sex } from "@/clinical-engine";

// Arma el EngineInput desde los datos persistidos de una evaluacion. PURO (sin BD):
// recibe los datos ya leidos y devuelve el input tipado del motor.
//
// El mapeo de los nombres crudos de BIS (header normalizado de B8) a los campos
// canonicos del contrato (Re, Ri, ...) es PROVISIONAL y se cierra en B11 contra el
// motor real. Hoy el stub no consume estos valores; el mapeo solo da forma valida al
// input para que la propagacion fluya. Los tests de propagacion usan EngineInput
// sinteticos, asi que no dependen de este mapeo.

export type RawEvaluationData = {
  sex: string | null;
  birthDate: string | null; // 'YYYY-MM-DD'
  surveyAnswers: Record<string, string>;
  bisRaw: Record<string, number>; // nombre normalizado -> valor (de bis_raw_values)
};

// Edad en anos cumplidos desde birthDate hasta now (UTC, determinista). now se inyecta
// para poder testear. Sin fecha o fecha invalida -> 0 (provisional).
export function computeAge(birthDate: string | null, now: Date): number {
  if (!birthDate) return 0;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return 0;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - b.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < b.getUTCDate())) age -= 1;
  return age < 0 ? 0 : age;
}

// Sexo a 'M' | 'F'. Provisional y tolerante: cualquier variante que empiece por f/F
// (femenino, female, F) -> 'F'; el resto -> 'M'. B11 afina contra el modelo real.
export function normalizeSex(sex: string | null): Sex {
  return (sex ?? "").trim().toLowerCase().startsWith("f") ? "F" : "M";
}

// Campos del contrato BIS que SI mapeamos provisionalmente (los demas, opcionales como
// iscm/iehh/iae/eb, quedan sin asignar). Valor = nombre normalizado en bis_raw_values.
type MappedBisField =
  | "Re" | "Ri" | "Rinf" | "C"
  | "FMI" | "FFMI" | "MCA" | "MCA_ref"
  | "smmW" | "ASMI" | "AF" | "IR"
  | "ECW" | "ICW" | "FFM"
  | "peso" | "talla" | "imc";

export const PROVISIONAL_BIS_MAP: Record<MappedBisField, string> = {
  Re: "Extracellular resistance",
  Ri: "Intracellular resistance Ω",
  Rinf: "Infinite resistance",
  C: "Membrane capacitance nF",
  FMI: "Indice de masa grasa (FMI) valor kg/m²",
  FFMI: "Indice de masa sin grasa (FFMI) valor kg/m²",
  MCA: "Masa celular activa valor kg",
  MCA_ref: "Masa celular activa referencia kg",
  smmW: "Skeletal muscle mass over weight (SMM/W) valor %",
  ASMI: "Indice de masa muscular esquelética des membres (ASMI) valor kg/m²",
  AF: "Ángulo de fase a 50 kHz °",
  IR: "Impedance Ratio (IR)",
  ECW: "Extracellular water valor L",
  ICW: "Intracellular water (ICW) valor L",
  FFM: "Masa sin grasa valor kg",
  peso: "Peso kg",
  talla: "Altura cm",
  imc: "Body Mass Index (BMI) valor kg/m²",
};

function num(bisRaw: Record<string, number>, header: string): number {
  const v = bisRaw[header];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function buildBis(bisRaw: Record<string, number>): EngineBisInput {
  const m = PROVISIONAL_BIS_MAP;
  return {
    Re: num(bisRaw, m.Re),
    Ri: num(bisRaw, m.Ri),
    Rinf: num(bisRaw, m.Rinf),
    C: num(bisRaw, m.C),
    FMI: num(bisRaw, m.FMI),
    FFMI: num(bisRaw, m.FFMI),
    MCA: num(bisRaw, m.MCA),
    MCA_ref: num(bisRaw, m.MCA_ref),
    smmW: num(bisRaw, m.smmW),
    ASMI: num(bisRaw, m.ASMI),
    AF: num(bisRaw, m.AF),
    IR: num(bisRaw, m.IR),
    ECW: num(bisRaw, m.ECW),
    ICW: num(bisRaw, m.ICW),
    FFM: num(bisRaw, m.FFM),
    peso: num(bisRaw, m.peso),
    talla: num(bisRaw, m.talla),
    imc: num(bisRaw, m.imc),
  };
}

export function buildEngineInput(
  raw: RawEvaluationData,
  model: EngineModelContext,
  now: Date,
): EngineInput {
  return {
    sexo: normalizeSex(raw.sex),
    edad: computeAge(raw.birthDate, now),
    bis: buildBis(raw.bisRaw),
    survey: { ...raw.surveyAnswers },
    model,
  };
}
