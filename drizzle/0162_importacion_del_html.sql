-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA IMPORTACION DESDE EL HTML, SESION 4  ·  2026-09-22
--
-- Lo que hace falta para IMPORTAR y para DESHACER un lote. Todo aditivo: ninguna fila existente cambia.
--
--   1. La PROCEDENCIA en las tres tablas que recibe la importacion (aprobado por Santiago): saber que una
--      consulta, sus respuestas y su medicion vinieron de un lote, y poder retirarlas enteras.
--   2. Los PACIENTES QUE CREO el lote, para que deshacer no borre a un paciente que ya existia en Atlas y
--      solo recibio consultas nuevas (a ese se le quitan las consultas, no la ficha).
--   3. La consulta SIN FIRMA tambien se registra: el legal dijo que se importa igual, con el consentimiento
--      marcado "origen HTML, sin prueba de firma". Por eso el nombre tecleado pasa a ser opcional y el
--      metodo admite ese segundo valor.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. PROCEDENCIA ──────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "evaluations"
  ADD COLUMN IF NOT EXISTS "import_batch_id" uuid REFERENCES "html_import_batches"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "survey_responses"
  ADD COLUMN IF NOT EXISTS "import_batch_id" uuid REFERENCES "html_import_batches"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "bis_measurements"
  ADD COLUMN IF NOT EXISTS "import_batch_id" uuid REFERENCES "html_import_batches"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_import_batch_idx" ON "evaluations" ("import_batch_id");--> statement-breakpoint

-- ── 2. LOS PACIENTES QUE CREO EL LOTE ───────────────────────────────────────────────────────────────
-- En el lote y no en `patients`: es un dato del lote (que trajo), no del paciente. Deshacer borra SOLO los
-- de esta lista, y solo si no les quedo nada mas colgando.
ALTER TABLE "html_import_batches"
  ADD COLUMN IF NOT EXISTS "created_patient_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Cuando se deshace, con quien y cuando. La fila del lote NO se borra: es la constancia de que existio.
ALTER TABLE "html_import_batches"
  ADD COLUMN IF NOT EXISTS "reverted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "html_import_batches"
  ADD COLUMN IF NOT EXISTS "reverted_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- ── 3. LA CONSULTA SIN FIRMA ────────────────────────────────────────────────────────────────────────
ALTER TABLE "patient_external_consents" ALTER COLUMN "typed_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_external_consents" DROP CONSTRAINT IF EXISTS "patient_external_consents_method";--> statement-breakpoint
ALTER TABLE "patient_external_consents"
  ADD CONSTRAINT "patient_external_consents_method"
  CHECK ("signature_method" IN ('nombre_tecleado_sin_codigo', 'sin_prueba_de_firma'));--> statement-breakpoint
-- Y el nombre va CON el metodo: con nombre tecleado hay nombre; sin prueba de firma, no.
ALTER TABLE "patient_external_consents" DROP CONSTRAINT IF EXISTS "patient_external_consents_nombre_con_metodo";--> statement-breakpoint
ALTER TABLE "patient_external_consents"
  ADD CONSTRAINT "patient_external_consents_nombre_con_metodo"
  CHECK (("signature_method" = 'nombre_tecleado_sin_codigo') = ("typed_name" IS NOT NULL));
