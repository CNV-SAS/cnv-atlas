import { sql } from "drizzle-orm";
import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { consentType, documentType, patientStatus } from "./enums";
import { organizations, professionalProfiles } from "./organizations";

// Grupo 2: pacientes (seudonimizacion). La data clinica cuelga de patient_id; la
// PII vive en tablas aparte con RLS estricto (principio 2).

// Identidad minima. El documento es la llave de resolucion de identidad.
export const patients = pgTable(
  "patients",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    documentType: documentType("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    status: patientStatus("status").notNull().default("active"),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    unique("patients_org_document_unique").on(
      t.organizationId,
      t.documentType,
      t.documentNumber,
    ),
  ],
);

// PII demografica.
export const patientProfiles = pgTable("patient_profiles", {
  patientId: uuid("patient_id")
    .primaryKey()
    .references(() => patients.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthDate: date("birth_date"),
  sex: text("sex"),
  country: text("country"),
  city: text("city"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const patientContacts = pgTable("patient_contacts", {
  patientId: uuid("patient_id")
    .primaryKey()
    .references(() => patients.id, { onDelete: "cascade" }),
  email: text("email"),
  phone: text("phone"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Consentimiento versionado e inmutable.
export const patientConsents = pgTable(
  "patient_consents",
  {
    id: pk(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    consentType: consentType("consent_type").notNull(),
    consentVersion: text("consent_version").notNull(), // version exacta del texto
    documentHash: text("document_hash").notNull(), // hash del texto aceptado
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // null = vigente
    // Menores de edad (DELTA2 A2). Nullable; solo se llenan cuando
    // consent_type = 'representante_legal'. Viven aqui, no en una tabla nueva:
    // el representante es una autorizacion mas, con campos adicionales.
    legalRepresentativeName: text("legal_representative_name"),
    legalRepresentativeDocument: text("legal_representative_document"),
    legalRepresentativeRelationship: text("legal_representative_relationship"),
    legalRepresentativeEmail: text("legal_representative_email"),
  },
  (t) => [
    index("patient_consents_patient_idx").on(t.patientId),
    // Una sola autorizacion activa por (paciente, tipo): re-consentir revoca la
    // anterior en la misma transaccion (regla dura 15). No un unique a secas.
    uniqueIndex("patient_consents_one_active_idx")
      .on(t.patientId, t.consentType)
      .where(sql`revoked_at is null`),
  ],
);

export const patientProfessionalRelationships = pgTable(
  "patient_professional_relationships",
  {
    id: pk(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("ppr_patient_professional_unique").on(t.patientId, t.professionalId),
    index("ppr_professional_idx").on(t.professionalId),
  ],
);
