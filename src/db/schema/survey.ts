import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { evaluationType, fieldDataClass } from "./enums";
import { evaluations } from "./evaluations";
import { organizations, professionalProfiles, profiles } from "./organizations";
import { patients } from "./patients";

// Grupo 4: encuesta. Estructura congelada hasta la entrega de Gildardo; las
// preguntas reales se cargan en el bloque clinico.

export const surveyTemplates = pgTable("survey_templates", {
  id: pk(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});

export const surveyVersions = pgTable(
  "survey_versions",
  {
    id: pk(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => surveyTemplates.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("survey_versions_template_version_unique").on(t.templateId, t.versionNumber)],
);

export const surveyQuestions = pgTable(
  "survey_questions",
  {
    id: pk(),
    surveyVersionId: uuid("survey_version_id")
      .notNull()
      .references(() => surveyVersions.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    questionType: text("question_type").notNull(), // texto, numero, opcion, opcion_multiple
    // Identificador estable del campo en el motor clinico (d-field: d5_39, d3_24...).
    // Es el puente questionId (UUID) -> variable que leen calcLE8/computeDFIFromData.
    // Nullable: solo las preguntas que alimentan el motor lo llevan; el resto de la
    // encuesta (instrumento clinico completo) queda en null. Las cadenas de opcion
    // deben coincidir CARACTER por caracter con lo que espera el motor congelado.
    fieldKey: text("field_key"),
    // Dominio de la encuesta (D1-D8) al que pertenece, para agrupar visualmente en el
    // intake (B7.1). Etiqueta orientada al paciente, sin jerga. Nullable por si una
    // pregunta no cae en un dominio; el intake la agrupa en "Otras" en ese caso.
    section: text("section"),
    orderIndex: integer("order_index").notNull(),
    dataClass: fieldDataClass("data_class").notNull(), // clasificacion de 3 niveles
    usedInDiagnosis: boolean("used_in_diagnosis").notNull().default(false),
  },
  (t) => [unique("survey_questions_version_order_unique").on(t.surveyVersionId, t.orderIndex)],
);

export const surveyOptions = pgTable("survey_options", {
  id: pk(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => surveyQuestions.id, { onDelete: "cascade" }),
  optionText: text("option_text").notNull(),
  value: numeric("value"),
  orderIndex: integer("order_index").notNull(),
});

export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: pk(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    surveyVersionId: uuid("survey_version_id")
      .notNull()
      .references(() => surveyVersions.id),
    ipAddress: inet("ip_address"),
    createdAt: createdAt(),
  },
  (t) => [index("survey_responses_eval_idx").on(t.evaluationId)],
);

export const surveyAnswers = pgTable(
  "survey_answers",
  {
    id: pk(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => surveyResponses.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => surveyQuestions.id),
    answerValue: text("answer_value"),
  },
  (t) => [index("survey_answers_response_idx").on(t.responseId)],
);

// Links de acceso a la encuesta publica (B7). El token opaco de la URL mapea, en
// servidor, a (profesional, organizacion); aqui vive ese mapeo y el estado del
// link. Una sola tabla cubre los dos tipos:
//   - inicial: link generico y reusable que el profesional comparte como QR. No
//     carga PII de nadie (patient_id/prefill null); no expira ni se consume.
//   - seguimiento: emitido para un paciente concreto, de un solo uso. Pre-carga
//     campos estables (cuasi-identificadores: ciudad, celular), se vence al
//     completar (consumed_at) con colchon de 30 dias (expires_at).
// Lectura publica del token en el intake: via service_role (sin sesion), por eso
// no lleva policy de SELECT para anon. El profesional emite links con su sesion
// (INSERT con RLS); consumir/expirar lo hace el intake con service_role.
export const surveyLinks = pgTable(
  "survey_links",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "restrict" }),
    type: evaluationType("type").notNull(), // inicial (reusable) | seguimiento (un uso)
    token: text("token").notNull(), // opaco, alta entropia
    patientId: uuid("patient_id").references(() => patients.id, {
      onDelete: "cascade",
    }), // solo seguimiento
    prefill: jsonb("prefill"), // solo seguimiento: cuasi-identificadores editables
    expiresAt: timestamp("expires_at", { withTimezone: true }), // seguimiento: now()+30d
    consumedAt: timestamp("consumed_at", { withTimezone: true }), // seguimiento: al completar
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("survey_links_token_unique").on(t.token),
    index("survey_links_professional_idx").on(t.professionalId),
    // Un solo link base (inicial reusable) por profesional: garantia a nivel de BD contra una
    // condicion de carrera que crearia dos QR distintos para el mismo consultorio. Parcial: solo
    // aplica a los links iniciales reusables (patient_id null); los de seguimiento no se limitan.
    uniqueIndex("survey_links_base_unique")
      .on(t.professionalId)
      .where(sql`type = 'inicial' and patient_id is null`),
  ],
);
