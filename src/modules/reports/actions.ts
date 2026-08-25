"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getClientIp } from "@/core/http/client-ip";
import { limitReportSendByUser } from "@/core/rate-limit";
import { requireUser } from "@/modules/auth/session";

import { getReportDispatch } from "./data/reports-repository";
import { approveReport, confirmTrajectoryCommunication, ReportStateError } from "./data/reports-writer";
import { SEND_MODES, type SendMode } from "./pdf/report-document";
import { canManageReports } from "./policies/can-manage-reports";
import { resendReport, sendReport } from "./services/send-report";

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
  if (!reportId) return fail("Reporte inválido.");

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
  // La ReportCard tambien vive como cierre de la etapa de Tratamiento en la vista de la
  // evaluacion (ruta dinamica): se revalida para que el estado de la card (borrador -> aprobado)
  // se refresque alli tras aprobar, no solo en la lista /reportes.
  revalidatePath("/evaluaciones/[id]", "page");
  return { error: null, success: "Reporte aprobado.", warning: null };
}

// Confirma comunicar un "empeoro" al paciente (P0 Parte 2, P4): acto APARTE de aprobar. Agenda la
// proxima cita (obligatoria) y sella la confirmacion, en una transaccion (writer). Ownership bajo RLS.
export async function confirmTrajectoryCommunicationAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const reportId = reportIdOf(form);
  if (!reportId) return fail("Reporte inválido.");


  const dispatch = await getReportDispatch(reportId);
  if (!dispatch) return fail("Reporte no encontrado.");

  const ip = await getClientIp();
  try {
    await confirmTrajectoryCommunication({
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
  revalidatePath("/evaluaciones/[id]", "page");
  return {
    error: null,
    success: "Comunicación confirmada y próxima cita agendada.",
    warning: null,
  };
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
  if (!reportId) return fail("Reporte inválido.");

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
  // La ReportCard tambien vive como cierre de Tratamiento en la vista de la evaluacion: se
  // revalida la ruta dinamica para que el estado (aprobado -> enviado) se refresque alli.
  revalidatePath("/evaluaciones/[id]", "page");
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

// Motivo del reenvio: obligatorio y corto. Obligatorio porque un documento clinico que sale dos veces
// deja rastro de por que; corto porque no es una nota clinica, es una razon operativa ("el correo rebotó",
// "corrigieron la dirección"). Tope de tamaño como toda entrada externa (regla de validacion).
const resendReasonSchema = z
  .string()
  .trim()
  .min(3, "Escribe el motivo del reenvío.")
  .max(300, "El motivo es demasiado largo.");

export async function resendReportAction(
  _prev: ReportActionState,
  form: FormData,
): Promise<ReportActionState> {
  const user = await requireUser();
  if (!canManageReports(user)) return fail("No autorizado.");
  const reportId = reportIdOf(form);
  if (!reportId) return fail("Reporte inválido.");

  const parsed = resendReasonSchema.safeParse((form.get("reason") as string | null) ?? "");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Motivo inválido.");

  // Mismo limite que el envio: un reenvio manda un correo igual que el primero.
  const rl = await limitReportSendByUser(user.id);
  if (!rl.success) return fail("Has enviado demasiados reportes. Espera unos minutos.");

  const ip = await getClientIp();
  const result = await resendReport({
    reportId,
    reason: parsed.data,
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
  });
  if (!result.ok) return fail(result.error.message);

  revalidatePath("/evaluaciones");
  revalidatePath("/evaluaciones/[id]", "page");
  revalidatePath("/reportes");
  return {
    error: null,
    success: `Se reenvió el mismo documento al paciente (reenvío ${result.value.attempt}).`,
    warning: null,
  };
}
