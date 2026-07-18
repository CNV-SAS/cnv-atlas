import "server-only";

import { BIODY_COLUMNS } from "@/clinical-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// Lectura de la composicion corporal (tabla "Niveles de Wang") para la pestaña de Diagnostico.
// Fuente: los crudos BIS de la medicion (bis_raw_values, inmutable por medicion), por RLS
// (bis_raw_values_select gatea por is_patient_professional). Cada variable se resuelve por el
// header EXACTO del contrato Biody (BIODY_COLUMNS) normalizado igual que en el import (B8), asi el
// mapeo no puede desincronizarse. Solo display: no toca el snapshot ni el registry.

export type CompositionRow = {
  label: string;
  value: number | null;
  reference: number | null;
  unit: string;
};
export type CompositionLevel = { title: string; rows: CompositionRow[] };
export type Composition = {
  levels: CompositionLevel[];
  // Derivados para la clasificacion antropometrica (referencia OMS de display).
  imc: number | null;
  cintura: number | null;
  ict: number | null;
  icc: number | null;
};

// Filas de la tabla por nivel de Wang: [etiqueta, clave de valor, clave de referencia|null, unidad].
// Las claves son de BIODY_COLUMNS; se omiten las que el contrato no cubre.
const LEVELS: { title: string; rows: [string, string, string | null, string][] }[] = [
  {
    title: "Nivel V · Cuerpo entero",
    rows: [
      ["Peso", "peso", null, "kg"],
      ["Estatura", "talla", null, "cm"],
      ["IMC", "imc", null, "kg/m²"],
      ["Cintura", "cintura", null, "cm"],
      ["Metabolismo basal (GEB)", "GEB", "GEB_ref", "kcal"],
      ["Gasto energético total (GET)", "GET", null, "kcal"],
    ],
  },
  {
    title: "Nivel IV · Tejidos y sistemas",
    rows: [
      ["Masa grasa", "FM", "FM_ref", "kg"],
      ["Masa grasa", "FM_pct", "FM_pct_ref", "%"],
      ["Masa libre de grasa", "FFM", "FFM_ref", "kg"],
      ["Masa muscular esquelética", "SMM", "SMM_ref", "kg"],
      ["Masa muscular de miembros", "MMEM", "MMEM_ref", "kg"],
      ["Índice de masa libre de grasa (FFMI)", "FFMI", "FFMI_ref", "kg/m²"],
    ],
  },
  {
    title: "Nivel III · Celular",
    rows: [
      ["Masa celular activa", "MCA", "MCA_ref", "kg"],
      ["Sólidos extracelulares", "solEC", "solEC_ref", "kg"],
      ["Masa seca sin grasa", "masaSeca", "masaSeca_ref", "kg"],
      ["Agua extracelular", "ECW", "ECW_ref", "L"],
      ["Agua intracelular", "ICW", "ICW_ref", "L"],
    ],
  },
  {
    title: "Nivel II · Molecular",
    rows: [
      ["Agua corporal total", "TBW", "TBW_ref", "L"],
      ["Hidratación sin grasa", "hidSG", "hidSG_ref", "%"],
      ["Proteína total", "protTotal", "protTotal_ref", "kg"],
      ["Proteína metabólica activa", "protActiva", "protActiva_ref", "kg"],
      ["Contenido mineral óseo", "CMO", "CMO_ref", "kg"],
      ["Mineral no óseo", "minNoOseo", "minNoOseo_ref", "kg"],
    ],
  },
  {
    title: "Bioeléctrico (Cole-Cole)",
    rows: [
      ["Resistencia extracelular (Re)", "Re", null, "Ω"],
      ["Resistencia intracelular (Ri)", "Ri", null, "Ω"],
      ["Resistencia infinita (R∞)", "Rinf", null, "Ω"],
      ["Capacitancia de membrana (C)", "C", null, "nF"],
      ["Ángulo de fase 50 kHz", "AF", null, "°"],
    ],
  },
];

export async function getCompositionForEvaluation(
  evaluationId: string,
): Promise<Composition | null> {
  const supabase = await createSupabaseServerClient();
  const { data: meas, error: mErr } = await supabase
    .from("bis_measurements")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mErr) throw new Error(`composition-reader: bis_measurements: ${mErr.message}`);
  if (!meas) return null;

  const { data: rows, error: rErr } = await supabase
    .from("bis_raw_values")
    .select("variable_name, value")
    .eq("measurement_id", meas.id);
  if (rErr) throw new Error(`composition-reader: bis_raw_values: ${rErr.message}`);

  const raw: Record<string, number> = {};
  for (const r of rows ?? []) {
    const v = Number(r.value);
    if (Number.isFinite(v)) raw[r.variable_name] = v;
  }

  // Valor de una variable por su clave de contrato: header exacto -> normalizeHeader -> crudo.
  const get = (key: string): number | null => {
    const col = BIODY_COLUMNS[key];
    if (!col) return null;
    const v = raw[normalizeHeader(col.header)];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  const levels: CompositionLevel[] = LEVELS.map((lvl) => ({
    title: lvl.title,
    rows: lvl.rows.map(([label, valueKey, refKey, unit]) => ({
      label,
      value: get(valueKey),
      reference: refKey ? get(refKey) : null,
      unit,
    })),
  }));

  return {
    levels,
    imc: get("imc"),
    cintura: get("cintura"),
    ict: get("ict"),
    icc: get("icc"),
  };
}
