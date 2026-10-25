"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";

import { correctEvaluation } from "./services/correct-evaluation";
import { corregirMedicionDeOtroPaciente } from "./services/corregir-medicion-de-otro-paciente";

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
  revalidatePath("/ani-bis-e");
  return { error: null, newEvaluationId: result.value.newEvaluationId };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA MEDICION ERA DE OTRA PERSONA (caso 6, 2026-10-24)
//
// FORMULARIO Y NO LLAMADA TIPADA como la de arriba, y es deliberado: esto se pulsa desde la pantalla del
// diagnostico, donde el profesional acaba de darse cuenta, y lo que tiene que viajar es el motivo que
// escribio y una confirmacion. Zod valida AQUI, antes de tocar la base (regla de validacion), y el
// servicio vuelve a decidir sobre la asignacion: esta accion no es la autoridad.
//
// EL MOTIVO PIDE 15 CARACTERES y no 5 como los demas: este registro es la explicacion de un incidente de
// datos de salud, y "error" no explica nada. No es una cifra clinica, es el minimo para que la frase
// diga algo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// La forma de FormToastState (error/success/warning), DECLARADA AQUI y no importada del hook: ese modulo
// es "use client", y un archivo de servidor no cruza esa frontera ni por un tipo. Es lo que hacen las
// otras acciones con estado de toast (bis, reports).
export type MedicionDeOtroState = { error: string | null; success: string | null; warning: string | null };

const medicionDeOtroSchema = z.object({
  evaluationId: z.guid(),
  motivo: z.string().trim().min(15, "Escribe en el motivo de quién era la medición y cómo se supo.").max(500),
  confirmar: z.literal("si", {
    message: "Marca la confirmación: esta corrección reemplaza la versión sellada y no se deshace.",
  }),
});

export async function medicionDeOtroPacienteAction(
  _prev: MedicionDeOtroState,
  formData: FormData,
): Promise<MedicionDeOtroState> {
  const parsed = medicionDeOtroSchema.safeParse({
    evaluationId: formData.get("evaluationId"),
    motivo: formData.get("motivo"),
    confirmar: formData.get("confirmar"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos.", success: null, warning: null };
  }

  const user = await requireUser();
  const ip = await getClientIp();
  const result = await corregirMedicionDeOtroPaciente(
    { evaluationId: parsed.data.evaluationId, reason: parsed.data.motivo, confirmed: true },
    { actorId: user.id, actorEmail: user.email, ip: ip === "unknown" ? null : ip },
  );
  if (!result.ok) return { error: result.error.message, success: null, warning: null };

  // SIN `revalidatePath` A PROPOSITO: la pantalla refresca (`useFormToastAndRefresh`), y los dos juntos
  // montan los segmentos dos veces, asi que la pagina salta al inicio dos veces y el formulario puede
  // desmontarse antes de que se vea el aviso. Candado: `refresco-una-sola-vez.test.ts`.
  return {
    error: null,
    success:
      "Listo. La medición quedó marcada como de otro paciente y esta consulta tiene una versión nueva, " +
      "sin medición, lista para montar la que sí es suya.",
    warning: null,
  };
}
