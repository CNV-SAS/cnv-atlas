import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { computeCelularBadges, type CelularBadges } from "./celular-badges";

// Lee los crudos BIS de la medicion (misma fuente e RLS que la composicion de Diagnostico:
// bis_raw_values, gateada por is_patient_professional) + el sexo del paciente, y computa las badges
// de salud celular del panel de Tratamiento. Solo display; no toca snapshot ni prescripcion.
//
// Devuelve null si no hay medicion BIS (no hay nada que evaluar). Si hay medicion pero faltan las
// columnas celulares, computeCelularBadges marca dataAvailable=false ("no se pudo evaluar"), distinto
// de "sin alteraciones".

export type { CelularBadges } from "./celular-badges";

export async function getCelularBadgesForEvaluation(
  evaluationId: string,
): Promise<CelularBadges | null> {
  const supabase = await createSupabaseServerClient();

  const { data: meas, error: mErr } = await supabase
    .from("bis_measurements")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mErr) throw new Error(`celular-badges-reader: bis_measurements: ${mErr.message}`);
  if (!meas) return null;

  // Sexo del paciente (para cAF y el umbral sexo-especifico). Via evaluacion -> perfil, bajo RLS.
  const { data: ev, error: eErr } = await supabase
    .from("evaluations")
    .select("patient_id")
    .eq("id", evaluationId)
    .maybeSingle();
  if (eErr) throw new Error(`celular-badges-reader: evaluations: ${eErr.message}`);
  if (!ev) return null;
  const { data: profile, error: pErr } = await supabase
    .from("patient_profiles")
    .select("sex")
    .eq("patient_id", ev.patient_id)
    .maybeSingle();
  if (pErr) throw new Error(`celular-badges-reader: patient_profiles: ${pErr.message}`);
  const sexoM = !(profile?.sex ?? "").toLowerCase().startsWith("f");

  const { data: rows, error: rErr } = await supabase
    .from("bis_raw_values")
    .select("variable_name, value")
    .eq("measurement_id", meas.id);
  if (rErr) throw new Error(`celular-badges-reader: bis_raw_values: ${rErr.message}`);

  const raw: Record<string, number> = {};
  for (const r of rows ?? []) {
    const v = Number(r.value);
    if (Number.isFinite(v)) raw[r.variable_name] = v;
  }

  return computeCelularBadges(raw, sexoM);
}
