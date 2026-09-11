import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  declaracionesDesdeRespuesta,
  SIN_DECLARACION,
  type DeclaracionDelPaciente,
} from "@/modules/nutraceuticals/yuxtaposicion-alergenos";

// LO QUE EL PACIENTE DECLARO en la P43 (alergias) y la P44 (intolerancias), textual.
//
// POR QUE UN READER APARTE Y NO `getSurveyAnswersForEvaluation`: ese trae el instrumento completo (~62
// preguntas con sus opciones) para la pestana de Evaluacion. Aqui hacen falta dos respuestas, y el panel
// de tratamiento ya hace nueve consultas: traer la encuesta entera para leer dos campos seria caro en el
// sitio equivocado.
//
// SE BUSCA POR `field_key`, NO POR TEXTO DE PREGUNTA. El texto de la P44 cambio entre versiones (la v6
// anadio los ejemplos entre parentesis) y eso ya costo un defecto real: la migracion 0123 mapeo los
// alergenos buscando por texto y dejo fuera a los pacientes de las versiones viejas. El `field_key` es el
// identificador estable de la pregunta a traves de los bumps.
//
// RLS: va con la sesion del profesional. Si la evaluacion no es suya, no hay filas y devuelve vacio, que
// es el mismo resultado que "no declaro nada". Esa ambiguedad es deliberada y correcta: en los dos casos
// no hay nada que mostrar, y distinguirlos filtraria informacion sobre pacientes ajenos.
const CAMPOS = ["d6_43", "d6_44"] as const;

export async function getDeclaracionesDelPaciente(
  evaluationId: string,
): Promise<DeclaracionDelPaciente> {
  const supabase = await createSupabaseServerClient();

  const { data: resp, error: rErr } = await supabase
    .from("survey_responses")
    .select("id, survey_version_id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rErr) throw new Error(`declaraciones-paciente-reader: survey_responses: ${rErr.message}`);
  if (!resp) return SIN_DECLARACION;

  const { data: preguntas, error: qErr } = await supabase
    .from("survey_questions")
    .select("id, field_key")
    .eq("survey_version_id", resp.survey_version_id)
    .in("field_key", [...CAMPOS]);
  if (qErr) throw new Error(`declaraciones-paciente-reader: survey_questions: ${qErr.message}`);
  if (!preguntas || preguntas.length === 0) return SIN_DECLARACION;

  const { data: respuestas, error: aErr } = await supabase
    .from("survey_answers")
    .select("question_id, answer_value")
    .eq("response_id", resp.id)
    .in(
      "question_id",
      preguntas.map((q) => q.id),
    );
  if (aErr) throw new Error(`declaraciones-paciente-reader: survey_answers: ${aErr.message}`);

  const campoPorPregunta = new Map(preguntas.map((q) => [q.id as string, q.field_key as string]));
  const declaracion: DeclaracionDelPaciente = { alergias: [], intolerancias: [] };
  for (const r of respuestas ?? []) {
    const campo = campoPorPregunta.get(r.question_id as string);
    const textos = declaracionesDesdeRespuesta(r.answer_value as string | null);
    if (campo === "d6_43") declaracion.alergias.push(...textos);
    else if (campo === "d6_44") declaracion.intolerancias.push(...textos);
  }
  return declaracion;
}
