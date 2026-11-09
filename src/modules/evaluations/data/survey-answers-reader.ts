import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CODIGO_LINEA_BASE } from "../instrumento";
import { insumosDeLaCnvsDeLaConsulta } from "./insumos-de-la-cnvs";
import { instrumentoDeLaConsulta } from "./instrumento-de-la-consulta";
import { getActiveSurvey } from "./survey-reader";
import { versionVigenteDeLaEncuesta } from "./version-vigente-de-la-encuesta";

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
  /** Solo las `opcion_por_producto` (el S1 y el S2): el nombre de cada producto, por id. */
  nombresDeProductos?: Record<string, string>;
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
      nombresDeProductos: q.nombresDeProductos,
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y CUANDO LA CONSULTA APLICO UN INSTRUMENTO (LA CNV-S), SE ENSAMBLA POR EL INSTRUMENTO  ·  2026-11-08
//
// ═══ EL DEFECTO QUE CIERRA, Y ES EL ULTIMO CABLE DE LA CNV-S ═══
//
// La respuesta de una consulta sella la version del CUESTIONARIO, nunca la del Modulo S (ver la nota de
// `survey-reader`: con la del Modulo S, el diagnostico creeria que la encuesta tiene siete campos). Esa
// decision es correcta y tiene un efecto que nadie habia mirado: esta lectura pedia las preguntas DE ESA
// VERSION, asi que las siete respuestas del Modulo S quedaban **guardadas y invisibles**. La profesional
// habria abierto la pestana Evaluacion de un seguimiento CNV-S y no habria visto ni la adherencia, ni los
// eventos del S4, ni los sintomas digestivos: el paciente los contesta, la base los tiene, y ninguna
// pantalla los muestra. Es el mismo genero de defecto que ya cost tres veces aqui (una pieza escrita y no
// renderizada), y habria aparecido en el primer smoke como "el Modulo S no se guardo", que es falso.
//
// ═══ SE ARMA CON EL MISMO LECTOR QUE LA ENCUESTA DEL PACIENTE ═══
//
// `getActiveSurvey(codigo)` es el que pinto el formulario: mismos items, mismo orden, mismas secciones.
// Armar la lista aqui por segunda vez es como la vista del profesional acaba numerando distinto que la
// del paciente, y entonces "pregunta 38" deja de ser la misma pregunta en las dos pantallas.
//
// `used_in_diagnosis` es lo unico que se pide aparte: no viaja en el item del instrumento (y no debe,
// porque es un atributo de la PREGUNTA), y la vista lo usa para marcar las que alimentan el motor.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
async function leerPorInstrumento(
  supabase: Cliente,
  codigo: string,
  /** La respuesta de la consulta, o `null` cuando todavia no hay ninguna (el formulario de completar). */
  responseId: string | null,
  /** El nombre de cada producto indicado en la anterior, por id: lo necesitan el S1 y el S2. */
  nombresDeProductos: Record<string, string>,
): Promise<SurveyDomain[]> {
  const survey = await getActiveSurvey(codigo);
  if (!survey) return [];
  const ids = survey.questions.map((q) => q.id);
  const [answersRes, flagsRes] = await Promise.all([
    responseId
      ? supabase.from("survey_answers").select("question_id, answer_value").eq("response_id", responseId)
      : Promise.resolve({ data: [] as AnswerRow[], error: null }),
    supabase.from("survey_questions").select("id, used_in_diagnosis").in("id", ids),
  ]);
  if (answersRes.error) {
    throw new Error(`survey-answers-reader: survey_answers: ${answersRes.error.message}`);
  }
  if (flagsRes.error) {
    throw new Error(`survey-answers-reader: used_in_diagnosis: ${flagsRes.error.message}`);
  }
  const usadas = new Map((flagsRes.data ?? []).map((f) => [f.id, f.used_in_diagnosis]));
  const questions: QuestionRow[] = survey.questions.map((q, i) => ({
    id: q.id,
    question_text: q.text,
    hint: q.hint,
    question_type: q.type,
    field_key: q.fieldKey,
    used_in_diagnosis: usadas.get(q.id) ?? false,
    section: q.section,
    // LOS NOMBRES SOLO EN LAS PREGUNTAS POR PRODUCTO: en las demas serian un campo que nadie lee, y
    // un campo presente invita a usarlo.
    nombresDeProductos: q.type === "opcion_por_producto" ? nombresDeProductos : undefined,
    // EL ORDEN ES EL DEL INSTRUMENTO, no el de la pregunta: es justo lo que un instrumento cambia (el
    // Modulo S va DELANTE de la encuesta), y por eso se reusa la posicion en la lista ya ordenada.
    order_index: i,
  }));
  const opciones = survey.questions.flatMap((q) =>
    q.options.map((o, i) => ({ question_id: q.id, option_text: o.text, order_index: i })),
  );
  return groupSurveyAnswers(questions, answersRes.data ?? [], opciones);
}

