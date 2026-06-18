import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, pk, updatedAt } from "./_columns";
import { deviceStatus } from "./enums";
import { evaluations } from "./evaluations";
import { organizations } from "./organizations";

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
