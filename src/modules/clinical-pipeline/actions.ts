"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";
import { getEvaluationOwnership } from "@/modules/evaluations/data/evaluations-repository";

import { canRunPipeline } from "./policies/can-run-pipeline";
import { runClinicalPipeline } from "./services/run-pipeline";

// Estado del boton (useActionState). Forma FormToastState para disparar el toast.
export type RunPipelineState = {
  error: string | null;
  success: string | null;
  warning: string | null;
  done: boolean;
  // ═══ LA SALIDA: A DONDE VA EL PROFESIONAL A ARREGLAR LO QUE FALTA ═══
  //
  // Nacio como `completeHref`, un enlace FIJO a completar la encuesta, y con la etiqueta escrita a mano en
  // cada panel. Al aparecer la segunda puerta que se puede resolver en otra pantalla (falta el sexo del
  // paciente, Sentry 2026-10-10) ese enlace habria mandado a la encuesta a arreglar un dato que no esta
  // ahi: un enlace que no resuelve nada es peor que ninguno.
  //
  // ASI QUE EL DESTINO Y SU ETIQUETA VIAJAN JUNTOS, decididos donde se sabe cual es la falta. Los paneles
  // solo lo pintan; ninguno vuelve a suponer de que puerta viene.
  salida: { href: string; etiqueta: string } | null;
};

// Server action: genera el diagnostico (propagacion contra el stub). Orden: auth ->
// policy (rol) -> ownership bajo RLS -> exige in_progress -> orquesta. La autorizacion
// fina (que la evaluacion sea de su paciente) la impone la RLS.
export async function runPipelineAction(
  _prev: RunPipelineState,
  form: FormData,
): Promise<RunPipelineState> {
  const fail = (
    error: string,
    salida: RunPipelineState["salida"] = null,
  ): RunPipelineState => ({
    error,
    success: null,
    warning: null,
    done: false,
    salida,
  });

  const user = await requireUser();
  if (!canRunPipeline(user)) return fail("No autorizado.");

  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluación inválida.");

  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return fail("Evaluación no encontrada.");
  if (ownership.status !== "in_progress") {
    return fail("La evaluación no esta lista para generar diagnóstico.");
  }

  const ip = await getClientIp();
  const result = await runClinicalPipeline({
    evaluationId,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) {
    // CADA PUERTA QUE SE PUEDE RESOLVER EN OTRA PANTALLA TRAE LA SUYA. Las que no (una contraindicacion,
    // un valor fuera de rango fisiologico) no ofrecen ninguna: su mensaje ya dice que hacer.
    //
    // Encuesta incompleta: la pagina de editar resalta las preguntas que faltan.
    // Falta el sexo: la ficha del paciente, que es el unico sitio donde se completa.
    const salida: RunPipelineState["salida"] = result.error.fields?.incompleteSurvey
      ? {
          href: `/ani-bis-e/${evaluationId}/encuesta/editar`,
          etiqueta: "Completar la encuesta con el paciente",
        }
      : result.error.fields?.faltaElSexo
        ? {
            href: `/pacientes/${ownership.patientId}`,
            etiqueta: "Ir a la ficha del paciente a completar el sexo",
          }
        : null;
    return fail(result.error.message, salida);
  }

  revalidatePath("/ani-bis-e");
  // Tambien la evaluacion: si se genero desde su pestana Diagnostico, la pagina re-renderiza a la rama de
  // resultados (el diagnostico ya existe), en vez de quedarse en el panel de generar.
  revalidatePath(`/ani-bis-e/${evaluationId}`);
  return {
    error: null,
    success: `Diagnostico generado (${result.value.indicatorCount} indicadores).`,
    warning: null,
    done: true,
    salida: null,
  };
}
