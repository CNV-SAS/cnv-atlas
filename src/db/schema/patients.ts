import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { consentType, documentType, patientStatus } from "./enums";
import { organizations, professionalProfiles, profiles } from "./organizations";

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
  // Residencia PROLONGADA: "¿en que ciudad o municipio vivio la mayor parte de su vida?" (RESPUESTA_GILDARDO
  // 2026-08-17 §1). OPCIONAL, caracterizacion. Distinta de `city` (residencia ACTUAL, para contacto). De ESTA
  // sale la altitud FISIOLOGICA (la adaptacion a la altura viene de vivir años en altura, no de donde esta
  // hoy); hoy NO alimenta el motor, entra al observatorio. Perfil = ultimo valor conocido (prefill); el valor
  // versionado por encuentro vive en evaluations (alguien puede mudarse entre consultas). Sin field_key.
  // Caracterizacion sociodemografica OPCIONAL (observatorio/ObBIA). Nullable a proposito: si el paciente no
  // responde queda VACIO, nunca un valor por defecto (un dato inventado es peor que uno vacio). No alimentan
  // ningun motor (sin field_key). Se capturan al inicio de la fase 2 del intake, ya autorizado. Etnia y
  // ascendencia SI viven aqui (consent v1.0 en produccion): datos sensibles (Ley 1581 art. 5), gateados a
  // la autorizacion de investigacion en el writer.
  educationLevel: text("education_level"),
  occupation: text("occupation"),
  maritalStatus: text("marital_status"),
  socioeconomicStratum: text("socioeconomic_stratum"),
  // Pertenencia etnica (dato sensible, Ley 1581 art. 5). Solo se captura si el paciente otorgo la
  // autorizacion de INVESTIGACION (consent v1.0: la etnia se fundio en esa casilla). Autorreconocimiento
  // DANE + "Prefiero no responder" (valor distinto de null/vacio). Uso restringido a investigacion agregada
  // (DATA_GOVERNANCE: capturar no habilita usar; supresion de celdas bajo umbral, ejemplo Rrom).
  ethnicity: text("ethnicity"),
  // Ascendencia autodeclarada (RESPUESTA_GILDARDO 2026-08-15 §3): 2a pregunta, separada de la pertenencia
  // DANE. Mismo gate de investigacion. NUNCA como coeficiente de correccion, solo caracterizacion.
  ancestry: text("ancestry"),
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
    // COMO SE OBTUVO ESTA AUTORIZACION (0105, dictamen 2026-09-08). No es un metadato: dos
    // autorizaciones obtenidas por caminos distintos tienen FUERZA PROBATORIA distinta.
    // NULL en las anteriores al presencial: todas eran remotas por construccion, era el unico camino.
    // Valores cerrados por CHECK en la migracion (remoto_otp / presencial_otp / presencial_qr /
    // presencial_papel), no por enum: los cierra el dictamen, no una lista que crezca.
    signatureChannel: text("signature_channel"),
    // LA DECLARACION DEL PROFESIONAL, solo en las presenciales. Va CON SU VERSION y no como booleano: es
    // una afirmacion suya con consecuencias, y si cambia su redaccion lo declarado antes tiene que seguir
    // diciendo lo que decia. El CHECK exige que canal y declaracion vayan juntos o no vayan.
    declaredBy: uuid("declared_by").references(() => profiles.id),
    declarationVersion: text("declaration_version"),
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

// SESION DE CONSENTIMIENTO PRESENCIAL · MODALIDAD 2 (QR, dictamen 2026-09-09).
//
// LO QUE ESTA MODALIDAD ES Y LO QUE NO, repetido aqui a proposito: produce una AUTORIZACION VALIDA, pero
// NO una firma electronica con presuncion de confiabilidad, que es lo que si da el OTP. Si alguien la
// discute, la carga de probar recae en NOSOTROS, y lo unico que se puede aportar son estas columnas: la
// sesion atada a la consulta, el dispositivo distinto, la declaracion del profesional y los tiempos.
//
// LA COLUMNAS SE DECLARAN AQUI Y NO SOLO EN EL SQL: `values()` con claves que el schema no declara compila
// verde y NO ESCRIBE NADA. Ya paso una vez con el sellado del consentimiento presencial.
export const presencialConsentSessions = pgTable(
  "presencial_consent_sessions",
  {
    id: pk(),
    token: text("token").notNull().unique(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    // La FICHA atribuye la evaluacion...
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id),
    // ...y la PERSONA declara. Es el mismo par que en patient_consents.declared_by, y confundirlos ya
    // costo un smoke entero.
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id),
    /** El profesional AFIRMA que el paciente no tiene correo. No impide el atajo: lo vuelve atribuible. */
    sinCorreoDeclarado: boolean("sin_correo_declarado").notNull().default(true),
    declaracionVersion: text("declaracion_version").notNull(),
    documentType: documentType("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    // Lo que el PACIENTE escribio en SU dispositivo, tal cual, para poder compararlo.
    declaradoNombres: text("declarado_nombres"),
    declaradoApellidos: text("declarado_apellidos"),
    declaradoDocumentType: documentType("declarado_document_type"),
    declaradoDocumentNumber: text("declarado_document_number"),
    // Dos marcas, no una: lo que importa es la DISTANCIA. "Un consentimiento aceptado cuatro segundos
    // despues de abrirse es dificil de defender como informado" (dictamen).
    openedAt: timestamp("opened_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    declaredAt: timestamp("declared_at", { withTimezone: true }),
    // "Sin esto, la afirmacion de que fueron dispositivos distintos es solo una etiqueta que puso el
    // sistema" (dictamen). Misma politica que en clinical_audit_log: tecnico/auditoria, solo admin.
    patientIp: inet("patient_ip"),
    patientUserAgent: text("patient_user_agent"),
    estado: text("estado").notNull().default("emitida"),
    /** Acota el QR SIN ESCANEAR. Corta a proposito: un token visible en pantalla no debe vivir mucho. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Acota la LECTURA de quien ya lo abrio. Larga a proposito: leer despacio es lo que queremos. */
    lecturaHasta: timestamp("lectura_hasta", { withTimezone: true }),
    /** Lo que el paciente marco, esperando a que el profesional declare. NO es una autorizacion otorgada. */
    declaradoAutorizaciones: jsonb("declarado_autorizaciones").$type<string[]>(),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("presencial_sessions_prof_idx").on(t.professionalId, t.createdAt.desc())],
);
