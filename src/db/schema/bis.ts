import {
  date,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { bisValueOrigin, deviceStatus } from "./enums";
import { evaluations } from "./evaluations";
import { organizations, profiles } from "./organizations";

// Grupo 6: BIS (bioimpedancia). El import del export XLSX de Biody Manager se
// modela flexible (nombre+valor) para absorberlo sin conocer su forma exacta.

export const devices = pgTable("devices", {
  id: pk(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  assetCode: text("asset_code").notNull().unique(), // CNV-BIS-0001
  manufacturerSerial: text("manufacturer_serial").notNull().unique(), // serial de fabrica
  systemEmail: text("system_email").notNull().unique(), // login Biody Manager (clave en vault)
  brand: text("brand"), // marca del fabricante; el asset_code es agnostico de ella
  model: text("model").notNull(), // Biody B.I.S ZM
  supplier: text("supplier"), // Aminogram
  purchaseDate: date("purchase_date"),
  status: deviceStatus("status").notNull().default("available"),
  lastCalibrationDate: date("last_calibration_date"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const bisVariables = pgTable("bis_variables", {
  id: pk(),
  name: text("name").notNull().unique(), // resistencia, reactancia, angulo de fase
  unit: text("unit"),
  description: text("description"),
});

export const bisMeasurements = pgTable(
  "bis_measurements",
  {
    id: pk(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").references(() => devices.id),
    measurementDate: timestamp("measurement_date", { withTimezone: true }).notNull(),
    deviceCalibrationDate: date("device_calibration_date"), // snapshot de calibracion al escanear
    createdAt: createdAt(),
  },
  (t) => [index("bis_measurements_eval_idx").on(t.evaluationId)],
);

export const bisRawValues = pgTable(
  "bis_raw_values",
  {
    id: pk(),
    measurementId: uuid("measurement_id")
      .notNull()
      .references(() => bisMeasurements.id, { onDelete: "cascade" }),
    variableName: text("variable_name").notNull(),
    value: numeric("value").notNull(),
    // Procedencia del valor (EA1). 'medido' = lo trajo el equipo; 'derivado' = lo reconstruyo la
    // derivacion de composicion (derivar-composicion.js) por ser un hueco del export corto. Default
    // 'medido' para que las filas historicas (antes de EA1) queden correctamente marcadas como medidas.
    origin: bisValueOrigin("origin").notNull().default("medido"),
    // Version de la formula de derivacion (ESPECTRO_FORMULAS_V) con la que se produjo un valor
    // 'derivado'; null en los medidos. Deja reconstruir la procedencia si la ciencia se versiona.
    derivedFormulaVersion: text("derived_formula_version"),
  },
  (t) => [index("bis_raw_values_measurement_idx").on(t.measurementId)],
);

export const bisImportLogs = pgTable("bis_import_logs", {
  id: pk(),
  evaluationId: uuid("evaluation_id").references(() => evaluations.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull(), // ok, validation_failed, parse_failed
  errorDetail: text("error_detail"),
  createdAt: createdAt(),
});

// Correccion de una medida antropometrica de una medicion BIS. NO sobrescribe bis_raw_values: el crudo
// del equipo se conserva como evidencia de lo que ese aparato midio, y la pantalla puede mostrar cual es
// cual. Solo peso, estatura, cintura y cadera; solo ANTES del diagnostico (despues el camino es el flujo
// de correccion, que versiona). Ver la migracion 0089 para el porque completo.
export const bisValueCorrections = pgTable(
  "bis_value_corrections",
  {
    measurementId: uuid("measurement_id")
      .notNull()
      .references(() => bisMeasurements.id, { onDelete: "cascade" }),
    variableName: text("variable_name").notNull(),
    // Lo que midio el EQUIPO. El valor vigente vive en bis_raw_values (invertido en 0090).
    originalValue: numeric("original_value").notNull(),
    correctedBy: uuid("corrected_by")
      .notNull()
      .references(() => profiles.id),
    correctedByEmail: text("corrected_by_email").notNull(),
    correctedAt: timestamp("corrected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.measurementId, t.variableName] })],
);
