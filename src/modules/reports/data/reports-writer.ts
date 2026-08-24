import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { diagnoses, reports, treatments } from "@/db/schema";
import type { Profession } from "@/modules/auth/admin-validations";
import { recordAudit } from "@/modules/audit/log";
import { getActorProfession } from "@/modules/treatment/data/actor-profession-reader";

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
  professionalNotes: string | null; // notas del profesional; se congelan al aprobar
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

    // 1. Confirmar el diagnostico de la evaluacion, TOLERANTE (mini-bloque de confirmacion como acto
    //    propio): la confirmacion ya no es exclusiva del reporte. Si el diagnostico YA estaba
    //    confirmado (por el acto propio, diagnosis.confirmed), NO se re-confirma ni se bloquea. Si se
    //    confirma AQUI (nadie lo hizo antes), se audita distinto (diagnosis.confirmed_via_report) para
    //    que el audit distinga "confirmo y luego prescribio" de "aprobo el reporte sin confirmar" (con
    //    la via propia disponible, esto ultimo significa que se salto un paso).
    const [diagnosis] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, report.evaluationId))
      .limit(1);
    if (!diagnosis) throw new ReportStateError("La evaluación no tiene diagnóstico que confirmar.");
    // Profesion con que se confirma via aprobar reporte (misma firma clinica que el acto propio). null si
    // quien aprueba no es profesional (p. ej. admin, permitido por la policy del reporte).
    const { profession } = await getActorProfession(input.actorId);
    const confirmed = await tx
      .update(diagnoses)
      .set({ confirmedBy: input.actorId, confirmedAt: sql`now()`, confirmedProfession: profession as Profession | null })
      .where(and(eq(diagnoses.id, diagnosis.id), isNull(diagnoses.confirmedBy)))
      .returning({ id: diagnoses.id });
    if (confirmed.length > 0) {
      await recordAudit(tx, {
        event: "diagnosis.confirmed_via_report",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        entityType: "diagnosis",
        entityId: diagnosis.id,
        payload: { evaluation_id: report.evaluationId },
        ip: input.ip,
      });
    }

    // 2. Aprobar el reporte + sellar las notas del profesional (no toca snapshot ->
    //    compatible con el trigger; el UPDATE es draft->approved, asi que la escritura
    //    de professional_notes pasa el trigger, y despues queda congelada).
    const approved = await tx
      .update(reports)
      .set({
        status: "approved",
        approvedBy: input.actorId,
        approvedAt: sql`now()`,
        professionalNotes: input.professionalNotes,
      })
      .where(and(eq(reports.id, report.id), eq(reports.status, "draft")))
      .returning({ id: reports.id });
    if (approved.length === 0) throw new ReportStateError("No se pudo aprobar el reporte.");
    await recordAudit(tx, {
      event: "report.approved",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "report",
      entityId: report.id,
      payload: {
        evaluation_id: report.evaluationId,
        has_professional_notes: Boolean(input.professionalNotes),
      },
      ip: input.ip,
    });

    return { diagnosisId: diagnosis.id };
  });
}

