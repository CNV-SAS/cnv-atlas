-- D-009: remisiones. Inmutabilidad + RLS + CHECK. Migracion escrita a mano (Drizzle solo genera DDL de
-- tablas; triggers, RLS y checks van aparte, forward-only).

-- CHECK: "otro" exige el texto libre (endocrino, psiquiatria, etc.); las cuatro profesiones estructuradas no.
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_other_requires_text"
  CHECK ("referred_to" <> 'otro' OR "referred_to_other" IS NOT NULL);
--> statement-breakpoint

-- Inmutabilidad: la remision es un acto clinico registrado. No se borra; los campos nucleo no se editan.
-- El UNICO cambio permitido es setear returned_at/return_notes UNA vez (null -> valor): "el paciente volvio"
-- es un SEGUNDO acto, no una edicion del primero. Corregir una remision mal puesta seria otra transicion (post-MVP).
CREATE OR REPLACE FUNCTION public.referrals_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'referrals: no se borra una remision (acto clinico registrado)';
  END IF;
  -- UPDATE: los campos nucleo son inmutables.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.treatment_id IS DISTINCT FROM OLD.treatment_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.referred_to IS DISTINCT FROM OLD.referred_to
     OR NEW.referred_to_other IS DISTINCT FROM OLD.referred_to_other
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.referred_at IS DISTINCT FROM OLD.referred_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'referrals: los campos de la remision son inmutables (corregir seria otra transicion)';
  END IF;
  -- returned_at / return_notes: write-once (null -> valor). Una vez puesto, no se cambia.
  IF OLD.returned_at IS NOT NULL AND NEW.returned_at IS DISTINCT FROM OLD.returned_at THEN
    RAISE EXCEPTION 'referrals: el retorno del paciente ya se registro (no se edita)';
  END IF;
  IF OLD.return_notes IS NOT NULL AND NEW.return_notes IS DISTINCT FROM OLD.return_notes THEN
    RAISE EXCEPTION 'referrals: la nota de retorno ya se registro (no se edita)';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "referrals_immutable_trg"
  BEFORE UPDATE OR DELETE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.referrals_immutable();
--> statement-breakpoint

-- RLS: el profesional asignado al paciente ve y escribe sus remisiones (ownership por patient_id, que la
-- tabla lleva denormalizado justo para esto y para sobrevivir a las correcciones). admin lee. Sin policy
-- de DELETE (RLS lo niega, ademas del trigger). direccion y el eventual cierre del admin-amplio van por el
-- mecanismo de grants (PLAN_GRANTS), igual que el resto del contenido clinico.
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "referrals_select" ON public.referrals
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.is_patient_professional(referrals.patient_id)
  );
--> statement-breakpoint
CREATE POLICY "referrals_insert" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (
    public.is_patient_professional(referrals.patient_id)
  );
--> statement-breakpoint
CREATE POLICY "referrals_update" ON public.referrals
  FOR UPDATE TO authenticated
  USING (public.is_patient_professional(referrals.patient_id))
  WITH CHECK (public.is_patient_professional(referrals.patient_id));
