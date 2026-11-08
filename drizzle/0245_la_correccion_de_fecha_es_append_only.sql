-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA CORRECCION DE FECHA DE NACIMIENTO ES APPEND-ONLY DE VERDAD  ·  2026-11-08
--
-- ═══ POR QUE VA APARTE, Y NO EN LA 0244 ═══
--
-- Porque la 0244 ya esta aplicada, y aqui las migraciones son forward-only: una migracion aplicada no se
-- reescribe, se sucede.
--
-- ═══ QUE ARREGLA ═══
--
-- La 0244 DICE en su comentario y en el de la tabla que es append-only, y su politica es
-- `FOR ALL TO authenticated USING (has_role('admin'))`: o sea que un admin PODIA actualizar o borrar una
-- correccion. Un comentario que afirma lo que el codigo no hace es peor que no tenerlo, porque se lee
-- como verificado. Y lo que se podria borrar aqui es precisamente la prueba de que un diagnostico se
-- emitio con otra edad.
--
-- Es el mismo trigger que ya protege `clinical_corrections`, `nutraceutical_stock_movements` y las
-- transiciones de faltante, con el mismo texto de excepcion: el mecanismo de la casa, no uno nuevo.
--
-- Y UNA CORRECCION EQUIVOCADA SE DESHACE COMO TODO LO DEMAS AQUI: corrigiendo otra vez. La cadena queda
-- entera y se ve que hubo dos actos, que es exactamente lo que tiene que ver quien audite.
--
-- ═══ LA EXCEPCION DEL CASCADE, QUE NO ES UN AGUJERO SINO EL UNICO BORRADO REAL QUE EXISTE ═══
--
-- `patient_id` lleva `ON DELETE CASCADE`, y en Atlas hay UN camino que borra de verdad una fila de
-- `patients`: deshacer un lote de importacion HTML borra los pacientes que ESE lote creo, y solo si no
-- les quedo ninguna evaluacion (`importar-lote-writer`). Un trigger que rechazara ese cascade dejaria el
-- deshacer del lote roto con un mensaje que no habla de importaciones, y el caso no es raro: los
-- pacientes con la fecha mal puesta vienen justo de esos lotes.
--
-- SE DISTINGUE MIRANDO SI EL PACIENTE TODAVIA EXISTE. En un cascade, la fila de `patients` ya se borro
-- cuando el trigger de la hija corre, asi que "el paciente ya no esta" significa "esto viene del borrado
-- del paciente" y se deja pasar; con el paciente en pie, el borrado es a mano y se rechaza. La garantia
-- que importa queda intacta: nadie puede quitar una correccion de un paciente que existe.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION correcciones_fecha_nacimiento_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM patients WHERE id = OLD.patient_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'correcciones_de_fecha_de_nacimiento es append-only: no se actualiza ni se borra. Para deshacer una correccion, se corrige otra vez.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS correcciones_fecha_nacimiento_append_only_trg
  ON correcciones_de_fecha_de_nacimiento;--> statement-breakpoint

CREATE TRIGGER correcciones_fecha_nacimiento_append_only_trg
  BEFORE UPDATE OR DELETE ON correcciones_de_fecha_de_nacimiento
  FOR EACH ROW EXECUTE FUNCTION correcciones_fecha_nacimiento_append_only();
