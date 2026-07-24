import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { buildComposition } from "./composition-map";

// Lectura de la composicion corporal (tabla "Niveles de Wang") para la pestaña de Diagnostico.
// Fuente: los crudos BIS de la medicion (bis_raw_values, inmutable por medicion), por RLS
// (bis_raw_values_select gatea por is_patient_professional). El mapeo (que header alimenta cada
// fila) vive en composition-map.ts (puro, con candado de test). Solo display: no toca el snapshot.

export type { Composition, CompositionLevel, CompositionRow } from "./composition-map";

export async function getCompositionForEvaluation(
  evaluationId: string,
): Promise<import("./composition-map").Composition | null> {
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

  return buildComposition(raw);
}
