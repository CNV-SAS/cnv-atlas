-- LA PRESCRIPCION APROBADA SE PUEDE REABRIR, y reabrirla deja rastro (Gildardo, 2026-08-30 §6c).
--
-- SU INSTRUCCION, textual: "La prescripcion aprobada se puede reabrir, y reabrirla dispara la regla de
-- reemision del 12b. EL SELLADO NO ES UN CANDADO: ES UNA CONSECUENCIA REGISTRADA. Un profesional que
-- necesita corregir un plan aprobado tiene que poder hacerlo; lo que no puede es que el cambio no deje
-- rastro ni le llegue al paciente que ya se lo llevo."
--
-- QUE CAMBIA Y QUE NO. Hasta hoy el trigger `treatments_immutability` prohibia CUALQUIER salida de
-- 'approved': ni volver a draft, ni tocar la prescripcion. Eso hacia imposible corregir un plan aprobado
-- por dentro de Atlas. Ahora se permite EXACTAMENTE UNA transicion nueva, approved -> draft, y solo si
-- viene sellada con quien, cuando y por que. Todo lo demas del trigger se conserva: `protocol_suggested`
-- sigue siendo write-once, y estando en 'approved' la prescripcion sigue congelada.
--
-- POR QUE HAY TABLA DE HISTORIA Y NO SOLO UN FLAG. `protocol_approved` es lo que el paciente RECIBIO. Si
-- al reabrir dejaramos que la siguiente aprobacion lo sobrescribiera, el documento que la persona tiene
-- en la mano desapareceria del sistema, que es literalmente el dano que el nombra. Asi que al reabrir la
-- aprobacion vigente se MUEVE a `treatment_approvals` (append-only) y la fila queda limpia en draft.
--
-- Y NO SE USA EL AUDIT LOG PARA ESTO, aunque registre el acto igual: `clinical_audit_log` es admin-only
-- para SELECT, asi que el profesional no podria ver la prescripcion anterior de su propio paciente. La
-- propiedad de LECTURA es la que decide donde vive un dato, no solo la de escritura. El audit log se
-- escribe ADEMAS, inline en la transaccion (regla dura 8).

CREATE TABLE IF NOT EXISTS "treatment_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "treatment_id" uuid NOT NULL REFERENCES "treatments"("id") ON DELETE cascade,
  -- La prescripcion tal como se aprobo. Misma forma que treatments.protocol_approved.
  "protocol_approved" jsonb NOT NULL,
  -- Quien la aprobo y cuando. RESTRICT (regla 14): una cuenta clinica no se recicla ni se borra.
  "approved_by" uuid REFERENCES "profiles"("id") ON DELETE restrict,
  "approved_at" timestamp with time zone NOT NULL,
  -- La prescripcion efectiva sellada con ella, para poder mostrarla sin recomputar.
  "kcal_objetivo" integer,
  "proteina_g" integer,
  -- El acto que la reemplazo: quien reabrio, cuando y por que. El motivo es OBLIGATORIO: una reapertura
  -- sin razon escrita no es una consecuencia registrada, es un borrado con pasos extra.
  "reopened_by" uuid REFERENCES "profiles"("id") ON DELETE restrict,
  "reopened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reopen_reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "treatment_approvals_treatment_idx" ON "treatment_approvals" ("treatment_id");
--> statement-breakpoint

-- Sellos de la ULTIMA reapertura en la propia fila. Duplican lo que ya guarda la historia a proposito:
-- el trigger no puede mirar otra tabla en el mismo UPDATE, asi que estas tres columnas son las que le
-- permiten EXIGIR el rastro a nivel de base de datos, no solo confiar en el servicio.
ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "reopened_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "reopened_by" uuid REFERENCES "profiles"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN IF NOT EXISTS "reopen_reason" text;
--> statement-breakpoint

-- RLS: mismo gate que el resto de las hijas de treatments (is_patient_professional via la evaluacion).
-- Sin INSERT para authenticated: la historia la escribe el servicio con service role dentro de la
-- transaccion de reapertura. Es append-only por construccion (no hay UPDATE ni DELETE).
ALTER TABLE "treatment_approvals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "treatment_approvals_select" ON "treatment_approvals"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR EXISTS (
      SELECT 1 FROM public.treatments t
      JOIN public.diagnoses d ON d.id = t.diagnosis_id
      JOIN public.evaluations e ON e.id = d.evaluation_id
      WHERE t.id = treatment_approvals.treatment_id AND public.is_patient_professional(e.patient_id)
    )
  );
--> statement-breakpoint

CREATE OR REPLACE FUNCTION treatments_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION 'Un protocolo aprobado es inmutable: no se puede borrar (se corrige por version nueva).';
    END IF;
    RETURN OLD;
  END IF;

  -- protocol_suggested: write-once.
  IF OLD.protocol_suggested IS NOT NULL
     AND NEW.protocol_suggested IS DISTINCT FROM OLD.protocol_suggested THEN
    RAISE EXCEPTION 'protocol_suggested es inmutable una vez sellado (salida del motor).';
  END IF;

  -- REAPERTURA (Gildardo 2026-08-30 §6c): approved -> draft es la UNICA salida permitida de 'approved',
  -- y solo si el UPDATE trae los tres sellos. Sin ellos la transicion se rechaza aqui, no en el servicio:
  -- el rastro es la condicion de la reapertura, no un efecto secundario que se pueda omitir.
  IF OLD.status = 'approved' AND NEW.status = 'draft' THEN
    IF NEW.reopened_at IS NULL OR NEW.reopened_by IS NULL
       OR NEW.reopen_reason IS NULL OR btrim(NEW.reopen_reason) = '' THEN
      RAISE EXCEPTION 'Reabrir una prescripcion aprobada exige registrar quien, cuando y por que.';
    END IF;
    -- La aprobacion vigente se limpia de la fila: ya vive en treatment_approvals.
    IF NEW.protocol_approved IS NOT NULL OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Al reabrir, la aprobacion se mueve a treatment_approvals y la fila queda en draft limpia.';
    END IF;
    RETURN NEW;
  END IF;

  -- Al estar approved, la prescripcion se congela (todo lo demas, sin cambio).
  IF OLD.status = 'approved' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.protocol_approved IS DISTINCT FROM OLD.protocol_approved
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.kcal_objetivo IS DISTINCT FROM OLD.kcal_objetivo
       OR NEW.proteina_g IS DISTINCT FROM OLD.proteina_g
       OR NEW.adj_geb IS DISTINCT FROM OLD.adj_geb
       OR NEW.adj_pal IS DISTINCT FROM OLD.adj_pal
       OR NEW.adj_kcal_obj IS DISTINCT FROM OLD.adj_kcal_obj
       OR NEW.adj_prot_gkg IS DISTINCT FROM OLD.adj_prot_gkg
       OR NEW.adj_fat_pct IS DISTINCT FROM OLD.adj_fat_pct
       OR NEW.adj_peso_meta IS DISTINCT FROM OLD.adj_peso_meta
       OR NEW.micronutrientes_texto IS DISTINCT FROM OLD.micronutrientes_texto THEN
      RAISE EXCEPTION 'La prescripcion de un protocolo aprobado es inmutable: se corrige por version nueva.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS treatments_immutability_trg ON treatments;
--> statement-breakpoint
CREATE TRIGGER treatments_immutability_trg
  BEFORE UPDATE OR DELETE ON treatments
  FOR EACH ROW EXECUTE FUNCTION treatments_immutability();
