"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { limitReportSendByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { getReportDispatch } from "./data/reports-repository";
import { approveReport, ReportStateError } from "./data/reports-writer";
import { SEND_MODES, type SendMode } from "./pdf/report-document";
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

  // Notas del profesional (opcionales): se escriben en draft y se congelan al aprobar.
  const professionalNotes = (form.get("professionalNotes") as string | null)?.trim() || null;

  const ip = await getClientIp();
  try {
    await approveReport({
      reportId,
      professionalNotes,
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

  // Modo de envio elegido por el profesional (mutuamente excluyente).
  const rawMode = (form.get("sendMode") as string | null)?.trim() ?? "";
  if (!SEND_MODES.includes(rawMode as SendMode)) return fail("Selecciona un modo de envio.");
  const mode = rawMode as SendMode;

  const rl = await limitReportSendByUser(user.id);
  if (!rl.success) return fail("Has enviado demasiados reportes. Espera unos minutos.");

  const ip = await getClientIp();
  const result = await sendReport({
    reportId,
    mode,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/evaluaciones");
  // El reporte enviado sale de la bandeja de pendientes (/evaluaciones) y pasa a ser registro
  // permanente en /reportes; se revalida para que aparezca alli de inmediato y se le avisa al
  // profesional donde queda (si no, "desaparece" al enviar).
  revalidatePath("/reportes");
  return {
    error: null,
    success: "Reporte enviado al paciente. Queda disponible en Reportes.",
    warning: null,
  };
}
