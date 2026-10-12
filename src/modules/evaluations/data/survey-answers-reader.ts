import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lectura de las respuestas de la encuesta de una evaluacion para la vista del profesional
// (pestana Evaluacion, solo lectura). Devuelve TODAS las preguntas del instrumento (las ~62,
// no solo las de field_key que alimentan el motor), con su respuesta, agrupadas por dominio
// (D1-D8) y ordenadas por order_index. Va por el cliente con sesion: la RLS
// (survey_responses_select / survey_answers_select) solo deja al profesional del paciente (o
// admin) leerlas. Solo display; no toca el motor ni el snapshot.

// Los tipos viven en survey-answers-types (modulo neutro) para no dejar este reader `server-only` al
// alcance del cliente. Se re-exportan para el codigo de servidor que ya los importa desde aqui.
export type { SurveyAnswerView, SurveyDomain } from "./survey-answers-types";
import type { SurveyDomain } from "./survey-answers-types";

type QuestionRow = {
  id: string;
  question_text: string;
  hint?: string | null; // opcional: los tests construyen filas sin este campo
  question_type: string;
  field_key: string | null;
  used_in_diagnosis?: boolean | null; // opcional: los tests construyen filas sin este campo
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
  // number: numeracion CONTINUA 1..N por la posicion en el orden (mismo criterio que survey-reader), para
  // que "pregunta 38" coincida entre la encuesta del paciente y esta vista del profesional.
  sorted.forEach((q, i) => {
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
      number: i + 1,
      questionId: q.id,
      questionText: q.question_text,
      questionHint: q.hint ?? null,
      questionType: q.question_type,
      fieldKey: q.field_key,
      usedInDiagnosis: q.used_in_diagnosis ?? false,
      answerValue: answerByQ.get(q.id) ?? null,
      options: opts,
    });
  });
  return domains;
}

type Cliente = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Las preguntas de UNA version con las respuestas de UNA respuesta (o ninguna). Sale de la funcion de
// abajo para que el formulario de completado pueda pedir el instrumento SIN respuesta, sin repetir las
// tres consultas ni el ensamblado (dos sitios que arman el mismo instrumento acaban difiriendo en el
// orden o en la numeracion, y "pregunta 38" deja de ser la misma pregunta en las dos pantallas).
async function leerInstrumento(
  supabase: Cliente,
  surveyVersionId: string,
  responseId: string | null,
): Promise<SurveyDomain[]> {
  const [questionsRes, answersRes] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id, question_text, hint, question_type, field_key, used_in_diagnosis, section, order_index")
      .eq("survey_version_id", surveyVersionId)
      .order("order_index"),
    responseId
      ? supabase.from("survey_answers").select("question_id, answer_value").eq("response_id", responseId)
      : Promise.resolve({ data: [] as AnswerRow[], error: null }),
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

  return leerInstrumento(supabase, resp.survey_version_id, resp.id);
}

/**
 * ═══ EL INSTRUMENTO PARA COMPLETARLO, EXISTA O NO LA RESPUESTA (Santiago, 2026-10-12) ═══
 *
 * EL CASO REAL: en el lote del HTML del 2 de octubre hay 15 consultas que llegaron con su consentimiento y
 * su medicion completa y CERO respuestas de encuesta. El importador no crea la fila de `survey_responses`
 * cuando no hay ni una respuesta que meter (y hace bien: una respuesta vacia afirmaria que hubo encuesta).
 * Pero entonces `getSurveyAnswersForEvaluation` devolvia null, la pantalla de completar rendia un
 * formulario SIN NINGUNA PREGUNTA, y la puerta del diagnostico ofrecia "Completar la encuesta con el
 * paciente" como salida. **Un enlace que no resuelve nada es peor que ninguno**, y es la regla que ese
 * mismo codigo ya tiene escrita.
 *
 * POR QUE UNA FUNCION APARTE Y NO CAMBIAR LA DE ARRIBA: ese null significa "esta evaluacion no tiene
 * encuesta", y lo leen la historia clinica, el SOAP, los antecedentes y las alertas clinicas. Devolverles
 * 64 preguntas con respuesta nula convertiria "no respondio" en "no refiere", que es una afirmacion
 * clinica FALSA sobre una persona. La distincion entre las dos es la misma que el D8 ya cuida.
 *
 * LA VERSION, cuando no hay respuesta, es la VIGENTE (la ultima publicada, mismo criterio que
 * `getActiveSurvey`): el profesional va a preguntar con el instrumento de hoy, y es lo que el writer
 * sellara en la fila que cree.
 */
export async function getSurveyFormForEvaluation(evaluationId: string): Promise<SurveyDomain[]> {
  const supabase = await createSupabaseServerClient();

  const { data: resp, error: rErr } = await supabase
    .from("survey_responses")
    .select("id, survey_version_id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rErr) throw new Error(`survey-answers-reader: survey_responses: ${rErr.message}`);
  if (resp) return leerInstrumento(supabase, resp.survey_version_id, resp.id);

  const { data: version, error: vErr } = await supabase
    .from("survey_versions")
    .select("id")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vErr) throw new Error(`survey-answers-reader: survey_versions: ${vErr.message}`);
  if (!version) return [];

  return leerInstrumento(supabase, version.id, null);
}
