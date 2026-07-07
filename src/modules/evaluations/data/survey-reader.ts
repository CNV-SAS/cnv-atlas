import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Lectura de la encuesta activa para la pagina publica (sin sesion). Via service
// role: el contenido de la encuesta no es sensible, pero el paciente no tiene
// sesion. Estructura placeholder hasta Gildardo; aqui solo se lee lo que haya.

export type SurveyOptionView = { id: string; text: string };
export type SurveyQuestionView = {
  id: string;
  text: string;
  type: string; // texto, numero, opcion, opcion_multiple
  options: SurveyOptionView[];
};
export type ActiveSurvey = {
  surveyVersionId: string;
  questions: SurveyQuestionView[];
};

// Devuelve la version mas reciente publicada de la encuesta con sus preguntas y
// opciones ordenadas. En el MVP hay una sola plantilla/version (la del seed).
export async function getActiveSurvey(): Promise<ActiveSurvey | null> {
  const supabase = createSupabaseAdminClient();

  const { data: version, error: vErr } = await supabase
    .from("survey_versions")
    .select("id")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vErr) throw new Error(`survey-reader: version: ${vErr.message}`);
  if (!version) return null;

  const { data: questions, error: qErr } = await supabase
    .from("survey_questions")
    .select("id, question_text, question_type, order_index, survey_options(id, option_text, order_index)")
    .eq("survey_version_id", version.id)
    .order("order_index", { ascending: true });
  if (qErr) throw new Error(`survey-reader: questions: ${qErr.message}`);

  return {
    surveyVersionId: version.id,
    questions: (questions ?? []).map((q) => ({
      id: q.id,
      text: q.question_text,
      type: q.question_type,
      options: [...(q.survey_options ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((o) => ({ id: o.id, text: o.option_text })),
    })),
  };
}
