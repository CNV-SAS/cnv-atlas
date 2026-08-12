import "server-only";

import { getActiveSurvey } from "@/modules/evaluations/data/survey-reader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Disponibilidad del flujo de correccion para una evaluacion (CP3 de PLAN_S2_CORRECCION). Hoy el unico
// bloqueo es la VERSION de encuesta: el frozen esta acoplado char-by-char a la encuesta vigente, asi que
// una evaluacion hecha con una version anterior no se puede recalcular con el motor de hoy (el servicio
// correctEvaluation lo rechaza). La UI lo muestra como ESTADO (boton deshabilitado con la razon), no como
// un error al pulsar. En el MVP de una sola version de encuesta es no-op (siempre disponible), pero deja
// la superficie honesta para cuando haya mas de una version.

export type CorrectionAvailability = {
  available: boolean;
  blockedReason: string | null;
};

export async function getCorrectionAvailability(evaluationId: string): Promise<CorrectionAvailability> {
  const supabase = await createSupabaseServerClient();
  // Version de encuesta con que se hizo esta evaluacion (la respuesta mas reciente). RLS: el profesional
  // lee las respuestas de su propio paciente.
  const { data: resp, error } = await supabase
    .from("survey_responses")
    .select("survey_version_id")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`correction-availability-reader: ${error.message}`);
  // Sin respuesta no se decide aqui (no deberia pasar: el entry solo aparece con diagnostico); el servicio
  // valida el resto.
  if (!resp) return { available: true, blockedReason: null };

  const active = await getActiveSurvey();
  if (active && resp.survey_version_id !== active.surveyVersionId) {
    return {
      available: false,
      blockedReason:
        "Esta evaluación se hizo con una versión anterior del cuestionario; no puede recalcularse con el modelo actual. Escríbele a soporte.",
    };
  }
  return { available: true, blockedReason: null };
}
