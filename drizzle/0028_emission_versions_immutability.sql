-- emission_versions: versiones de emision emergentes (Q20 clasificacion, C2b calibracion) selladas
-- en cada diagnostico. Es parte del registro clinico sellado -> write-once, como protocol_suggested.
--
-- El trigger 0027 (diagnoses_confirmation_immutability) ya corre BEFORE UPDATE OR DELETE sobre
-- diagnoses; se EXTIENDE su funcion (CREATE OR REPLACE) para bloquear tambien cambiar
-- emission_versions una vez sellado. El INSERT del pipeline (que lo sella) no dispara el trigger.
-- Permite null -> valor (los diagnosticos previos a esta columna quedan NULL; solo demo).
--
-- La columna la agrega el ALTER de abajo. Nota de aplicacion: al aplicar, sincronizar el snapshot de
-- drizzle (regenerar) para que schema.ts y el snapshot no queden desfasados (ver ARCHITECTURE:
-- "nothing to migrate" no verifica la base).
ALTER TABLE "diagnoses" ADD COLUMN "emission_versions" jsonb;--> statement-breakpoint
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

  -- UPDATE: las versiones de emision, una vez selladas, son inmutables (registro clinico).
  IF OLD.emission_versions IS NOT NULL
     AND NEW.emission_versions IS DISTINCT FROM OLD.emission_versions THEN
    RAISE EXCEPTION 'Las versiones de emision de un diagnostico son inmutables: no se cambian.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS diagnoses_confirmation_immutability_trg ON diagnoses;--> statement-breakpoint
CREATE TRIGGER diagnoses_confirmation_immutability_trg
  BEFORE UPDATE OR DELETE ON diagnoses
  FOR EACH ROW EXECUTE FUNCTION diagnoses_confirmation_immutability();
