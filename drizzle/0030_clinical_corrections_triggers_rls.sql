-- Flujo de correccion post-diagnostico (gate del Hito 1, ver docs/PLAN_FLUJO_CORRECCION.md).
-- 0029 creo la tabla clinical_corrections, el enum y evaluations.superseded_at (DDL puro,
-- generado). Esta migracion (hand-written, drizzle-kit no genera triggers ni RLS) pone las
-- garantias: RLS en la tabla nueva + los triggers de coherencia que hacen imposible que la
-- vigencia (superseded_at) se separe de la relacion (clinical_corrections). Reproducible
-- (CREATE OR REPLACE + DROP IF EXISTS).
--
-- Modelo de coherencia (por que estos triggers y no un puntero por entidad): la relacion
-- old->new vive UNA sola vez, en clinical_corrections. evaluations.superseded_at es una
-- proyeccion barata para filtrar la vigente. Para que no diverjan:
--   1. superseded_at lo pone SOLO el insert de una correccion (trigger apply). El servicio nunca
--      lo escribe a mano.
--   2. superseded_at es write-once y no puede ponerse sin una correccion que lo respalde
--      (trigger coherence en evaluations).
--   3. Solo se corrige la evaluacion VIGENTE; corregir una ya reemplazada bifurcaria la cadena
--      (trigger guard).
--   4. clinical_corrections es append-only: borrar una correccion dejaria superseded_at colgando
--      (trigger append_only).
-- Divergencia por el camino normal: imposible. Bypass: SET LOCAL session_replication_role =
-- replica (misma acotacion que 0026/0027/0028): SOLO demo/pre-produccion, sin registros reales.

-- === RLS: la tabla nueva la cubre el `alter default privileges` de 0005 (grant a authenticated),
-- asi que SIN enable RLS quedaria legible/escribible por authenticated. Se habilita y se acota. ===
ALTER TABLE "clinical_corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- SELECT: admin (supervision) o el profesional asignado a la evaluacion corregida (regla 3, via
-- is_patient_professional, mismo patron que diagnoses_select).
CREATE POLICY "clinical_corrections_select" ON "clinical_corrections"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = clinical_corrections.old_evaluation_id AND public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- INSERT: SOLO el profesional asignado (acto clinico, admin NO, igual que approveProtocol,
-- PLAN (c)). No hay policy de UPDATE ni DELETE: RLS las niega por defecto y el trigger append_only
-- las bloquea aunque se llegue por otra via (defensa en profundidad).
CREATE POLICY "clinical_corrections_insert" ON "clinical_corrections"
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = clinical_corrections.old_evaluation_id AND public.is_patient_professional(e.patient_id)
    )
  );--> statement-breakpoint

-- === Trigger 1 (guard, BEFORE INSERT): solo se corrige la vigente, y old != new. ===
CREATE OR REPLACE FUNCTION clinical_corrections_guard() RETURNS trigger AS $$
DECLARE
  v_old_superseded timestamptz;
BEGIN
  IF NEW.old_evaluation_id = NEW.new_evaluation_id THEN
    RAISE EXCEPTION 'Una correccion no puede apuntar la misma evaluacion como vieja y nueva.';
  END IF;
  SELECT superseded_at INTO v_old_superseded FROM public.evaluations WHERE id = NEW.old_evaluation_id;
  IF v_old_superseded IS NOT NULL THEN
    RAISE EXCEPTION 'Solo se corrige la evaluacion vigente: esta ya fue reemplazada (la cadena no se bifurca).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS clinical_corrections_guard_trg ON clinical_corrections;--> statement-breakpoint
CREATE TRIGGER clinical_corrections_guard_trg
  BEFORE INSERT ON clinical_corrections
  FOR EACH ROW EXECUTE FUNCTION clinical_corrections_guard();--> statement-breakpoint

-- === Trigger 2 (apply, AFTER INSERT): marca la evaluacion vieja como reemplazada. Es el UNICO
-- escritor de superseded_at; el servicio nunca lo toca. Corre AFTER INSERT, asi que la fila de
-- correccion ya existe cuando el trigger coherence (abajo) la busca. ===
CREATE OR REPLACE FUNCTION clinical_corrections_apply() RETURNS trigger AS $$
BEGIN
  UPDATE public.evaluations SET superseded_at = NEW.created_at WHERE id = NEW.old_evaluation_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS clinical_corrections_apply_trg ON clinical_corrections;--> statement-breakpoint
CREATE TRIGGER clinical_corrections_apply_trg
  AFTER INSERT ON clinical_corrections
  FOR EACH ROW EXECUTE FUNCTION clinical_corrections_apply();--> statement-breakpoint

-- === Trigger 3 (append_only, BEFORE UPDATE OR DELETE): la correccion es registro clinico. ===
CREATE OR REPLACE FUNCTION clinical_corrections_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'clinical_corrections es append-only (registro clinico): no se actualiza ni se borra.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS clinical_corrections_append_only_trg ON clinical_corrections;--> statement-breakpoint
CREATE TRIGGER clinical_corrections_append_only_trg
  BEFORE UPDATE OR DELETE ON clinical_corrections
  FOR EACH ROW EXECUTE FUNCTION clinical_corrections_append_only();--> statement-breakpoint

-- === Trigger 4 (coherence, BEFORE UPDATE en evaluations): superseded_at write-once y respaldado.
-- Solo actua cuando superseded_at cambia; los updates normales (status, updated_at) no lo tocan.
-- El set_updated_at existente sigue corriendo aparte (columna distinta, sin conflicto). ===
CREATE OR REPLACE FUNCTION evaluations_superseded_coherence() RETURNS trigger AS $$
BEGIN
  IF NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN
    -- write-once: una evaluacion reemplazada no se des-reemplaza ni se re-apunta.
    IF OLD.superseded_at IS NOT NULL THEN
      RAISE EXCEPTION 'evaluations.superseded_at es write-once: una evaluacion reemplazada no se des-reemplaza.';
    END IF;
    -- null -> valor: solo si existe una correccion que nombre esta evaluacion como old. Impide
    -- marcar una evaluacion como reemplazada sin respaldo (dejaria un paciente sin vigente).
    IF NEW.superseded_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.clinical_corrections c WHERE c.old_evaluation_id = NEW.id) THEN
      RAISE EXCEPTION 'evaluations.superseded_at solo lo pone el flujo de correccion (falta la clinical_corrections que lo respalde).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS evaluations_superseded_coherence_trg ON evaluations;--> statement-breakpoint
CREATE TRIGGER evaluations_superseded_coherence_trg
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION evaluations_superseded_coherence();
