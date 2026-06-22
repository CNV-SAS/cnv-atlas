import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses, reports } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Escritura de la aprobacion y el envio del reporte (Drizzle owner, para el audit
// INLINE, regla 8). Las actualizaciones tocan solo columnas de estado, NUNCA snapshot,
// asi que pasan el trigger prevent_report_snapshot_mutation (que solo bloquea DELETE y
// cambios del snapshot). La autorizacion se verifica antes en el action leyendo el
// reporte bajo RLS (ownership), regla dura 3.

// Fallo de estado (reporte no draft/approved, diagnostico ausente o ya confirmado).
// La transaccion entera se revierte; el action lo mapea a un mensaje.
export class ReportStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportStateError";
  }
}

export type ApproveReportInput = {
  reportId: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Aprueba el reporte. Orden (D1): primero confirma el diagnostico, luego aprueba el
// reporte, cada uno con su audit inline. Si la confirmacion falla (p. ej. el
// diagnostico ya estaba confirmado), se revierte todo.
export async function approveReport(input: ApproveReportInput): Promise<{ diagnosisId: string }> {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select({ id: reports.id, evaluationId: reports.evaluationId, status: reports.status })
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .limit(1);
    if (!report) throw new ReportStateError("Reporte no encontrado.");
    if (report.status !== "draft") {
      throw new ReportStateError("El reporte ya fue aprobado o enviado.");
    }

    // 1. Confirmar el diagnostico de la evaluacion. Guard confirmedBy IS NULL: si ya
    //    estaba confirmado, 0 filas y se revierte la transaccion entera.
    const [diagnosis] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, report.evaluationId))
      .limit(1);
    if (!diagnosis) throw new ReportStateError("La evaluacion no tiene diagnostico que confirmar.");
    const confirmed = await tx
      .update(diagnoses)
      .set({ confirmedBy: input.actorId, confirmedAt: sql`now()` })
      .where(and(eq(diagnoses.id, diagnosis.id), isNull(diagnoses.confirmedBy)))
      .returning({ id: diagnoses.id });
    if (confirmed.length === 0) throw new ReportStateError("El diagnostico ya estaba confirmado.");
    await recordAudit(tx, {
      event: "diagnosis.confirmed",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "diagnosis",
      entityId: diagnosis.id,
      payload: { evaluation_id: report.evaluationId },
      ip: input.ip,
    });

    // 2. Aprobar el reporte (no toca snapshot -> compatible con el trigger).
    const approved = await tx
      .update(reports)
      .set({ status: "approved", approvedBy: input.actorId, approvedAt: sql`now()` })
      .where(and(eq(reports.id, report.id), eq(reports.status, "draft")))
      .returning({ id: reports.id });
    if (approved.length === 0) throw new ReportStateError("No se pudo aprobar el reporte.");
    await recordAudit(tx, {
      event: "report.approved",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "report",
      entityId: report.id,
      payload: { evaluation_id: report.evaluationId },
      ip: input.ip,
    });

    return { diagnosisId: diagnosis.id };
  });
}

export type MarkReportSentInput = {
  reportId: string;
  storagePath: string;
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Marca el reporte como enviado (approved -> sent), sella sent_at y storage_path y
// audita report.sent. Se llama SOLO tras un envio de correo exitoso (el orden lo
// gobierna el servicio de envio): si el correo falla, el reporte queda approved.
export async function markReportSent(input: MarkReportSentInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [report] = await tx
      .select({ id: reports.id, evaluationId: reports.evaluationId, status: reports.status })
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .limit(1);
    if (!report) throw new ReportStateError("Reporte no encontrado.");
    if (report.status !== "approved") {
      throw new ReportStateError("El reporte debe estar aprobado para enviarse.");
    }
    const sent = await tx
      .update(reports)
      .set({ status: "sent", sentAt: sql`now()`, storagePath: input.storagePath })
      .where(and(eq(reports.id, report.id), eq(reports.status, "approved")))
      .returning({ id: reports.id });
    if (sent.length === 0) throw new ReportStateError("No se pudo marcar el reporte como enviado.");
    await recordAudit(tx, {
      event: "report.sent",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "report",
      entityId: report.id,
      payload: { evaluation_id: report.evaluationId },
      ip: input.ip,
    });
  });
}
