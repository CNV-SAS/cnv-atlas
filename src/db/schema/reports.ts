import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { reportStatus } from "./enums";
import { evaluations } from "./evaluations";
import { profiles } from "./organizations";
import { patients } from "./patients";

// Grupo 11: reportes (snapshot). El contenido exacto que se aprobo/entrego se
// persiste inmutable en snapshot; no se re-deriva (principio 4).

export const reports = pgTable(
  "reports",
  {
    id: pk(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    type: text("type").notNull(), // paciente, profesional, modelo
    status: reportStatus("status").notNull().default("draft"),
    snapshot: jsonb("snapshot").notNull(), // contenido exacto, inmutable, del reporte
    // P0 Parte 2 (seguimiento): la trayectoria de EB-BIS en tres bandas (mejoró/sin cambio/empeoró)
    // SELLADA al crear el reporte, con el corte provisional con que se calculó. Solo en seguimientos con
    // previa comparable (>=12 semanas, C2-a); null en el resto. Inmutable por trigger, como el snapshot.
    trajectory: jsonb("trajectory"),
    // P0 Parte 2 (P4): confirmación del profesional de comunicar un "empeoró" al paciente. Acto APARTE de
    // aprobar (Gildardo): un empeoramiento no le llega al paciente sin que una persona lo decida. Se setea
    // en draft (antes de aprobar) y se congela al aprobar, como professional_notes. null = no confirmado
    // (el reporte sale sin la sección de banda). Solo aplica cuando trajectory.band = 'empeoro'.
    trajectoryCommunicatedAt: timestamp("trajectory_communicated_at", { withTimezone: true }),
    trajectoryCommunicatedBy: uuid("trajectory_communicated_by").references(() => profiles.id),
    // Notas de interpretacion del profesional (B10.1). Nullable; editable SOLO en draft
    // y se congela al aprobar (trigger + guard del writer). Viven aparte del snapshot,
    // que nunca se toca.
    professionalNotes: text("professional_notes"),
    // Modo de envio elegido al enviar (B10.1): 'atlas' (reporte tal cual) | 'notas'
    // (solo notas del profesional) | 'ambos'. Se sella en markReportSent.
    sendMode: text("send_mode"),
    storagePath: text("storage_path"), // PDF en Storage privado
    approvedBy: uuid("approved_by").references(() => profiles.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("reports_eval_idx").on(t.evaluationId)],
);
