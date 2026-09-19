import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { reports } from "@/db/schema";
import { recordAudit } from "@/modules/audit/log";

// Escritura del envio del reporte (Drizzle owner, para el audit
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

// ═══ LA APROBACION Y LA CONFIRMACION DEL "EMPEORO" SE RETIRARON (2026-09-18) ═══
//
// AQUI VIVIAN `approveReport` (draft -> approved, congelando las notas) y `confirmTrajectoryCommunication`
// (sellar que se le comunica al paciente un cambio desfavorable). Las dos eran la ceremonia del reporte
// como bloque propio: aprobar, confirmar, y solo entonces enviar.
//
// POR QUE SE VAN, y no solo su pantalla: el reporte pasa a ser UNA HOJA MAS (Santiago, 2026-09-18), como
// las demas del modelo de Gildardo, que se imprimen o se envian. Aprobar sellaba dos cosas, y ninguna
// necesita este acto: la firma del diagnostico ahora nace con el diagnostico (`pipeline-writer`), y las
// notas del reporte se retiraron en favor de la observacion de la consulta, que no se congela aqui.
//
// Y LA GARANTIA CLINICA NO SE PIERDE, que es lo unico que no podia caerse con la ceremonia: el freno del
// cambio desfavorable se mudo a la ENTREGA (`freno-de-trayectoria`), donde es mas fuerte, porque tambien
// alcanza a la impresion, que se lo saltaba. Lo que se retira es el tramite, no la regla.
//
// LAS COLUMNAS SE QUEDAN (`approved_by`, `trajectory_communicated_at`): los reportes ya aprobados en
// produccion las tienen llenas y son su historia. No se borra un dato clinico por simplificar un flujo.

export type MarkReportSentInput = {
  reportId: string;
  storagePath: string;
  sendMode: string; // 'atlas' | 'notas' | 'ambos': lo que efectivamente recibio el paciente
  actorId: string;
  actorEmail: string;
  ip: string | null;
};

// Marca el reporte como enviado, sella sent_at y storage_path y audita report.sent. Se llama SOLO tras un
// envio de correo exitoso (el orden lo gobierna el servicio de envio): si el correo falla, el reporte queda
// como estaba y se puede reintentar.
//
// ACEPTA draft Y approved (2026-09-18). Antes exigia approved, porque aprobar era el paso previo; retirada
// la aprobacion, los reportes nuevos salen desde draft. `approved` sigue admitido porque en produccion hay
// reportes que se aprobaron y nunca se enviaron, y esos tienen que poder salir.
export async function markReportSent(input: MarkReportSentInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [report] = await tx
      .select({ id: reports.id, evaluationId: reports.evaluationId, status: reports.status })
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .limit(1);
    if (!report) throw new ReportStateError("Reporte no encontrado.");
    if (report.status === "sent") {
      throw new ReportStateError("Este reporte ya se envió.");
    }
    const sent = await tx
      .update(reports)
      .set({
        status: "sent",
        sentAt: sql`now()`,
        storagePath: input.storagePath,
        sendMode: input.sendMode,
      })
      // El WHERE repite la condicion para que dos envios simultaneos no marquen dos veces (el segundo no
      // encuentra fila y falla, en vez de auditar un envio que no ocurrio).
      .where(and(eq(reports.id, report.id), ne(reports.status, "sent")))
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
