-- T2 A2: inmutabilidad del protocolo de tratamiento (regla 7). Dos sellos, dos momentos
-- clinicos: protocol_suggested es write-once (salida del motor, sellada al crear el
-- protocolo, congelada incluso en draft); protocol_approved y la prescripcion efectiva se
-- congelan al pasar a status='approved'. Mismo patron que el trigger de inmutabilidad de
-- reports. Migracion hand-written (drizzle-kit no genera triggers); reproducible
-- (CREATE OR REPLACE + DROP IF EXISTS).
--
-- VIA DE ESCAPE (misma acotacion que el trigger de reports, ver ARCHITECTURE.md seccion
-- Datos): SET LOCAL session_replication_role = replica dentro de una transaccion desactiva
-- ESTE trigger tambien, y aplica a protocol_suggested y protocol_approved. Limite innegociable:
-- SOLO en demo/pre-produccion, sin registros clinicos reales; en produccion un protocolo
-- aprobado no se modifica ni se borra por esa via, se corrige por version nueva.
--
-- EDITABLE despues de aprobar (por diseno): proxima_cita (logistica, no prescripcion),
-- restricciones (text[] del profesional, la lee generate-menu.ts, que corre despues de
-- aprobar), restrictions_ack_at/by (el profesional puede reconocer las restricciones al ir a
-- generar el menu, despues de aprobar; congelarlas bloquearia ese gate) y las tablas hijas.
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

  -- Al estar approved, la prescripcion se congela.
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
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS treatments_immutability_trg ON treatments;--> statement-breakpoint
CREATE TRIGGER treatments_immutability_trg
  BEFORE UPDATE OR DELETE ON treatments
  FOR EACH ROW EXECUTE FUNCTION treatments_immutability();
