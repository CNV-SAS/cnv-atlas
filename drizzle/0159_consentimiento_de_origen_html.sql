-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL CONSENTIMIENTO DE ORIGEN HTML  ·  Importacion desde el HTML, sesion 1  ·  2026-09-22
--
-- LA REGLA DEL LEGAL (respuesta del 2026-09-21, punto 2): el consentimiento que el paciente firmo en el HTML
-- se importa COMO LO QUE ES, de origen HTML, con su version, su texto y su hash. No se convierte en uno de
-- Atlas. Por eso vive en una tabla PROPIA y no en `patient_consents`: esa tabla es la que lee el gate de la
-- regla dura 15, y un consentimiento firmado sin codigo de verificacion no puede habilitar una evaluacion de
-- Atlas. El paciente firma el de Atlas en su proxima consulta (el enlace de seguimiento ya lo exige).
--
-- DOS TABLAS: el LOTE (quien importo, cuando, desde que archivo y con que declaracion del profesional) y el
-- CONSENTIMIENTO de cada consulta del HTML. El HTML pedia el consentimiento en cada consulta, asi que un
-- paciente puede traer varios, uno por fecha de consulta.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. EL LOTE ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "html_import_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- La cuenta del profesional a la que se importa (la eligio el admin en la revision).
  "professional_id" uuid NOT NULL REFERENCES "professional_profiles"("id") ON DELETE RESTRICT,
  -- Quien importo: solo admin (decision de Santiago, 2026-09-21).
  "imported_by" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE RESTRICT,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- El archivo de exportacion: su nombre y el hash de su contenido, para poder decir de donde salio cada fila.
  "source_file_name" text NOT NULL,
  "source_file_hash" text NOT NULL,
  -- La declaracion del profesional al exportar (punto 8 del legal), con su version: es una afirmacion suya
  -- con consecuencias, y si cambia su redaccion lo declarado antes tiene que seguir diciendo lo que decia.
  "declaration_version" text NOT NULL,
  "declared_at" timestamp with time zone NOT NULL,
  "patient_count" integer DEFAULT 0 NOT NULL,
  "consultation_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "html_import_batches_hash" CHECK (length("source_file_hash") = 64)
);--> statement-breakpoint

-- ── 2. EL CONSENTIMIENTO DE CADA CONSULTA DEL HTML ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "patient_external_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
  "batch_id" uuid NOT NULL REFERENCES "html_import_batches"("id") ON DELETE RESTRICT,
  -- De donde viene. Hoy solo el HTML; el CHECK lo cierra para que otro origen sea una decision, no un typo.
  "origin" text NOT NULL,
  -- La version del texto como la nombra el HTML ("Encuesta CNV v3.0") y el hash del texto archivado
  -- (src/modules/consent/text/consent-html-cnv-v3.0.ts), calculado como el de Atlas.
  "text_version" text NOT NULL,
  "document_hash" text NOT NULL,
  -- LO QUE EL HTML GUARDO, TAL CUAL: el nombre que se tecleo y la fecha como texto ("22 de septiembre de
  -- 2026"). La fecha no se convierte: si el formato no se entiende, se perderia el dato original.
  "typed_name" text NOT NULL,
  "recorded_date" text NOT NULL,
  -- La consulta del HTML a la que pertenece (su `fechaConsulta`).
  "source_consultation_date" date NOT NULL,
  -- COMO SE FIRMO, que es lo que le da su fuerza probatoria: nombre tecleado, sin codigo de verificacion.
  "signature_method" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "patient_external_consents_origin" CHECK ("origin" IN ('html')),
  CONSTRAINT "patient_external_consents_method" CHECK ("signature_method" IN ('nombre_tecleado_sin_codigo')),
  CONSTRAINT "patient_external_consents_hash" CHECK (length("document_hash") = 64),
  CONSTRAINT "patient_external_consents_uno_por_consulta" UNIQUE ("patient_id", "origin", "source_consultation_date")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patient_external_consents_patient_idx"
  ON "patient_external_consents" ("patient_id");--> statement-breakpoint

-- ── 3. INMUTABLE ───────────────────────────────────────────────────────────────────────────────────
-- Es un registro de lo que el paciente acepto en otro sistema: no se corrige. Si se importo mal, el lote se
-- revisa, no se reescribe la fila.
CREATE OR REPLACE FUNCTION public.patient_external_consents_inmutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Un consentimiento de origen externo no se modifica.';
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "patient_external_consents_inmutable_trg" ON "patient_external_consents";--> statement-breakpoint
CREATE TRIGGER "patient_external_consents_inmutable_trg"
  BEFORE UPDATE ON "patient_external_consents"
  FOR EACH ROW EXECUTE FUNCTION public.patient_external_consents_inmutable();--> statement-breakpoint

-- ── 4. QUIEN LO LEE ────────────────────────────────────────────────────────────────────────────────
-- Lo ve quien ve al paciente (su profesional y admin), igual que `patient_consents`. Nadie lo escribe desde
-- una sesion: la importacion corre en el servidor como owner, con la auditoria del lote.
ALTER TABLE "html_import_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "patient_external_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "html_import_batches_select" ON "html_import_batches";--> statement-breakpoint
CREATE POLICY "html_import_batches_select" ON "html_import_batches"
  FOR SELECT TO authenticated USING (public.has_role('admin'));--> statement-breakpoint
DROP POLICY IF EXISTS "patient_external_consents_select" ON "patient_external_consents";--> statement-breakpoint
CREATE POLICY "patient_external_consents_select" ON "patient_external_consents"
  FOR SELECT TO authenticated USING (
    public.is_patient_professional(patient_id) OR public.has_role('admin')
  );
