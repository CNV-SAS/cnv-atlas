import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura de las respuestas de la encuesta de una evaluacion para la vista del profesional
// (pestana Evaluacion, solo lectura). Devuelve TODAS las preguntas del instrumento (las ~62,
// no solo las de field_key que alimentan el motor), con su respuesta, agrupadas por dominio
// (D1-D8) y ordenadas por order_index. Va por el cliente con sesion: la RLS
// (survey_responses_select / survey_answers_select) solo deja al profesional del paciente (o
// admin) leerlas. Solo display; no toca el motor ni el snapshot.

export type SurveyAnswerView = {
  questionId: string;
  questionText: string;
  questionType: string; // texto | numero | opcion | opcion_multiple | contador | escala
  fieldKey: string | null; // marca si alimenta el motor (no se edita aqui: eso es recomputo)
  answerValue: string | null; // opcion: option_text; opcion_multiple: JSON array; numeros: string
  options: string[]; // opciones (option_text) ordenadas; vacio para numero/texto/contador/escala
};

export type SurveyDomain = { section: string; questions: SurveyAnswerView[] };

type QuestionRow = {
  id: string;
  question_text: string;
  question_type: string;
  field_key: string | null;
  section: string | null;
  order_index: number;
};
type AnswerRow = { question_id: string; answer_value: string | null };
type OptionRow = { question_id: string; option_text: string; order_index: number };

// Ensambla el instrumento: cada pregunta (ordenada por order_index) con su respuesta y sus
// opciones, agrupadas por section preservando el orden de aparicion. Puro (sin BD): testeable.
export function groupSurveyAnswers(
  questions: QuestionRow[],
  answers: AnswerRow[],
  options: OptionRow[],
): SurveyDomain[] {
  const answerByQ = new Map(answers.map((a) => [a.question_id, a.answer_value]));
  const optionsByQ = new Map<string, { text: string; order: number }[]>();
  for (const o of options) {
    const list = optionsByQ.get(o.question_id) ?? [];
    list.push({ text: o.option_text, order: o.order_index });
    optionsByQ.set(o.question_id, list);
  }

  const sorted = [...questions].sort((a, b) => a.order_index - b.order_index);
  const domains: SurveyDomain[] = [];
  const bySection = new Map<string, SurveyDomain>();
  for (const q of sorted) {
    const section = q.section ?? "Otras";
    let domain = bySection.get(section);
    if (!domain) {
      domain = { section, questions: [] };
      bySection.set(section, domain);
      domains.push(domain);
    }
    const opts = (optionsByQ.get(q.id) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((o) => o.text);
    domain.questions.push({
      questionId: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      fieldKey: q.field_key,
      answerValue: answerByQ.get(q.id) ?? null,
      options: opts,
    });
  }
  return domains;
}

export async function getSurveyAnswersForEvaluation(
  evaluationId: string,
): Promise<SurveyDomain[] | null> {
  const supabase = await createSupabaseServerClient();

  const { data: resp, error: rErr } = await supabase
    .from("survey_responses")
    .select("id, survey_version_id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rErr) throw new Error(`survey-answers-reader: survey_responses: ${rErr.message}`);
  if (!resp) return null; // aun sin encuesta para esta evaluacion

  const [questionsRes, answersRes] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id, question_text, question_type, field_key, section, order_index")
      .eq("survey_version_id", resp.survey_version_id)
      .order("order_index"),
    supabase.from("survey_answers").select("question_id, answer_value").eq("response_id", resp.id),
  ]);
  if (questionsRes.error) {
    throw new Error(`survey-answers-reader: survey_questions: ${questionsRes.error.message}`);
  }
  if (answersRes.error) {
    throw new Error(`survey-answers-reader: survey_answers: ${answersRes.error.message}`);
  }

  const questions = questionsRes.data ?? [];
  const questionIds = questions.map((q) => q.id);
  const optionsRes = questionIds.length
    ? await supabase
        .from("survey_options")
        .select("question_id, option_text, order_index")
        .in("question_id", questionIds)
        .order("order_index")
    : { data: [], error: null };
  if (optionsRes.error) {
    throw new Error(`survey-answers-reader: survey_options: ${optionsRes.error.message}`);
  }

  return groupSurveyAnswers(questions, answersRes.data ?? [], optionsRes.data ?? []);
}
