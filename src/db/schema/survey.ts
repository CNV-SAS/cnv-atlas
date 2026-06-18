import {
  boolean,
  index,
  inet,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { fieldDataClass } from "./enums";
import { evaluations } from "./evaluations";

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
    questionType: text("question_type").notNull(), // texto, numero, opcion
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
