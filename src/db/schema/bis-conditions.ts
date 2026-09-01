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
    kind: bisConditionKind("kind").notNull(), // calidad | contraindicacion | advertencia | validez
    // Data-driven: true si responder "si" a esta condicion COMPROMETE la validez del resultado y
    // debe sellarse un caveat visible en el diagnostico. Separado de kind: lo llevan tanto las
    // condiciones kind='validez' como el embarazo (advertencia; el modelo no esta validado en
    // gestacion). NO es por clave hardcodeada: el catalogo lo declara.
    compromisesValidity: boolean("compromises_validity").notNull().default(false),
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
    // Fuerza prensil (kg): captura del profesional (dinamometria). ENTRA AL MOTOR desde el 2026-08-31
    // (criterio primario del fenotipo, EWGSOP2 segun su §2 del 28); el veredicto de sarcopenia se pinta
    // en Diagnostico. Antes se capturaba y no la leia nadie.
    gripStrengthKg: numeric("grip_strength_kg"),
    // PESO META (kg). SITIO UNICO desde la migracion 0095: es UN dato con dos superficies de edicion (esta
    // pantalla y el panel de tratamiento), no dos datos. Gildardo, 2026-08-28 §2: "el peso meta no pertenece
    // al tratamiento, pertenece al paciente. El motor lo calcula como punto de partida, el profesional lo
    // fija, y el tratamiento lo LEE. No lo crea." Gobierna TODA la cadena calorica: gasto, objetivo y gramos
    // de proteina. No se hereda del Delta de la tabla de composicion (semantica de signo confusa).
    weightGoalKg: numeric("weight_goal_kg"),
    // De cual de las dos superficies salio. Es informacion clinica, no metadato: no es lo mismo el peso
    // acordado con el paciente en la consulta que uno ajustado despues al armar el plan. Viaja SIEMPRE con
    // el valor (CHECK de coherencia en la 0095): un valor sin procedencia es medio dato.
    weightGoalSetIn: text("weight_goal_set_in", { enum: ["entrada", "tratamiento"] }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("evaluation_bis_intake_evaluation_unique").on(t.evaluationId)],
);
