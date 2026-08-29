import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { ActiveSurvey } from "./survey-view-types";

// Lectura de la encuesta activa para la pagina publica (sin sesion). Via service
// role: el contenido de la encuesta no es sensible, pero el paciente no tiene
// sesion. Estructura placeholder hasta Gildardo; aqui solo se lee lo que haya.

// Los tipos de la vista viven en survey-view-types (modulo neutro) para que el form y los widgets cliente
// los importen sin el reader server-only. El reader los reexporta para el resto del server.
export type { SurveyOptionView, SurveyQuestionView, ActiveSurvey } from "./survey-view-types";

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
    .select("id, question_text, hint, question_type, section, field_key, order_index, survey_options(id, option_text, order_index)")
    .eq("survey_version_id", version.id)
    .order("order_index", { ascending: true });
  if (qErr) throw new Error(`survey-reader: questions: ${qErr.message}`);

  return {
    surveyVersionId: version.id,
    // number: numeracion CONTINUA 1..N derivada del ORDEN (order_index de la query), no escrita en el
    // texto. Asi agregar una pregunta renumera sola (los huecos de order_index no se propagan). El mismo
    // criterio (posicion en el orden) lo usa survey-answers-reader, para que "pregunta 38" coincida en la
    // encuesta del paciente y en la vista del profesional.
    questions: (questions ?? []).map((q, i) => ({
      id: q.id,
      number: i + 1,
      text: q.question_text,
      hint: q.hint,
      type: q.question_type,
      section: q.section,
      fieldKey: q.field_key,
      options: [...(q.survey_options ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((o) => ({ id: o.id, text: o.option_text })),
    })),
  };
}
