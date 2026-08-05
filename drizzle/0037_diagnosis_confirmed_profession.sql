-- La profesion con que se confirmo el diagnostico, sellada EN el acto (como approvedProfession del
-- protocolo). Se setea al confirmar (confirmed_by IS NULL -> valor) y se CONGELA con la confirmacion.
ALTER TABLE "diagnoses" ADD COLUMN "confirmed_profession" "professional_profession";--> statement-breakpoint

-- Extiende el trigger de inmutabilidad de la confirmacion (0027) para congelar tambien
-- confirmed_profession: es parte de la FIRMA clinica. CREATE OR REPLACE reemplaza solo el cuerpo.
CREATE OR REPLACE FUNCTION diagnoses_confirmation_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.confirmed_by IS NOT NULL THEN
      RAISE EXCEPTION 'Un diagnostico confirmado es inmutable (firma clinica): no se puede borrar.';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: la confirmacion (quien + cuando + con que profesion), una vez sellada, no se cambia.
  IF OLD.confirmed_by IS NOT NULL
     AND (NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by
          OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
          OR NEW.confirmed_profession IS DISTINCT FROM OLD.confirmed_profession) THEN
    RAISE EXCEPTION 'La confirmacion de un diagnostico es inmutable (firma clinica): no se cambia.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;