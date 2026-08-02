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
    // Versiones de emision emergentes (Q20 clasificacion, C2b calibracion), selladas write-once por
    // el trigger 0028. Complementa la constelacion tipada de arriba (regla 7); las claves salen de
    // constantes (clinical-pipeline/emission-versions.ts). NULL en diagnosticos previos a esta
    // columna (solo demo, no hay reales); no es bug.
    emissionVersions: jsonb("emission_versions"),
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
