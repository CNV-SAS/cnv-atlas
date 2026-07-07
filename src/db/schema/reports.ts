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
