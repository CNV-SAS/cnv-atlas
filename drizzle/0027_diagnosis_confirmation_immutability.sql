-- Mini-bloque "confirmacion del diagnostico como acto propio": la confirmacion (confirmed_by +
-- confirmed_at) es la FIRMA CLINICA del diagnostico. Una vez sellada, no se cambia ni se borra.
-- Mismo patron que los triggers de reports y treatments. Migracion hand-written (drizzle-kit no
-- genera triggers); reproducible (CREATE OR REPLACE + DROP IF EXISTS).
--
-- SEMANTICA: BEFORE UPDATE OR DELETE. Permite null -> valor (confirmar UNA vez, tambien via
-- approveReport que confirma WHERE confirmed_by IS NULL); bloquea cambiar/limpiar confirmed_by o
-- confirmed_at ya sellados (UPDATE) y borrar un diagnostico confirmado (DELETE). El INSERT del
-- pipeline (confirmed_by null) no dispara este trigger. No congela el resto de la fila: no hay otro
-- path que la mute.
--
-- VIA DE ESCAPE (misma acotacion que reports/treatments): SET LOCAL session_replication_role =
-- replica desactiva este trigger. SOLO en demo/pre-produccion, sin registros clinicos reales.
CREATE OR REPLACE FUNCTION diagnoses_confirmation_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.confirmed_by IS NOT NULL THEN
      RAISE EXCEPTION 'Un diagnostico confirmado es inmutable (firma clinica): no se puede borrar.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: la confirmacion, una vez sellada, no se cambia ni se limpia.
  IF OLD.confirmed_by IS NOT NULL
     AND (NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
          OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at) THEN
    RAISE EXCEPTION 'La confirmacion de un diagnostico es inmutable (firma clinica): no se cambia.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS diagnoses_confirmation_immutability_trg ON diagnoses;--> statement-breakpoint
CREATE TRIGGER diagnoses_confirmation_immutability_trg
  BEFORE UPDATE OR DELETE ON diagnoses
  FOR EACH ROW EXECUTE FUNCTION diagnoses_confirmation_immutability();
