-- LA PRESCRIPCION QUEDA ABIERTA: se retiran las ramas del candado (Santiago, 2026-09-09).
--
-- VA DESPUES DE LA 0115 Y NO SE PUEDE ADELANTAR: la 0115 copia a `prescription_emissions` todo lo que ya
-- estaba aprobado. Esta migracion suelta esas filas; si corriera antes, la copia se haria sobre filas ya
-- soltadas y se perderia la constancia de lo que el paciente recibio. El orden es la garantia.
--
-- QUE SE RETIRA, Y POR QUE CADA COSA:
--
--   1. LA RAMA DE CONGELADO (`OLD.status = 'approved'` -> la prescripcion es inmutable). Era lo que hacia
--      falta un boton de aprobar, lo que bloqueaba la edicion y lo que obligaba a reabrir con motivo para
--      corregir una coma. Santiago lo reporto como confuso y el hallazgo le dio la razon: el plan impreso,
--      el del correo y la historia clinica se arman los tres del protocolo VIVO, asi que ese congelado
--      protegia por EFECTO LATERAL, no por diseño. Lo que de verdad conserva lo entregado es la copia de
--      la emision, y esa no depende de que nadie deje de editar.
--
--   2. LA RAMA DE REAPERTURA (approved -> draft con sus tres sellos). Existia SOLO para deshacer el
--      congelado. Sin congelado no hay nada que reabrir.
--
-- QUE **NO** SE RETIRA, y es la mitad que importa conservar:
--
--   · `protocol_suggested` SIGUE SIENDO WRITE-ONCE. Es la salida del MOTOR, no una decision del
--     profesional, y su inmutabilidad es la regla dura 7 (constelacion de versiones), no una consecuencia
--     de aprobar. Ademas es lo que hace reproducible una emision: la copia guarda los AJUSTES, y
--     recomputar con ellos solo da lo mismo si el sugerido no se movio.
--
--   · LA PROHIBICION DE BORRAR un protocolo que ya salio hacia un paciente. Cambia el criterio, no la
--     regla: antes era "no se borra lo aprobado" y ahora es "no se borra lo que tiene emisiones". Es el
--     mismo hecho clinico dicho con el estado que si existe.
--
-- Y LAS DOS FILAS APROBADAS DE PRODUCCION vuelven a 'draft', que es lo que las deja editables otra vez.
-- Su contenido no se pierde: vive en `prescription_emissions` desde la 0115, y `treatment_approvals`
-- sigue intacta.

do $$
declare
  n_aprobados int;
  n_emisiones int;
  n_sin_emision int;
begin
  select count(*) into n_aprobados from treatments where status = 'approved';
  select count(*) into n_emisiones from prescription_emissions;
  -- EL CONTROL QUE IMPORTA: un tratamiento aprobado sin emision copiada seria una prescripcion entregada
  -- que se queda sin constancia al soltarla. Si sale distinto de cero, la 0115 no corrio o no cubrio todo.
  select count(*) into n_sin_emision
    from treatments t
    where t.status = 'approved'
      and not exists (select 1 from prescription_emissions pe where pe.treatment_id = t.id);
  raise notice 'ANTES: % tratamientos aprobados, % emisiones registradas, % aprobados SIN emision',
    n_aprobados, n_emisiones, n_sin_emision;
  if n_sin_emision > 0 then
    raise exception 'Hay % tratamientos aprobados sin emision copiada. Corre primero la 0115: soltarlos ahora perderia la constancia de lo que recibio el paciente.', n_sin_emision;
  end if;
end $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION treatments_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- MISMA REGLA, OTRO CRITERIO (2026-09-09). Era `OLD.status = 'approved'`; ahora es tener emisiones.
    -- Lo que no se puede borrar es un plan que YA SALIO hacia una persona, y ese hecho ya no lo marca el
    -- estado (que no existe) sino el registro de emisiones.
    IF EXISTS (SELECT 1 FROM prescription_emissions pe WHERE pe.treatment_id = OLD.id) THEN
      RAISE EXCEPTION 'Este plan ya se entrego al paciente: no se puede borrar (se corrige emitiendo una version nueva).';
    END IF;
    RETURN OLD;
  END IF;

  -- protocol_suggested: write-once. LA UNICA RAMA QUE SOBREVIVE, y no por inercia: es la salida del MOTOR
  -- (regla dura 7), no una decision del profesional, y es lo que hace reproducible una emision.
  IF OLD.protocol_suggested IS NOT NULL
     AND NEW.protocol_suggested IS DISTINCT FROM OLD.protocol_suggested THEN
    RAISE EXCEPTION 'protocol_suggested es inmutable una vez sellado (salida del motor).';
  END IF;

  -- SE RETIRARON LAS RAMAS DE APROBACION Y REAPERTURA. La prescripcion queda SIEMPRE editable; lo que el
  -- paciente recibio vive copiado en prescription_emissions, que si es append-only por trigger propio.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS treatments_immutability_trg ON treatments;--> statement-breakpoint

CREATE TRIGGER treatments_immutability_trg
  BEFORE UPDATE OR DELETE ON treatments
  FOR EACH ROW EXECUTE FUNCTION treatments_immutability();--> statement-breakpoint

-- LAS FILAS APROBADAS VUELVEN A BORRADOR. Va DESPUES de reemplazar la funcion: con la version anterior,
-- este UPDATE seria rechazado por la rama de reapertura (exige los tres sellos y limpiar la aprobacion).
--
-- `protocol_approved`, `approved_by` y `approved_at` SE CONSERVAN en la fila a proposito. Son el registro
-- del acto tal como ocurrio bajo el modelo anterior, y borrarlos seria reescribir la historia para que
-- encaje con el modelo nuevo. No se leen desde ningun sitio (el codigo ya no los consulta), pero estan.
--
-- IDEMPOTENTE: la segunda pasada no encuentra filas en 'approved'.
UPDATE treatments SET status = 'draft' WHERE status = 'approved';--> statement-breakpoint

do $$
declare
  n_aprobados int;
  n_borrador int;
  n_emisiones int;
begin
  select count(*) into n_aprobados from treatments where status = 'approved';
  select count(*) into n_borrador from treatments where status = 'draft';
  select count(*) into n_emisiones from prescription_emissions;
  raise notice 'DESPUES: % aprobados (debe ser 0), % en borrador, % emisiones conservadas',
    n_aprobados, n_borrador, n_emisiones;
end $$;
