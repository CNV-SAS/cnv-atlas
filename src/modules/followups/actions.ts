"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getClientIp } from "@/core/http/client-ip";
import { requireUser } from "@/modules/auth/session";
import { canManageTreatment } from "@/modules/treatment/policies/can-manage-treatment";

import {
  ProximoControlError,
  saveProximoControl,
} from "./data/proximo-control-writer";

export type ProximoControlState = { error: string | null; success: string | null; warning: string | null };

// La fecha es obligatoria y debe ser una fecha real: es dato clinico (cuando se vuelve a ver al paciente),
// no un texto libre. No se acota el rango a proposito: agendar a un ano es legitimo en una ruta de
// permanencia, y un limite arbitrario rechazaria casos validos.
const schema = z.object({
  evaluationId: z.guid(),
  proximaCita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha válida."),
  sugerida: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function saveProximoControlAction(
  _prev: ProximoControlState,
  form: FormData,
): Promise<ProximoControlState> {
  const user = await requireUser();
  if (!canManageTreatment(user)) return { error: "No autorizado.", success: null, warning: null };

  const parsed = schema.safeParse({
    evaluationId: (form.get("evaluationId") as string | null)?.trim() ?? "",
    proximaCita: (form.get("proximaCita") as string | null)?.trim() ?? "",
    sugerida: (form.get("sugerida") as string | null)?.trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", success: null, warning: null };
  }

  const ip = await getClientIp();
  try {
    await saveProximoControl({
      evaluationId: parsed.data.evaluationId,
      proximaCita: parsed.data.proximaCita,
      sugerida: parsed.data.sugerida ?? null,
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
  } catch (e) {
    if (e instanceof ProximoControlError) return { error: e.message, success: null, warning: null };
    throw e;
  }

  revalidatePath(`/evaluaciones/${parsed.data.evaluationId}`);
  return { error: null, success: "Próxima cita agendada.", warning: null };
}
