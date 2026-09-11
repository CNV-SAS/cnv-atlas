-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL TERCER ESCRITOR DE MOVIMIENTOS, QUE VIVIA EN SQL  ·  Bloque 1  ·  2026-09-11
--
-- VA EN SU PROPIA MIGRACION Y NO DENTRO DE LA 0121 por la regla dura: una migracion aplicada no se
-- modifica, se crea otra. La 0121 ya estaba aplicada en local cuando aparecio esto.
--
-- COMO APARECIO, que es la parte que vale la pena: al re-llavear el saldo actualice los dos triggers que
-- conocia y los servicios que escriben movimientos desde la aplicacion. Faltaba un tercero,
-- `nutra_faltante_settle`, que vive EN LA BASE desde la migracion 0048 y no aparece buscando por el
-- codigo. Lo encontro un test contra BD real, que es el unico que podia encontrarlo: tsc no ve un insert
-- de plpgsql.
--
-- LA LECCION, para la proxima vez que se cambie la forma de una tabla: los escritores no son solo los del
-- repositorio. Hay que buscarlos tambien en `drizzle/*.sql`.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 3bis. EL TERCER ESCRITOR, QUE ESTABA EN SQL Y NO EN EL CODIGO ────────────────────────────────
--
-- `nutra_faltante_settle` inserta un movimiento de conciliacion al CERRAR un caso de faltante, y vive en
-- la base desde la migracion 0048. Es el escritor que no aparece buscando por el codigo de la aplicacion,
-- y por eso se me paso: lo encontro un test contra BD real, que es el unico que podia encontrarlo.
--
-- SE REESCRIBE PARA RESOLVER UBICACION Y LOTE. La ubicacion sale del profesional del caso; el lote, del
-- codigo que el caso ya guardaba en texto, y si no lo encuentra toma el que VENCE ANTES de ese producto en
-- esa ubicacion, que es el mismo criterio (FEFO) con el que se entrega.
--
-- Y SI NO HAY NINGUNO, FALLA EN VOZ ALTA en vez de cerrar el caso sin ajustar el inventario. Un faltante
-- que se cierra sin bajar el saldo es justo lo que este trigger existe para impedir.
CREATE OR REPLACE FUNCTION public.nutra_faltante_settle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
declare v_prof uuid; v_nutra uuid; v_qty integer; v_lote text; v_loc uuid; v_lot uuid;
begin
  if NEW.to_status not in ('justificado', 'venta_no_registrada', 'injustificado') then
    return null;
  end if;
  select professional_id, nutraceutical_id, quantity, lote
    into v_prof, v_nutra, v_qty, v_lote
    from public.nutraceutical_faltante_cases where id = NEW.case_id;

  select id into v_loc from public.inventory_locations where professional_id = v_prof;
  if v_loc is null then
    raise exception 'El Integrante del faltante no tiene ubicación de inventario.';
  end if;

  -- El lote que el caso declaro, si existe.
  if coalesce(trim(v_lote), '') <> '' then
    select id into v_lot from public.lots
     where nutraceutical_id = v_nutra and code = trim(v_lote);
  end if;
  -- Si no, el que vence antes entre los que tienen saldo en esa ubicacion (FEFO, el mismo de la entrega).
  if v_lot is null then
    select i.lot_id into v_lot
      from public.nutraceutical_inventory i
      join public.lots l on l.id = i.lot_id
     where i.location_id = v_loc and i.nutraceutical_id = v_nutra and i.stock_quantity > 0
     order by l.expires_on asc
     limit 1;
  end if;
  -- Y SI NINGUNO TIENE SALDO, vale igual cualquier lote de ese producto en esa ubicacion.
  --
  -- ESTA RAMA NO ES UN CINTURON, ES EL CASO NORMAL, y exigir saldo positivo fue un error mio que un test
  -- destapo: UN FALTANTE ES PRECISAMENTE QUE EL PRODUCTO NO ESTA. El que se lleva la ultima unidad deja el
  -- saldo en cero, y con la condicion anterior ese caso no se podia cerrar nunca. El trigger existe para
  -- que ningun cierre se olvide de ajustar el inventario; negarse a cerrar es lo contrario de su trabajo.
  if v_lot is null then
    select i.lot_id into v_lot
      from public.nutraceutical_inventory i
      join public.lots l on l.id = i.lot_id
     where i.location_id = v_loc and i.nutraceutical_id = v_nutra
     order by l.expires_on asc
     limit 1;
  end if;
  -- Solo si ese producto NUNCA estuvo en esa ubicacion. Entonces el faltante no puede ser de ahi, y eso
  -- si merece parar: seria conciliar contra un lote inventado.
  if v_lot is null then
    raise exception 'Ese producto no tiene ningún lote en la ubicación del Integrante: el faltante no puede ser de ahí.';
  end if;

  insert into public.nutraceutical_stock_movements
    (professional_id, location_id, lot_id, nutraceutical_id, delta, type, reason, lote)
    values (v_prof, v_loc, v_lot, v_nutra, -v_qty, 'conciliacion',
            'Conciliacion por faltante (' || NEW.to_status || ')', v_lote);
  return null;
end;
$$;--> statement-breakpoint
