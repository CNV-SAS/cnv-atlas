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

  // ═══ UNA VERSION YA REEMPLAZADA NO SE CORRIGE (2026-11-05) ═══
  //
  // El servicio ya lo frena ("Esta evaluación ya fue corregida; corrige la versión vigente"), pero la
  // pantalla seguia ofreciendo el boton, y un boton que solo puede fallar se siente roto. Aqui no se
  // inventa un mecanismo: este lector YA tiene el camino de "no disponible con su razon", que es el que
  // usa la version vieja de encuesta. Esta es otra razon de la misma clase.
  //
  // VA PRIMERO, antes de leer la version de la encuesta: es la razon que manda (da igual con que version
  // se hizo una evaluacion que ya no es la vigente) y ahorra la consulta.
  const { data: reemplazada } = await supabase
    .from("clinical_corrections")
    .select("new_evaluation_id")
    .eq("old_evaluation_id", evaluationId)
    .limit(1)
    .maybeSingle();
  if (reemplazada) {
    return {
      available: false,
      blockedReason:
        "Esta versión ya fue reemplazada por una corrección. Lo que haya que corregir se corrige en la versión vigente.",
    };
  }
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
