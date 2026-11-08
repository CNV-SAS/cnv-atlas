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
    // Texto de AYUDA opcional bajo el enunciado (el `sub` del instrumento de Gildardo): ejemplos de
    // alimentos y ancla de porcion en D1 ("espinaca, acelga...; un puno cerrado"), o una aclaracion de item
    // ("Padres, hermanos, abuelos"). Display puro: el motor NUNCA lo lee (solo lee option_text). Nullable.
    hint: text("hint"),
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL INSTRUMENTO, SEPARADO DE LA VERSION  ·  0240, v15 §2
//
// `survey_versions` dice QUE preguntas hay; `survey_instruments` dice COMO se aplican en una consulta.
// Los dos instrumentos (la linea base y la CNV-S de seguimiento) apuntan a LAS MISMAS filas de
// `survey_questions`, que es lo que hace ESTRUCTURAL la invariancia de su §7.4: no hay dos textos de la
// misma pregunta que se puedan separar al editar uno. La razon larga esta en la migracion.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export const surveyInstruments = pgTable("survey_instruments", {
  id: pk(),
  /** "CNV v2.0" | "CNV-S 1.0". Es el que se guarda en los DATOS, y es suyo. */
  codigo: text("codigo").notNull().unique(),
  /** Lo que se lee en PANTALLA ("Encuesta CNV v3.0"). Su nota del 30-oct pide las dos cosas distintas. */
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Los cinco comportamientos de su tabla 3. `propio` es el Modulo S, que no existe en la linea base. */
export const COMPORTAMIENTOS_DEL_ITEM = [
  "repetir",
  "repetir_con_filtro",
  "confirmar",
  "retirar",
  "propio",
] as const;

export const surveyInstrumentItems = pgTable(
  "survey_instrument_items",
  {
    id: pk(),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => surveyInstruments.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => surveyQuestions.id, { onDelete: "cascade" }),
    comportamiento: text("comportamiento").notNull(),
    /** La pregunta filtro de un `repetir_con_filtro` (su §7.2, los sintomas digestivos). */
    filtroQuestionId: uuid("filtro_question_id").references(() => surveyQuestions.id),
    orderIndex: integer("order_index").notNull(),
  },
  (t) => [
    unique("survey_instrument_items_question_unique").on(t.instrumentId, t.questionId),
    unique("survey_instrument_items_order_unique").on(t.instrumentId, t.orderIndex),
    index("survey_instrument_items_instrument_idx").on(t.instrumentId, t.orderIndex),
  ],
);

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
    /**
     * CON QUE INSTRUMENTO se aplico (0240). NULL en las anteriores: son todas de linea base, y no se
     * rellenan hacia atras porque eso afirmaria sobre una encuesta pasada algo que nadie decidio entonces.
     */
    instrumentId: uuid("instrument_id").references(() => surveyInstruments.id),
    /** Su `encuestaMinutos` (§2.7): cuanto tardo en diligenciarse. */
    minutosDeDiligenciamiento: integer("minutos_de_diligenciamiento"),
    /** Su `cnvsConfirmacion` (§2.7): por item confirmado, `sin_cambios` | `editado` | `sin_marcar`. */
    confirmacion: jsonb("confirmacion"),
    /**
     * Cuando se hizo la reconfirmacion anual completa EN esta encuesta. NULL = no se hizo.
     *
     * ES UNA FECHA Y NO UN BOOLEANO: lo que la regla anual necesita saber es CUANDO fue la ultima
     * confirmacion completa, no si hubo alguna. Con un booleano habria que ir a buscar la fecha a
     * `created_at` de otra fila, y entonces la regla dependeria de dos datos en vez de uno.
     */
    reconfirmacionAnualAt: timestamp("reconfirmacion_anual_at", { withTimezone: true }),
    ipAddress: inet("ip_address"),
    // Procedencia: el lote que las importo del HTML (0162).
    importBatchId: uuid("import_batch_id"),
    // QUIEN CERRO LA ENCUESTA cuando no fue el paciente (0172): el profesional que la registro en consulta.
    // NULA = la autodiligencio el paciente, que es el caso normal. No es la misma evidencia: la seccion S de
    // la HC dice "lo que el paciente refiere", y la presencia del profesional cambia lo que la gente
    // responde. Se escribe desde la RUTA AUTENTICADA, no desde una casilla que alguien marca.
    capturedBy: uuid("captured_by").references(() => profiles.id),
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
  // UNIQUE (response_id, question_id): una respuesta por pregunta en cada response. El camino de la app ya es
  // idempotente (intake/survey-edit hacen delete-then-insert; la correccion escribe a un response nuevo), pero
  // sin restriccion nada lo garantiza estructuralmente: un writer futuro que olvide el delete, o una carrera,
  // podrian duplicar, y el guard de correccion lee sin ORDER BY y deduplica con Map (gana una fila arbitraria).
  // La restriccion cierra esa clase de bug (un doble insert falla en el acto, como habria pasado con el fixture).
  (t) => [
    index("survey_answers_response_idx").on(t.responseId),
    unique("survey_answers_response_question_unique").on(t.responseId, t.questionId),
  ],
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