/**
 * EL NOMBRE DE CADA PRODUCTO INDICADO EN LA CONSULTA ANTERIOR, por id, para el S1 y el S2.
 *
 * LA RESPUESTA GUARDA EL ID y hace bien: un nombre comercial cambia y una respuesta sellada no. El
 * precio de eso es que leerla necesita esta vuelta a la base, y por eso se hace UNA vez por pantalla y
 * no una por pregunta.
 *
 * SALE DE `insumos-de-la-cnvs`, que es quien resuelve "la consulta anterior vigente": resolverla aqui
 * otra vez seria la segunda definicion que ese modulo existe para evitar.
 */
async function nombresDeLosProductos(evaluationId: string): Promise<Record<string, string>> {
  const { productos } = await insumosDeLaCnvsDeLaConsulta(evaluationId);
  return Object.fromEntries(productos.map((p) => [p.id, p.nombre]));
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

  // LA LINEA BASE SIGUE POR SU CAMINO DE SIEMPRE, y no es timidez: su instrumento lleva TODAS las
  // preguntas de la version como `repetir`, asi que los dos caminos dan lo mismo (lo comprueba
  // `el-instrumento-no-cambia-la-linea-base-db`), y las 500 consultas que ya existen no tienen por que
  // cambiar de ruta para nada. Solo un instrumento DISTINTO del de siempre necesita el otro ensamblado.
  const codigo = await instrumentoDeLaConsulta(evaluationId);
  if (codigo !== CODIGO_LINEA_BASE) {
    return leerPorInstrumento(supabase, codigo, resp.id, await nombresDeLosProductos(evaluationId));
  }

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

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // Y ESTA PANTALLA TAMBIEN SE ARMA POR EL INSTRUMENTO SELLADO  ·  defecto del smoke, 2026-11-09
  //
  // Textual de Santiago: *"/encuesta/editar abre la encuesta de LINEA BASE: no trae el modulo de
  // seguimiento ni el Cierre, y muestra como no respondidas preguntas que si lo estan"*.
  //
  // LAS DOS MITADES DEL DEFECTO: esto pedia las preguntas de la VERSION sellada en la respuesta, que es
  // la del cuestionario (correcto: ver la nota de `survey-reader`), asi que el Modulo S y el Cierre no
  // aparecian; y el orden era el de la pregunta, no el del instrumento. La profesional abria la encuesta
  // de un seguimiento para completarla y no veia ni la adherencia ni los eventos del S4. La otra mitad,
  // las preguntas confirmadas que salian sin responder, era el arreglo-dentro-del-arreglo del bloque de
  // confirmacion, arreglado aparte.
  //
  // SE DESPACHA IGUAL QUE LA VISTA DE LECTURA, con el mismo lector: dos pantallas de la misma consulta
  // que armen la encuesta de dos maneras es como "pregunta 38" deja de ser la misma pregunta.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  const codigo = await instrumentoDeLaConsulta(evaluationId);
  if (codigo !== CODIGO_LINEA_BASE) {
    return leerPorInstrumento(
      supabase,
      codigo,
      resp?.id ?? null,
      await nombresDeLosProductos(evaluationId),
    );
  }

  if (resp) return leerInstrumento(supabase, resp.survey_version_id, resp.id);

  // LA VERSION VIGENTE SALE DEL INSTRUMENTO, no de "la mas reciente publicada" (2026-11-07). Aquella
  // consulta no filtraba por plantilla, asi que devolvia la fila mas nueva de la TABLA: con el Modulo S
  // en su propia version, esta pantalla habria mostrado siete preguntas de adherencia en vez de la
  // encuesta. La definicion vive en un solo sitio, con su historia.
  const version = await versionVigenteDeLaEncuesta();
  if (!version) return [];

  return leerInstrumento(supabase, version, null);
}
