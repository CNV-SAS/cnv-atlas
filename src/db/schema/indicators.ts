import { index, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { createdAt, pk } from "./_columns";
import { indicatorClassification } from "./enums";
import { evaluations } from "./evaluations";
import { indicatorDefinitions, modelVersions } from "./model-registry";
import { surveyVersions } from "./survey";

// Grupo 7: indicadores calculados. Cada valor guarda su constelacion de versiones
// (procedencia): con que motor, encuesta, modelo y reglas se calculo (principio 3).

export const indicatorValues = pgTable(
  "indicator_values",
  {
    id: pk(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    indicatorDefinitionId: uuid("indicator_definition_id")
      .notNull()
      .references(() => indicatorDefinitions.id),
    value: numeric("value").notNull(),
    classification: indicatorClassification("classification"),
    // Constelacion de versiones:
    engineVersion: text("engine_version").notNull(),
    surveyVersionId: uuid("survey_version_id")
      .notNull()
      .references(() => surveyVersions.id),
    modelVersionId: uuid("model_version_id")
      .notNull()
      .references(() => modelVersions.id),
    rulesVersion: text("rules_version").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("indicator_values_eval_idx").on(t.evaluationId)],
);
