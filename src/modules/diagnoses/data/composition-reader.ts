import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { buildComposition, type CompositionCorrections } from "./composition-map";

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
    .select("id, measurement_date")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (mErr) throw new Error(`composition-reader: bis_measurements: ${mErr.message}`);
  if (!meas) return null;

  const { data: rows, error: rErr } = await supabase
    .from("bis_raw_values")
    .select("variable_name, value, origin")
    .eq("measurement_id", meas.id);
  if (rErr) throw new Error(`composition-reader: bis_raw_values: ${rErr.message}`);

  // CORRECCIONES del profesional (0089). Viven APARTE para no pisar el crudo del equipo, que es la
  // evidencia de lo que ese aparato midio. Aqui la correccion GANA sobre el medido, y se guarda cual
  // era el original para que la pantalla pueda decir cual es cual: un peso corregido que se ve igual
  // que uno medido es exactamente el "dos superficies leyendo cosas distintas" que venimos evitando.
  const { data: fixes, error: cErr } = await supabase
    .from("bis_value_corrections")
    .select("variable_name, value, corrected_by_email, corrected_at")
    .eq("measurement_id", meas.id);
  if (cErr) throw new Error(`composition-reader: bis_value_corrections: ${cErr.message}`);

  // Medidos y derivados se muestran igual en la tabla (ambos son valores de composicion); hasDerived
  // solo enciende la nota al pie de procedencia. La distincion fina (que valor es derivado) vive en la
  // columna origin por si en el futuro se marca por fila; hoy la nota basta (EA1 2.4).
  const raw: Record<string, number> = {};
  let hasDerived = false;
  for (const r of rows ?? []) {
    const v = Number(r.value);
    if (Number.isFinite(v)) raw[r.variable_name] = v;
    if (r.origin === "derivado") hasDerived = true;
  }

  const corrections: CompositionCorrections = {};
  for (const f of fixes ?? []) {
    const v = Number(f.value);
    if (!Number.isFinite(v)) continue;
    corrections[f.variable_name] = {
      medido: raw[f.variable_name] ?? null,
      corregido: v,
      porEmail: f.corrected_by_email,
      en: f.corrected_at,
    };
    raw[f.variable_name] = v; // la correccion GANA: es lo que el profesional afirma que midio
  }

  return { ...buildComposition(raw, meas.measurement_date, hasDerived), corrections };
}
