import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { aiSuggestionStatus } from "./enums";
import { evaluations } from "./evaluations";
import { frSectors, modelVersions, phenotypes } from "./model-registry";
import { profiles } from "./organizations";
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
    phenotypeId: uuid("phenotype_id").references(() => phenotypes.id), // F1..F12
    frSectorId: uuid("fr_sector_id").references(() => frSectors.id), // S1..S9
    diagnosisName: text("diagnosis_name").notNull(),
    // Constelacion de versiones:
    engineVersion: text("engine_version").notNull(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => modelVersions.id),
    rulesVersion: text("rules_version").notNull(),
    confirmedBy: uuid("confirmed_by").references(() => profiles.id), // profesional que confirma
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
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
    generatedText: text("generated_text"), // el menu generado
    rawResponse: jsonb("raw_response"),
    status: aiSuggestionStatus("status").notNull(),
    latencyMs: integer("latency_ms"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_menu_suggestions_treatment_idx").on(t.treatmentId)],
);