export type ConfirmTrajectoryInput = {
  reportId: string;
  proximaCita: string; // fecha YYYY-MM-DD; OBLIGATORIA (el gate de Gildardo: "empeoro" solo con cita)
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Confirma comunicar un "empeoro" al paciente (P0 Parte 2, P4). Acto APARTE de aprobar (Gildardo). En
// UNA transaccion: agenda la proxima cita en el tratamiento Y sella la confirmacion en el reporte. Debe
// ser atomico: si la confirmacion fallara despues de agendar, no puede quedar la cita puesta sin la
// confirmacion (el profesional creeria que confirmo y no lo hizo). La autorizacion (ownership) se
// verifica antes en el action bajo RLS.
export async function confirmTrajectoryCommunication(input: ConfirmTrajectoryInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [report] = await tx
      .select({
        id: reports.id,
        evaluationId: reports.evaluationId,
        status: reports.status,
        trajectory: reports.trajectory,
        communicatedAt: reports.trajectoryCommunicatedAt,
      })
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .limit(1);
    if (!report) throw new ReportStateError("Reporte no encontrado.");
    if (report.status !== "draft") {
      throw new ReportStateError("El reporte ya fue aprobado o enviado; la comunicación ya no se confirma aquí.");
    }
    const band = (report.trajectory as { band?: string } | null)?.band;
    if (band !== "empeoro") {
      throw new ReportStateError("Solo se confirma la comunicación cuando el cambio empeoro.");
    }
    if (report.communicatedAt) throw new ReportStateError("La comunicación ya fue confirmada.");
    if (!input.proximaCita) {
      throw new ReportStateError("Para comunicar este cambio hace falta agendar la próxima cita.");
    }

    // Agendar la cita en el tratamiento (evaluation -> diagnosis -> treatment). La condicion (cita) se
    // evalua AQUI, al confirmar; si despues alguien borra proxima_cita, la confirmacion queda (el
    // reporte ya decidio, no se reescribe). proxima_cita es editable tras aprobar por diseno (trigger
    // 0026), asi que esta escritura pasa aunque el tratamiento este aprobado.
    const [diag] = await tx
      .select({ id: diagnoses.id })
      .from(diagnoses)
      .where(eq(diagnoses.evaluationId, report.evaluationId))
      .limit(1);
    if (!diag) throw new ReportStateError("La evaluación no tiene diagnóstico.");
    const updatedT = await tx
      .update(treatments)
      .set({ proximaCita: input.proximaCita })
      .where(eq(treatments.diagnosisId, diag.id))
      .returning({ id: treatments.id });
    if (updatedT.length === 0) {
      throw new ReportStateError("La evaluación no tiene tratamiento donde agendar la cita.");
    }

    // Sellar la confirmacion en el reporte (draft; se congela al aprobar).
    const confirmed = await tx
      .update(reports)
      .set({ trajectoryCommunicatedAt: sql`now()`, trajectoryCommunicatedBy: input.actorId })
      .where(and(eq(reports.id, report.id), eq(reports.status, "draft")))
      .returning({ id: reports.id });
    if (confirmed.length === 0) throw new ReportStateError("No se pudo confirmar la comunicación.");

    await recordAudit(tx, {
      event: "report.trajectory_communication_confirmed",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "report",
      entityId: report.id,
      payload: { evaluation_id: report.evaluationId, band, proxima_cita: input.proximaCita },
      ip: input.ip,
    });
  });
}

export type MarkReportSentInput = {
  reportId: string;
  storagePath: string;
  sendMode: string; // 'atlas' | 'notas' | 'ambos': lo que efectivamente recibio el paciente
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
      .set({
        status: "sent",
        sentAt: sql`now()`,
        storagePath: input.storagePath,
        sendMode: input.sendMode,
      })
      .where(and(eq(reports.id, report.id), eq(reports.status, "approved")))
      .returning({ id: reports.id });
    if (sent.length === 0) throw new ReportStateError("No se pudo marcar el reporte como enviado.");
    await recordAudit(tx, {
      event: "report.sent",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "report",
      entityId: report.id,
      // Trazabilidad de QUE recibio el paciente (el modo elegido al enviar).
      payload: { evaluation_id: report.evaluationId, send_mode: input.sendMode },
      ip: input.ip,
    });
  });
}

export type MarkReportResentInput = {
  reportId: string;
  reason: string; // motivo del reenvio; queda en el audit, que es el registro que no se reescribe
  sendMode: string; // el MISMO del envio original: reenviar no cambia el documento
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// REENVIO del mismo documento (sent -> sent). No toca snapshot, notas, trayectoria ni sent_at: la fecha
// del PRIMER envio es dato clinico y no se reescribe. Solo incrementa el contador visible y audita
// report.resent con el motivo. Reenviar NO es reemitir: no nace un documento nuevo.
export async function markReportResent(input: MarkReportResentInput): Promise<{ attempt: number }> {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select({ id: reports.id, evaluationId: reports.evaluationId, status: reports.status })
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .limit(1);
    if (!report) throw new ReportStateError("Reporte no encontrado.");
    if (report.status !== "sent") {
      throw new ReportStateError("Solo se puede reenviar un reporte que ya fue enviado.");
    }
    const [updated] = await tx
      .update(reports)
      .set({ resentCount: sql`${reports.resentCount} + 1`, lastResentAt: sql`now()` })
      .where(and(eq(reports.id, report.id), eq(reports.status, "sent")))
      .returning({ count: reports.resentCount });
    if (!updated) throw new ReportStateError("No se pudo registrar el reenvío.");
    await recordAudit(tx, {
      event: "report.resent",
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      entityType: "report",
      entityId: report.id,
      // El MOTIVO es el dato: un documento clinico que sale dos veces deja rastro de por que.
      payload: {
        evaluation_id: report.evaluationId,
        send_mode: input.sendMode,
        reason: input.reason,
        attempt: updated.count,
      },
      ip: input.ip,
    });
    return { attempt: updated.count };
  });
}
