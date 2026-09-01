import "server-only";

import { appError, err, ok, type Result } from "@/core/errors";
import { sendReportEmail } from "@/lib/email/resend";

import { formatDate } from "@/lib/format/date";

import { getReportDispatch } from "../data/reports-repository";
import { uploadReportPdf } from "../data/report-storage";
import { markReportResent, markReportSent, ReportStateError } from "../data/reports-writer";
import type { SendMode } from "../pdf/report-document";
import { getPlanPaciente } from "../data/plan-paciente-reader";
import { renderReportPdf } from "./render-report";

// Orquesta el envio del reporte al paciente. Orden (D4, accion externa hacia afuera):
// render -> subir a Storage -> enviar correo -> SOLO si el correo sale, marcar sent +
// audit report.sent. Si el correo falla, el reporte queda approved (reintentable) y no
// se audita el envio. La autorizacion fina la da getReportDispatch bajo RLS (ownership).

export type SendReportInput = {
  reportId: string;
  mode: SendMode; // que recibe el paciente: 'atlas' | 'notas' | 'ambos'
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function sendReport(input: SendReportInput): Promise<Result<{ emailId: string }>> {
  const dispatch = await getReportDispatch(input.reportId);
  if (!dispatch) return err(appError("not_found", "Reporte no encontrado."));
  if (dispatch.status !== "approved") {
    return err(appError("conflict", "El reporte debe estar aprobado para enviarse."));
  }
  if (!dispatch.email) {
    return err(appError("validation", "El paciente no tiene un correo registrado."));
  }

  // Validacion del modo (B10.1): si incluye las notas del profesional y no hay notas
  // escritas, se bloquea el envio. Las notas se congelaron al aprobar; si faltan, el
  // profesional debe enviar el reporte de Atlas o rehacer el flujo con notas.
  const needsNotes = input.mode === "notas" || input.mode === "ambos";
  const notes = (dispatch.professionalNotes ?? "").trim();
  if (needsNotes && !notes) {
    return err(
      appError(
        "validation",
        "El modo elegido incluye las notas del profesional, pero el reporte no tiene notas. Elige enviar el reporte de Atlas, o vuelve a generar el reporte y escribe las notas antes de aprobar.",
      ),
    );
  }

  // EL PLAN DEL PACIENTE (Gildardo §7.1: "el paciente recibe el plan completo"). Se arma AQUI, no se
  // sella: el tratamiento ya esta APROBADO cuando el reporte se envia (el gate de arriba lo exige), y un
  // protocolo aprobado esta congelado por su trigger. Asi que leerlo en vivo es reproducible, y sellar una
  // segunda copia crearia otra vez dos fuentes de lo mismo.
  //
  // Si la evaluacion no tiene tratamiento con protocolo, viaja null y el PDF omite el plan entero: es
  // preferible a mandar un plan a medias.
  const plan = await getPlanPaciente(dispatch.evaluationId, dispatch.snapshot);

  // 1. Render del PDF desde el snapshot inmutable, segun el modo elegido.
  const pdf = await renderReportPdf(
    dispatch.snapshot,
    {
      patientName: dispatch.patientName || "Paciente",
      documentLabel: dispatch.documentLabel,
      evaluationDate: formatDate(dispatch.evaluationDate),
      reportId: dispatch.reportId,
    },
    {
      mode: input.mode,
      professionalNotes: dispatch.professionalNotes,
      bandText: dispatch.patientBandText,
      bandAppointmentDate: dispatch.patientBandAppointmentDate,
      plan,
    },
  );

  // 2. Subida a Storage (service role). Si falla, no se envia.
  const uploaded = await uploadReportPdf(dispatch.patientId, dispatch.reportId, pdf);
  if (!uploaded) return err(appError("internal", "No se pudo almacenar el PDF del reporte."));

  // 3. Correo con el PDF adjunto (externo). Si falla, el reporte sigue approved.
  const filename = `reporte-${dispatch.documentLabel.replace(/\s+/g, "-") || "clinico"}.pdf`;
  const sent = await sendReportEmail({
    to: dispatch.email,
    subject: "Tu reporte clínico ANI-BIS-E",
    text: `Hola ${dispatch.patientName || ""}. Adjuntamos tu reporte clinico. Si tienes dudas, escribe a tu profesional de salud.`.trim(),
    pdf: { filename, content: pdf },
  });
  if (!sent.ok) return sent;

  // 4. Marcar enviado + audit report.sent (solo tras el correo OK).
  try {
    await markReportSent({
      reportId: dispatch.reportId,
      storagePath: uploaded.path,
      sendMode: input.mode,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
    });
  } catch (e) {
    if (e instanceof ReportStateError) return err(appError("conflict", e.message));
    throw e;
  }

  return ok({ emailId: sent.value.id });
}

// REENVIO del MISMO documento (2026-08-24). Mismo snapshot, mismas notas, MISMO modo de envio: lo unico
// que cambia es que sale otra vez. Deliberadamente NO se ofrece elegir modo, porque cambiar el modo
// cambia lo que el paciente recibe y eso ya seria otro documento (reemitir), que no existe todavia y va
// con el mecanismo de sucesion de versiones.
export type ResendReportInput = {
  reportId: string;
  reason: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

export async function resendReport(input: ResendReportInput): Promise<Result<{ emailId: string; attempt: number }>> {
  const dispatch = await getReportDispatch(input.reportId);
  if (!dispatch) return err(appError("not_found", "Reporte no encontrado."));
  if (dispatch.status !== "sent") {
    return err(appError("conflict", "Solo se puede reenviar un reporte que ya fue enviado."));
  }
  if (!dispatch.email) {
    return err(appError("validation", "El paciente no tiene un correo registrado."));
  }
  // El modo del envio original. Si por cualquier via falta, se cae al reporte de Atlas, que es el que no
  // depende de las notas: reenviar nunca puede quedarse sin poder mandar nada.
  const mode = (dispatch.sendMode ?? "atlas") as SendMode;

  // El plan tambien en el REENVIO: si uno de los dos sitios se lo olvidara, el reenvio mandaria un
  // documento distinto del original, que es peor que no reenviar. Se lee igual que en el envio (el
  // tratamiento aprobado esta congelado, asi que da lo mismo).
  const plan = await getPlanPaciente(dispatch.evaluationId, dispatch.snapshot);

  const pdf = await renderReportPdf(
    dispatch.snapshot,
    {
      patientName: dispatch.patientName || "Paciente",
      documentLabel: dispatch.documentLabel,
      evaluationDate: formatDate(dispatch.evaluationDate),
      reportId: dispatch.reportId,
    },
    {
      mode,
      professionalNotes: dispatch.professionalNotes,
      bandText: dispatch.patientBandText,
      bandAppointmentDate: dispatch.patientBandAppointmentDate,
      plan,
    },
  );

  const uploaded = await uploadReportPdf(dispatch.patientId, dispatch.reportId, pdf);
  if (!uploaded) return err(appError("internal", "No se pudo almacenar el PDF del reporte."));

  const filename = `reporte-${dispatch.documentLabel.replace(/\s+/g, "-") || "clinico"}.pdf`;
  const sent = await sendReportEmail({
    to: dispatch.email,
    subject: "Tu reporte clínico ANI-BIS-E",
    text: `Hola ${dispatch.patientName || ""}. Te reenviamos tu reporte clinico, es el mismo documento. Si tienes dudas, escribe a tu profesional de salud.`.trim(),
    pdf: { filename, content: pdf },
  });
  if (!sent.ok) return sent;

  try {
    const { attempt } = await markReportResent({
      reportId: dispatch.reportId,
      reason: input.reason,
      sendMode: mode,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      ip: input.ip,
    });
    return ok({ emailId: sent.value.id, attempt });
  } catch (e) {
    if (e instanceof ReportStateError) return err(appError("conflict", e.message));
    throw e;
  }
}
