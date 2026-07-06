import { pgEnum } from "drizzle-orm/pg-core";

// Enums centrales como tipos PostgreSQL (DATABASE.md, seccion Enums).
// Los valores se portan tal cual del documento; no se traducen ni se reordenan.

export const appRole = pgEnum("app_role", [
  "admin",
  "direccion",
  "soporte",
  "obbia",
  "professional",
]);

export const documentType = pgEnum("document_type", ["CC", "CE", "TI", "PA", "NIT"]);

export const patientStatus = pgEnum("patient_status", ["active", "inactive"]);

export const profileStatus = pgEnum("profile_status", ["active", "inactive"]);

export const evaluationType = pgEnum("evaluation_type", ["inicial", "seguimiento"]);

export const evaluationStatus = pgEnum("evaluation_status", [
  "draft",
  "in_progress",
  "completed",
]);

export const fieldDataClass = pgEnum("field_data_class", [
  "identifier",
  "quasi_identifier",
  "clinical",
]);

export const indicatorClassification = pgEnum("indicator_classification", [
  "normal",
  "riesgo",
  "critico",
]);

export const modelStatus = pgEnum("model_status", ["draft", "active", "retired"]);

export const deviceStatus = pgEnum("device_status", [
  "available",
  "in_use",
  "maintenance",
  "out_of_service",
  "lost",
  "retired",
]);

export const assignmentStatus = pgEnum("assignment_status", [
  "active",
  "completed",
  "breach",
]);

export const reportStatus = pgEnum("report_status", ["draft", "approved", "sent"]);

export const transactionStatus = pgEnum("transaction_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const aiSuggestionStatus = pgEnum("ai_suggestion_status", [
  "success",
  "timeout",
  "parse_failed",
  "provider_error",
]);

export const consentType = pgEnum("consent_type_enum", [
  "servicio",
  "datos_sensibles",
  "internacional_ia",
  "investigacion",
  "comunicaciones_continuidad",
  "comunicaciones_comerciales",
  // Menores de edad (DELTA2 A1). Se anexan al final para que Postgres emita
  // ALTER TYPE ADD VALUE y no recree el tipo (destructivo por las FK/columnas).
  "representante_legal",
  "asentimiento_menor",
]);
