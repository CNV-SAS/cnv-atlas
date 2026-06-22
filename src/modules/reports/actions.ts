"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { limitReportSendByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { getReportDispatch } from "./data/reports-repository";
import { approveReport, ReportStateError } from "./data/reports-writer";
import { canManageReports } from "./policies/can-manage-reports";
import { sendReport } from "./services/send-report";

// Estado de los botones (useActionState). Forma FormToastState para el toast.
export type ReportActionState = {
  error: string | null;
  success: string | null;
  warning: string | null;
};

const fail = (error: string): ReportActionState => ({ error, success: null, warning: null });

function reportIdOf(form: FormData): string {
  return (form.get("reportId") as string | null)?.trim() ?? "";
}

// Aprueba el reporte: confirma el diagnostico y aprueba (writer, audit inline). La
// ownership se verifica con getReportDispatch bajo RLS antes de escribir.
export async function approveReportAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const reportId = reportIdOf(form);
  if (!reportId) return fail("Reporte invalido.");

  const dispatch = await getReportDispatch(reportId);
  if (!dispatch) return fail("Reporte no encontrado.");

  const ip = await getClientIp();
  try {
    await approveReport({
      reportId,
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
  } catch (e) {
    if (e instanceof ReportStateError) return fail(e.message);
    throw e;
  }

  revalidatePath("/evaluaciones");
  return { error: null, success: "Reporte aprobado.", warning: null };
}

// Envia el reporte al paciente (render -> Storage -> correo -> marcar enviado). Rate
// limit por usuario para no saturar Resend.
export async function sendReportAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const reportId = reportIdOf(form);
  if (!reportId) return fail("Reporte invalido.");

  const rl = await limitReportSendByUser(user.id);
  if (!rl.success) return fail("Has enviado demasiados reportes. Espera unos minutos.");

  const ip = await getClientIp();
  const result = await sendReport({
    reportId,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/evaluaciones");
  return { error: null, success: "Reporte enviado al paciente.", warning: null };
}
