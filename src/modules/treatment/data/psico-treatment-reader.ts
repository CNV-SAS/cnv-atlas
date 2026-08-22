import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
// El motor psicologico congelado (D-008). Solo lee la encuesta (ignora bis). Su salida es
// PROFESIONAL-FACING: nada llega al paciente. DISPLAY-ONLY: se computa al vuelo, NO se sella tcaFlag
// ni entra al pipeline (la cadena calorica que lo consumiria no existe; si llega, esto sube a carril
// lento). Ver acuerdo de dos carriles en ARCHITECTURE.
// El que CORRE es el .authorized (original + modificaciones autorizadas; CA-2 corrige el mensaje de la
// salvaguarda de TCA). El original queda intacto como referencia byte-identica a Gildardo.
import { motorTratPsico } from "@/clinical-engine/frozen/atlas-tratamiento.authorized.js";

export type PsicoTreatment = {
  tamizaje: { inst: string; res: string }[];
  enfoque: string[];
  temas: string[];
  tcaFlag: boolean;
  remision: string[];
  salvaguarda: string | null;
  estres: number;
  // El nivel de estres (d3_29) se CAPTURO en la encuesta? d3_29 SI tiene field_key (treatmentEngine): es true
  // cuando el paciente lo respondio. Distingue "no capturado" de un negativo, para no leer "-/10" como dato.
  // (El comentario anterior decia "no tiene field_key, false siempre"; quedo stale, d3_29 lo tiene.)
  estresCaptured: boolean;
};

// Decodifica un multi-select guardado como JSON (["Vómito",...]) a array; si no es JSON, valor unico.
function decodeMulti(value: string | null): unknown {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // no era JSON
  }
  return value;
}

// Reconstruye la encuesta (enc keyed por field_key) de la evaluacion y corre el motor psicologico.
// null si no hay respuesta de encuesta (nada que tamizar). Todo por RLS (regla 3), como el resto de
// las lecturas del profesional.
export async function getPsicoTreatmentForEvaluation(
  evaluationId: string,
): Promise<PsicoTreatment | null> {
  const supabase = await createSupabaseServerClient();

  const { data: response, error: rErr } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rErr) throw new Error(`psico-treatment-reader: survey_responses: ${rErr.message}`);
  if (!response) return null;

  const { data: rows, error: aErr } = await supabase
    .from("survey_answers")
    .select("answer_value, survey_questions!inner(field_key, question_type)")
    .eq("response_id", response.id);
  if (aErr) throw new Error(`psico-treatment-reader: survey_answers: ${aErr.message}`);

  // enc por field_key: los multi-select se decodifican a array (el motor hace Array.isArray sobre
  // d2_21); el resto queda como string. Solo llegan al motor los campos con field_key.
  const enc: Record<string, unknown> = {};
  for (const r of rows ?? []) {
    const q = r.survey_questions as unknown as { field_key: string | null; question_type: string } | null;
    if (!q?.field_key) continue;
    enc[q.field_key] =
      q.question_type === "opcion_multiple" ? decodeMulti(r.answer_value) : (r.answer_value ?? "");
  }

  const out = motorTratPsico(enc, {}) as Omit<PsicoTreatment, "estresCaptured">;
  return { ...out, estresCaptured: "d3_29" in enc };
}
