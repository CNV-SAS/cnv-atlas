import { date, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { professionalProfiles, profiles } from "./organizations";
import { patients } from "./patients";

// Importacion desde el HTML de Gildardo (migracion 0159, sesion 1 del plan). Los CHECK, el trigger de
// inmutabilidad y la RLS viven en la migracion; aqui va la forma para Drizzle.

// El lote: quien importo, cuando, desde que archivo y con que declaracion del profesional.
export const htmlImportBatches = pgTable("html_import_batches", {
  id: pk(),
  professionalId: uuid("professional_id")
    .notNull()
    .references(() => professionalProfiles.id, { onDelete: "restrict" }),
  importedBy: uuid("imported_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  sourceFileName: text("source_file_name").notNull(),
  sourceFileHash: text("source_file_hash").notNull(),
  declarationVersion: text("declaration_version").notNull(),
  declaredAt: timestamp("declared_at", { withTimezone: true }).notNull(),
  patientCount: integer("patient_count").notNull().default(0),
  consultationCount: integer("consultation_count").notNull().default(0),
});

// El consentimiento que el paciente firmo en el HTML, uno por consulta. NO es un `patient_consents`: esa
// tabla la lee el gate de la regla dura 15, y este se firmo sin codigo de verificacion.
export const patientExternalConsents = pgTable(
  "patient_external_consents",
  {
    id: pk(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => htmlImportBatches.id, { onDelete: "restrict" }),
    origin: text("origin").notNull(), // 'html'
    textVersion: text("text_version").notNull(),
    documentHash: text("document_hash").notNull(),
    typedName: text("typed_name").notNull(),
    recordedDate: text("recorded_date").notNull(), // la fecha tal como la guardo el HTML
    sourceConsultationDate: date("source_consultation_date").notNull(),
    signatureMethod: text("signature_method").notNull(), // 'nombre_tecleado_sin_codigo'
    createdAt: createdAt(),
  },
  (t) => [
    index("patient_external_consents_patient_idx").on(t.patientId),
    unique("patient_external_consents_uno_por_consulta").on(t.patientId, t.origin, t.sourceConsultationDate),
  ],
);
