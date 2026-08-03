"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";

import { correctEvaluation } from "./services/correct-evaluation";

// Server action del flujo de corrección (S2). La confirmación (con la lista de cambios y las pérdidas)
// la muestra el formulario cliente ANTES de llamar aquí; por eso llega ya `confirmed`. La autorización
// real (profesional asignado, evaluación vigente, versión de encuesta, delta no vacío) la hace el
// servicio (gates), que es la autoridad; aquí solo se resuelve el actor del request.

export type CorrectEvaluationState = {
  error: string | null;
  newEvaluationId: string | null;
};

export async function correctEvaluationAction(input: {
  evaluationId: string;
  correctedAnswers: { questionId: string; answerValue: string }[];
  reason: string;
}): Promise<CorrectEvaluationState> {
  const user = await requireUser();
  const ip = await getClientIp();

  const result = await correctEvaluation(
    {
      evaluationId: input.evaluationId,
      correctedAnswers: input.correctedAnswers,
      reason: input.reason,
      triggerType: "correccion_profesional",
      confirmed: true,
    },
    { actorId: user.id, actorEmail: user.email, ip: ip === "unknown" ? null : ip },
  );
  if (!result.ok) return { error: result.error.message, newEvaluationId: null };

  // La versión vieja quedó reemplazada y la nueva es la vigente; refrescar donde se ve la evaluación.
  revalidatePath("/evaluaciones");
  return { error: null, newEvaluationId: result.value.newEvaluationId };
}
