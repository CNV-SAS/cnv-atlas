import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { aiSuggestionStatus, professionalProfession } from "./enums";
import { evaluations } from "./evaluations";
import { frSectors, modelVersions, phenotypes } from "./model-registry";
import { profiles } from "./organizations";
import { surveyVersions } from "./survey";
import { treatments } from "./treatments";

// Grupo 8: diagnostico. El estado EFR lo resuelve el motor de forma determinista
// (via la Diana), NO la IA. El profesional confirma.

export const diagnoses = pgTable(
  "diagnoses",
  {
    id: pk(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "restrict" }),
    efrStateNumber: integer("efr_state_number").notNull(), // 1..81
    // Sella la clasificacion estructural de NUEVE estados (STRUCT, FFMI x FMI, band-pair como "N_A"),
    // que es el componente estructural del estado EFR. NO es el MCCB F1-F12 (el comentario viejo
    // "F1..F12" estaba mal): el MCCB es la OTRA clasificacion estructural (Q19), se sella en el
    // snapshot de reports (no como columna: decision 2026-08-02, ver types.ts fenotipoMCCB), y se
    // marca en emission_versions.structural_mccb. Son dos clasificaciones del mismo eje FFMI x FMI,
    // ninguna deriva de la otra, cada una responde una pregunta distinta.
    phenotypeId: uuid("phenotype_id").references(() => phenotypes.id), // STRUCT de 9 (FFMI x FMI)
    frSectorId: uuid("fr_sector_id").references(() => frSectors.id), // sector FyR de 9 (IFC x IRC)
    diagnosisName: text("diagnosis_name").notNull(),
    // Constelacion de versiones:
    engineVersion: text("engine_version").notNull(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => modelVersions.id),
    rulesVersion: text("rules_version").notNull(),
    // survey_version_id: cierra la constelacion de la regla 7 en la PROPIA fila (antes solo era
    // reconstruible via indicator_values / el snapshot). Nullable: diagnosticos previos a esta columna
    // no lo tienen (solo demo). Lo puebla el writer, que ya recibe surveyVersionId en su input.
    surveyVersionId: uuid("survey_version_id").references(() => surveyVersions.id),
    // Versiones de emision emergentes (Q20 clasificacion, C2b calibracion), selladas write-once por
    // el trigger 0028. Complementa la constelacion tipada de arriba (regla 7); las claves salen de
    // constantes (clinical-pipeline/emission-versions.ts). NULL en diagnosticos previos a esta
    // columna (solo demo, no hay reales); no es bug.
    emissionVersions: jsonb("emission_versions"),
    confirmedBy: uuid("confirmed_by").references(() => profiles.id), // profesional que confirma
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    // Profesion CON QUE se confirmo, sellada EN el acto (no solo confirmed_by = quien): un acto clinico
    // registra las condiciones bajo las que se ejecuto (como approvedProfession del protocolo). Hoy la
    // confirmacion la autoriza la ASIGNACION (no una profesion), pero Q17 sigue abierta y confirmed_* es
    // write-once: si no se sella ahora, no se puede agregar despues. null cuando confirma un no-profesional
    // (p. ej. admin via approveReport). Se congela con confirmed_by (trigger 0027, extendido en 0037).
    confirmedProfession: professionalProfession("confirmed_profession"),
    createdAt: createdAt(),
  },
  (t) => [index("diagnoses_eval_idx").on(t.evaluationId)],
);

export const diagnosisNotes = pgTable("diagnosis_notes", {
  id: pk(),
  diagnosisId: uuid("diagnosis_id")
    .notNull()
    .references(() => diagnoses.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  // Marca de PROCEDENCIA: "hubo asistencia de IA" al componer este criterio (el profesional genero un
  // borrador con IA, aunque lo haya reescrito entero). false si lo escribio a mano sin generar. NO dice
  // "esto lo escribio la IA": el criterio es suyo, lo asumio al guardar. Solo para la traza/auditoria (si
  // algun dia se cuestiona un criterio, importa saber si venia generado); NO se muestra en pantalla.
  aiAssisted: boolean("ai_assisted").notNull().default(false),
  createdAt: createdAt(),
});

// IA de apoyo: genera el MENU/dieta dados los objetivos del protocolo, NO el
// diagnostico (ese es determinista). Inmutable, sin PII.
export const aiMenuSuggestions = pgTable(
  "ai_menu_suggestions",
  {
    id: pk(),
    treatmentId: uuid("treatment_id")
      .notNull()
      .references(() => treatments.id, { onDelete: "cascade" }),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => profiles.id),
    provider: text("provider").notNull(), // groq, gemini
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    generatedText: text("generated_text"), // el menu generado (v2: prosa; v3: el JSON crudo)
    // v3: el menu ya parseado. NULL en las filas de la v2 y en los intentos fallidos.
    menuJson: jsonb("menu_json"),
    // Hallazgos del cruce de alergenos. Array VACIO = se cruzo y no habia nada; NULL = no se pudo
    // cruzar (menu v2 o parseo fallido). No son lo mismo aguas abajo.
    alergenosDetectados: jsonb("alergenos_detectados"),
    // Choques con el patron alimentario. Aparte de los alergenos a proposito: mismo mecanismo, pero
    // uno es SEGURIDAD (lista cerrada) y el otro ADHERENCIA (categorias abiertas, sin completitud).
    patronConflictos: jsonb("patron_conflictos"),
    rawResponse: jsonb("raw_response"),
    status: aiSuggestionStatus("status").notNull(),
    latencyMs: integer("latency_ms"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_menu_suggestions_treatment_idx").on(t.treatmentId)],
);

// IA de apoyo: genera un BORRADOR del criterio del profesional dados los indicadores, el estado EFR y los
// dominios (todo del snapshot, PII-free), NO el diagnostico (determinista). Inmutable (sin UPDATE/DELETE
// por RLS): cada generacion, exitosa o fallida, deja su fila con procedencia (proveedor/modelo/version de
// prompt/estado). Hermana de ai_menu_suggestions; misma disciplina de "todo lo que la IA produce deja
// rastro". El borrador nunca se aplica solo: cae en el campo editable y el profesional decide.
export const aiCriterionSuggestions = pgTable(
  "ai_criterion_suggestions",
  {
    id: pk(),
    diagnosisId: uuid("diagnosis_id")
      .notNull()
      .references(() => diagnoses.id, { onDelete: "cascade" }),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => profiles.id),
    provider: text("provider").notNull(), // groq, gemini
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    generatedText: text("generated_text"), // el borrador de criterio generado
    rawResponse: jsonb("raw_response"),
    status: aiSuggestionStatus("status").notNull(),
    latencyMs: integer("latency_ms"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_criterion_suggestions_diagnosis_idx").on(t.diagnosisId)],
);

// Descarte del aviso de alergeno. Tabla de DOMINIO, no de traza: la pantalla la lee con la sesion del
// profesional. El mismo hecho deja su evento en clinical_audit_log, que es solo-admin y por eso no sirve
// para mostrar nada (ver 0088). Los dos se escriben en la misma transaccion.
export const menuAllergenDismissals = pgTable("menu_allergen_dismissals", {
  suggestionId: uuid("suggestion_id")
    .primaryKey()
    .references(() => aiMenuSuggestions.id, { onDelete: "cascade" }),
  dismissedBy: uuid("dismissed_by")
    .notNull()
    .references(() => profiles.id),
  dismissedByEmail: text("dismissed_by_email").notNull(),
  reason: text("reason").notNull(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
});
