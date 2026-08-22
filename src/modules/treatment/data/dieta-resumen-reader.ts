import "server-only";

import { FREQ_OPC, FREQ_SUP } from "@/clinical-engine/frozen/engine.patron.js";
import { resumenDietaParrafo } from "@/clinical-engine/resumen-dieta";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Parrafo de dieta del Resumen Clinico (pieza 1b). Reconstruye la encuesta (enc) de la evaluacion y corre
// resumenDietaParrafo. DISPLAY-ONLY: se computa al vuelo, no se sella (como el resto de la lectura del
// resumen). Todo por RLS (regla 3), como las demas lecturas del profesional.
//
// FORMA DEL enc: la funcion lee los campos de FRECUENCIA (d1_N_i, d1f_*) como INDICE 0-4, pero survey_answers
// guarda el TEXTO. Se convierte texto->ordinal con la MISMA TABLA del motor de patron (FREQ_OPC para los 15
// grupos, FREQ_SUP para los 3 horarios): una sola tabla de conversion, no dos que puedan divergir (su
// acoplamiento lo guarda patron-coupling, y por reusarla, un cambio de texto truena por AMBOS consumidores).
// Los campos de CONTEXTO (d8_*) quedan como TEXTO crudo; los contadores (d7_*) como el texto numerico (toNum).

// Tabla texto->ordinal por field_key de frecuencia (el orden ES el ordinal), identica a la CANON de patron.ts.
const FREQ_CANON: Record<string, string[]> = { ...Object.fromEntries(FREQ_SUP.map((s) => [s.key, s.opts])) };
for (let i = 1; i <= 15; i++) FREQ_CANON[`d1_${i}_i`] = FREQ_OPC;

export async function getDietaResumenForEvaluation(
  evaluationId: string,
  sexo: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data: response, error: rErr } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rErr) throw new Error(`dieta-resumen-reader: survey_responses: ${rErr.message}`);
  if (!response) return null;

  const { data: rows, error: aErr } = await supabase
    .from("survey_answers")
    .select("answer_value, survey_questions!inner(field_key)")
    .eq("response_id", response.id);
  if (aErr) throw new Error(`dieta-resumen-reader: survey_answers: ${aErr.message}`);

  const enc: Record<string, unknown> = { sexo };
  for (const r of rows ?? []) {
    const q = r.survey_questions as unknown as { field_key: string | null } | null;
    const key = q?.field_key;
    if (!key) continue;
    const value = r.answer_value ?? "";
    const canon = FREQ_CANON[key];
    if (canon) {
      // Frecuencia: texto -> ordinal. -1 (no reconocido) se trata como AUSENTE (null), no como 0: un texto
      // no reconocido NO debe leerse como "Nunca". En la practica el candado de patron impide el -1.
      const ord = canon.indexOf(value);
      enc[key] = ord >= 0 ? ord : null;
    } else {
      enc[key] = value; // contexto (texto) y contadores (texto numerico, toNum lo lee)
    }
  }

  const parrafo = resumenDietaParrafo(enc);
  return parrafo === "" ? null : parrafo; // "" = nada legible: se omite (no se muestra un parrafo vacio)
}
