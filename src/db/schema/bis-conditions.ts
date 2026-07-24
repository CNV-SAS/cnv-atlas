import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { bisConditionFieldType, bisConditionKind, bisConditionScope } from "./enums";
import { evaluations } from "./evaluations";

// Grupo 18: condiciones de la toma BIS (Parte 2 de captura de la pestana Evaluacion).
// La lista de condiciones es VERSIONADA (la investigacion del ObBIA puede cambiarla); cada
// captura por evaluacion SELLA la version que respondio, igual que la constelacion de
// versiones del registro clinico (ARCHITECTURE.md regla 7, patron model_version).

export const bisConditionVersions = pgTable(
  "bis_condition_versions",
  {
    id: pk(),
    versionNumber: integer("version_number").notNull(),
    // Activa = la de mayor published_at (mismo patron que survey_versions).
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"), // por que esta version (gobierno del cambio)
  },
  (t) => [unique("bis_condition_versions_number_unique").on(t.versionNumber)],
);

export const bisConditions = pgTable(
  "bis_conditions",
  {
    id: pk(),
    bisConditionVersionId: uuid("bis_condition_version_id")
      .notNull()
      .references(() => bisConditionVersions.id, { onDelete: "cascade" }),
    // Clave estable de la condicion (marcapasos, placas_metalicas, embarazo...). El sello
    // (version) + la clave identifican cada respuesta dentro del JSONB de la captura.
    key: text("key").notNull(),
    label: text("label").notNull(), // la pregunta que ve el profesional
    scope: bisConditionScope("scope").notNull(), // general | mujeres (bloque femenino)
    kind: bisConditionKind("kind").notNull(), // calidad | contraindicacion | advertencia
    // Como se captura la respuesta principal: boolean (Si/No, la mayoria) o number (semana del
    // ciclo, 1-6, siempre visible, sin Si/No). El JSONB de la captura guarda el valor con esta
    // forma; el widget se elige por este tipo, no por la clave.
    inputType: bisConditionFieldType("input_type").notNull().default("boolean"),
    // Detalle adicional cuando la respuesta principal es "si" (embarazo -> mes de gestacion;
    // menstruacion -> dia del periodo; diuretico -> "¿cual?"). requiresDetail marca que lo pide,
    // detailLabel es la etiqueta humana y detailType el widget del detalle (number | text).
    requiresDetail: boolean("requires_detail").notNull().default(false),
    detailLabel: text("detail_label"),
    detailType: bisConditionFieldType("detail_type"),
    orderIndex: integer("order_index").notNull(),
  },
  (t) => [
    unique("bis_conditions_version_key_unique").on(t.bisConditionVersionId, t.key),
    unique("bis_conditions_version_order_unique").on(t.bisConditionVersionId, t.orderIndex),
  ],
);

export const evaluationBisIntake = pgTable(
  "evaluation_bis_intake",
  {
    id: pk(),
    // Una captura por evaluacion (unique).
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    // SELLO: la version de la lista que se respondio (constelacion de versiones, regla 7).
    bisConditionVersionId: uuid("bis_condition_version_id")
      .notNull()
      .references(() => bisConditionVersions.id),
    // Snapshot sellado de las respuestas: { [key]: { value: boolean | number, detail?: string |
    // number } }. El valor no es solo booleano (semana del ciclo = numero; diuretico lleva detail
    // de texto; dia/mes son detail numerico), acorde a inputType/detailType del catalogo. JSONB
    // (no relacional) porque es autoconsistente con su version y no se consulta en agregado
    // (mismo criterio que reports.snapshot).
    conditionAnswers: jsonb("condition_answers").notNull(),
    // Denormalizado y sellado: true si se respondio "si" a una condicion de tipo
    // contraindicacion (hoy solo el marcapasos). Es la COMPUERTA de seguridad del import BIS;
    // se computa una vez al guardar para que el bloqueo sea un check simple y robusto, no una
    // recomputacion del JSONB + catalogo en cada lectura. No recomputar despues.
    contraindicated: boolean("contraindicated").notNull().default(false),
    // Fuerza prensil (kg): captura OPCIONAL en Atlas. Solo el dato; no viene del Biody, no
    // alimenta el motor (Q5) y el veredicto de sarcopenia es materia de Diagnostico.
    gripStrengthKg: numeric("grip_strength_kg"),
    // Meta de peso (kg): la fija el PROFESIONAL (su recomendacion clinica). Campo propio; no
    // se hereda del Delta de la tabla de composicion (semantica de signo confusa).
    weightGoalKg: numeric("weight_goal_kg"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("evaluation_bis_intake_evaluation_unique").on(t.evaluationId)],
);
