import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { authUsers } from "./_auth";
import { createdAt, pk, updatedAt } from "./_columns";
import {
  appRole,
  bankAccountType,
  documentType,
  profileStatus,
  professionalDocumentType,
  professionalProfession,
  taxPersonType,
} from "./enums";

// Grupo 1: organizacion, usuarios, roles.

export const organizations = pgTable("organizations", {
  id: pk(),
  name: text("name").notNull(),
  type: text("type").notNull(), // clinica, consultorio, unidad CNV
  country: text("country"),
  city: text("city"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Espejo de auth.users SOLO para staff y profesionales (no pacientes).
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    status: profileStatus("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("profiles_org_idx").on(t.organizationId)],
);

export const roles = pgTable("roles", {
  id: pk(),
  name: appRole("name").notNull().unique(),
  description: text("description"),
});

// N:N: un usuario puede tener varios roles.
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_roles_role_idx").on(t.roleId),
  ],
);

// Datos de dominio del profesional (1:1 con profiles cuando tiene rol professional).
export const professionalProfiles = pgTable("professional_profiles", {
  id: pk(),
  profileId: uuid("profile_id")
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  license: text("license"), // registro profesional
  // Antes texto libre 'specialty'. Ahora lista cerrada (T2 A1): gobierna la subpestana por
  // profesion en Tratamiento y el abordaje por profesion del diagnostico (efrProf). NOT NULL (mig 0036,
  // gate Hito 2): todo profesional tiene profesion; se captura al invitar. profession=null bloqueaba
  // todas las escrituras de tratamiento del integrante.
  profession: professionalProfession("profession").notNull(),
  certificationStatus: text("certification_status"), // gate de habilitacion ANI-BIS-E
  commissionRate: numeric("commission_rate").notNull().default("0.20"), // editable por admin
  // Estado tributario del integrante (dictamen contable 2026-08-11). CNV es agente de retencion sobre la
  // comision; sin estos datos no se puede calcular la retencion ni documentar el pago. Se captura en el
  // perfil. NULL = sin capturar. tax_status_completed_at marca que el integrante completo el formulario
  // (la fuente de verdad de "completo", robusta a que algun booleano sea false legitimamente). Las TARIFAS
  // de retencion NO se guardan aqui (esperan a la contadora); esto solo son los datos de entrada.
  taxPersonType: taxPersonType("tax_person_type"), // natural | juridica (lo declara el integrante)
  taxHasRut: boolean("tax_has_rut"), // lo declara el integrante (sabe si tiene el documento)
  taxIdType: documentType("tax_id_type"), // natural: CC/CE; juridica: NIT (documento adaptado)
  taxIdNumber: text("tax_id_number"), // NIT o cedula
  taxIdDv: text("tax_id_dv"), // digito de verificacion (cuando es NIT)
  taxStatusCompletedAt: timestamp("tax_status_completed_at", { withTimezone: true }), // el integrante subio su parte
  // Campos CERTIFICADOS del RUT: NO los responde el integrante (no los sabe fiablemente); los llena una
  // persona designada de CNV al VERIFICAR el RUT que el integrante subio (A2, revision contable 2026-08-12).
  taxIsIncomeDeclarant: boolean("tax_is_income_declarant"),
  taxIsVatResponsible: boolean("tax_is_vat_responsible"),
  taxMustInvoice: boolean("tax_must_invoice"), // esta obligado a facturar
  // RUT (fuente de verdad) + trazabilidad de la verificacion. rut_document_date es la fecha que trae el
  // propio RUT: si tiene mas de un año, se pide uno actualizado (el RUT cambia; la clasificacion envejece).
  rutPath: text("rut_path"), // ruta en el bucket privado professional-documents
  rutDocumentDate: date("rut_document_date"),
  rutVerifiedBy: uuid("rut_verified_by").references(() => profiles.id),
  rutVerifiedAt: timestamp("rut_verified_at", { withTimezone: true }),
  // Rechazo del RUT (vencido, ilegible, no es un RUT): con MOTIVO, que ve el integrante para saber que
  // corregir. Subir uno nuevo limpia el rechazo. Se conserva el rastro (quien/cuando/por que) en el audit.
  rutRejectedReason: text("rut_rejected_reason"),
  rutRejectedBy: uuid("rut_rejected_by").references(() => profiles.id),
  rutRejectedAt: timestamp("rut_rejected_at", { withTimezone: true }),
  // Cuenta bancaria (a donde se gira la comision). El titular DEBE ser el integrante: se valida por
  // DOCUMENTO, no solo por nombre; si el integrante es juridica, la cuenta va a nombre de la juridica (NIT),
  // no del representante (quien recibe el dinero emite el soporte, revision contable: 2 incidentes reales).
  bankName: text("bank_name"),
  bankAccountType: bankAccountType("bank_account_type"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountHolderName: text("bank_account_holder_name"),
  bankAccountHolderDocument: text("bank_account_holder_document"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Firmas de documentos por Integrante (contrato marco, Anexo 3 de tratamiento, Anexo 4
// de licenciamiento, etc.). Tabla generica y pequena: hoy este bloque solo usa
// document_type = 'anexo3' para la precondicion del Nivel (b), pero la forma esta lista
// para el sistema de gestion documental completo (su propio bloque futuro, ver BACKLOG),
// sin migrar de nuevo. Una fila por (profesional, tipo de documento): la version vigente
// que ese Integrante tiene firmada de ese documento.
export const professionalDocumentSignatures = pgTable(
  "professional_document_signatures",
  {
    id: pk(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    documentType: professionalDocumentType("document_type").notNull(),
    signedVersion: text("signed_version").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("professional_document_signatures_prof_doc_unique").on(t.professionalId, t.documentType),
    index("professional_document_signatures_prof_idx").on(t.professionalId),
  ],
);

export const professionalCertifications = pgTable("professional_certifications", {
  id: pk(),
  professionalId: uuid("professional_id")
    .notNull()
    .references(() => professionalProfiles.id, { onDelete: "cascade" }),
  certificationName: text("certification_name").notNull(),
  institution: text("institution"),
  year: integer("year"),
  createdAt: createdAt(),
});
