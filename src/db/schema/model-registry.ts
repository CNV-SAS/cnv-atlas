import { sql } from "drizzle-orm";
import {
  integer,
  numeric,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { indicatorClassification, modelStatus } from "./enums";

// Grupo 3: modelo cientifico (registry). El contenido clinico (indicadores, rangos,
// fenotipos, sectores, Diana) esta CONGELADO hasta la entrega de Gildardo; aqui se
// define solo la estructura que lo contiene.

export const modelVersions = pgTable(
  "model_versions",
  {
    id: pk(),
    versionName: text("version_name").notNull().unique(), // "ANI-BIS-E 1.0"
    rulesVersion: text("rules_version").notNull(), // version de las reglas diagnosticas
    description: text("description"),
    status: modelStatus("status").notNull().default("draft"),
    createdAt: createdAt(),
  },
  // Solo una version 'active' a la vez (indice parcial + validacion en aplicacion).
  (t) => [
    uniqueIndex("model_versions_one_active_idx")
      .on(t.status)
      .where(sql`status = 'active'`),
  ],
);

export const modelVariables = pgTable("model_variables", {
  id: pk(),
  modelVersionId: uuid("model_version_id")
    .notNull()
    .references(() => modelVersions.id, { onDelete: "cascade" }),
  variableName: text("variable_name").notNull(),
  description: text("description"),
});

export const indicatorDefinitions = pgTable(
  "indicator_definitions",
  {
    id: pk(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => modelVersions.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // IFC, IRC, IEHH, ...
    name: text("name").notNull(),
    unit: text("unit"),
    description: text("description"),
  },
  (t) => [unique("indicator_definitions_model_code_unique").on(t.modelVersionId, t.code)],
);

export const indicatorRanges = pgTable("indicator_ranges", {
  id: pk(),
  indicatorDefinitionId: uuid("indicator_definition_id")
    .notNull()
    .references(() => indicatorDefinitions.id, { onDelete: "cascade" }),
  minValue: numeric("min_value"),
  maxValue: numeric("max_value"),
  classification: indicatorClassification("classification").notNull(),
});

// Catalogo de fenotipos MCCB (F1-F12, FMI x FFMI x MCA). Validado contra el v7.
export const phenotypes = pgTable(
  "phenotypes",
  {
    id: pk(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => modelVersions.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // F1..F12
    name: text("name").notNull(),
    risk: text("risk"),
  },
  (t) => [unique("phenotypes_model_code_unique").on(t.modelVersionId, t.code)],
);

// Catalogo de sectores funcionales FR (S1-S9, IFC x IRC). Validado contra el v7.
export const frSectors = pgTable(
  "fr_sectors",
  {
    id: pk(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => modelVersions.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // S1..S9
    name: text("name").notNull(),
  },
  (t) => [unique("fr_sectors_model_code_unique").on(t.modelVersionId, t.code)],
);

// Diana EFR de 81 estados: lookup por la combinacion de 4 bandas (IFC, IRC, FFMI,
// FMI), versionado y con su contenido clinico.
export const efrStates = pgTable(
  "efr_states",
  {
    id: pk(),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => modelVersions.id, { onDelete: "cascade" }),
    stateNumber: integer("state_number").notNull(), // 1..81
    ifcBand: integer("ifc_band").notNull(), // bandas que forman la llave
    ircBand: integer("irc_band").notNull(),
    ffmiBand: integer("ffmi_band").notNull(),
    fmiBand: integer("fmi_band").notNull(),
    // Lenguaje FUNCIONAL ("Estado funcional deteriorado"), no de enfermedad;
    // contenido validado con Gildardo al poblar el registry (B11).
    diagnosisName: text("diagnosis_name").notNull(),
    mechanism: text("mechanism"),
    biomarkers: text("biomarkers"),
    risks: text("risks"),
    suggestedNutraceuticals: text("suggested_nutraceuticals"),
  },
  (t) => [
    unique("efr_states_model_state_unique").on(t.modelVersionId, t.stateNumber),
    unique("efr_states_model_bands_unique").on(
      t.modelVersionId,
      t.ifcBand,
      t.ircBand,
      t.ffmiBand,
      t.fmiBand,
    ),
  ],
);
