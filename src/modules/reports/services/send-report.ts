import "server-only";

import { appError, err, ok, type Result } from "@/core/errors";
import { sendReportEmail } from "@/lib/email/resend";

import { getReportDispatch } from "../data/reports-repository";
import { uploadReportPdf } from "../data/report-storage";
import { markReportSent, ReportStateError } from "../data/reports-writer";
import type { SendMode } from "../pdf/report-document";
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-CO");
}

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

  // 1. Render del PDF desde el snapshot inmutable, segun el modo elegido.
  const pdf = await renderReportPdf(
    dispatch.snapshot,
    {
      patientName: dispatch.patientName || "Paciente",
      documentLabel: dispatch.documentLabel,
      evaluationDate: formatDate(dispatch.evaluationDate),
      reportId: dispatch.reportId,
    },
    { mode: input.mode, professionalNotes: dispatch.professionalNotes },
  );

  // 2. Subida a Storage (service role). Si falla, no se envia.
  const uploaded = await uploadReportPdf(dispatch.patientId, dispatch.reportId, pdf);
  if (!uploaded) return err(appError("internal", "No se pudo almacenar el PDF del reporte."));

  // 3. Correo con el PDF adjunto (externo). Si falla, el reporte sigue approved.
  const filename = `reporte-${dispatch.documentLabel.replace(/\s+/g, "-") || "clinico"}.pdf`;
  const sent = await sendReportEmail({
    to: dispatch.email,
    subject: "Tu reporte clinico ANI-BIS-E",
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
