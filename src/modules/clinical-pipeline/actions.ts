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
};

// Server action: genera el diagnostico (propagacion contra el stub). Orden: auth ->
// policy (rol) -> ownership bajo RLS -> exige in_progress -> orquesta. La autorizacion
// fina (que la evaluacion sea de su paciente) la impone la RLS.
export async function runPipelineAction(
  _prev: RunPipelineState,
  form: FormData,
): Promise<RunPipelineState> {
  const fail = (error: string): RunPipelineState => ({
    error,
    success: null,
    warning: null,
    done: false,
  });

  const user = await requireUser();
  if (!canRunPipeline(user)) return fail("No autorizado.");

  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluacion invalida.");

  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return fail("Evaluacion no encontrada.");
  if (ownership.status !== "in_progress") {
    return fail("La evaluacion no esta lista para generar diagnostico.");
  }

  const ip = await getClientIp();
  const result = await runClinicalPipeline({
    evaluationId,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/evaluaciones");
  return {
    error: null,
    success: `Diagnostico generado (${result.value.indicatorCount} indicadores).`,
    warning: null,
    done: true,
  };
}
