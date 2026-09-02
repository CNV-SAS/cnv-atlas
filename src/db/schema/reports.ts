import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
    sentAt: timestamp("sent_at", { withTimezone: true }), // PRIMER envio; un reenvio NO lo reescribe
    // REENVIO del MISMO documento (2026-08-24). No es reemitir: el snapshot, las notas y la trayectoria
    // no se tocan, se vuelve a mandar lo mismo (correo perdido, direccion corregida). El CONTADOR vive
    // aqui solo para que la pantalla lo pueda decir; el rastro con MOTIVO de cada reenvio vive en
    // clinical_audit_log (evento report.resent), que es el registro que no se reescribe (regla 8).
    resentCount: integer("resent_count").notNull().default(0),
    lastResentAt: timestamp("last_resent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("reports_eval_idx").on(t.evaluationId)],
);

// ENTREGAS DE LA HISTORIA CLINICA AL PACIENTE (derecho de acceso, Resolucion 1995 / Ley 1581).
//
// POR QUE ES TABLA DE DOMINIO Y NO SOLO AUDIT LOG: el profesional necesita poder MOSTRAR que la entrego, y
// `clinical_audit_log` es admin-only para SELECT. Un registro que el escribe y no ve nunca es medio
// registro. Ya nos paso con el descarte del aviso de alergeno: un almacen se elige por TODAS sus
// propiedades, y la de LECTURA es la que se olvida.
//
// Y ADEMAS va al audit log, inline en la misma transaccion (regla dura 8). No es duplicar: la tabla es el
// HECHO que el profesional consulta; el log es el RASTRO del acto con su actor y su IP.
export const hcDeliveries = pgTable(
  "hc_deliveries",
  {
    id: pk(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    /** Medio por el que salio. Hoy solo 'email'. */
    medium: text("medium").notNull().default("email"),
    /** A DONDE se envio, tal como estaba: el contacto puede cambiar despues. */
    sentTo: text("sent_to").notNull(),
    deliveredBy: uuid("delivered_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    deliveredByEmail: text("delivered_by_email").notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("hc_deliveries_evaluation_idx").on(t.evaluationId, t.deliveredAt)],
);
