-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LIMPIAR LAS VENTAS DEL PRODUCTO DE PRUEBA DEL SMOKE  ·  Bloque 3  ·  REUTILIZABLE
--
-- PARA QUE: dejar el producto de prueba como recien creado (5 unidades: SMOKE-A 2, SMOKE-B 3, nada reservado)
-- para empezar o repetir el smoke. Pasa en la practica: alguien crea un checkout de mas, o quiere repetir un
-- paso. Se puede correr cuantas veces haga falta; si no hay ventas, no hace nada.
--
-- QUE HACE, sobre las ventas que tienen el producto de prueba y SOLO sobre esas:
--   1. LIBERA sus reservas vivas (y dice cuantas). Primero se liberan y despues se borra la venta: una reserva
--      que sobreviviera a su venta seguiria restando de lo disponible, y el smoke no se podria repetir.
--   2. Borra sus movimientos de VENTA (los de pagos que ya se descontaron) y RECALCULA el saldo de esos lotes
--      desde los movimientos que quedan. Las recepciones del producto no se tocan.
--   3. Borra sus eventos de Wompi y las ventas (con sus lineas, reservas, comision e ingreso, por cascada).
--
-- ABORTA, sin tocar nada, si alguna de esas ventas:
--   · tiene una linea de OTRO producto (una venta mixta no se borra por el producto de prueba),
--   · es de un paciente que NO esta marcado de prueba,
--   · o es de produccion (pago real o factura de produccion).
--
-- Las facturas que esas ventas tengan en el SANDBOX de Alegra quedan alla: son de otro sistema.
--
-- COMO SE CORRE: ver docs/entregas/SMOKE_BLOQUE_3_SESION_1.md, paso 3. NO se pega en el editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

create temp table limpiar_productos on commit drop as
  select id from nutraceuticals where name like 'PRUEBA SMOKE BLOQUE 3%' and is_test;

create temp table limpiar_ventas on commit drop as
  select distinct t.id, t.status, t.stock_state, t.wompi_env, t.alegra_env, t.patient_id
    from transactions t
    join transaction_items ti on ti.transaction_id = t.id
   where ti.nutraceutical_id in (select id from limpiar_productos);

do $$
declare r record;
begin
  if not exists (select 1 from limpiar_productos) then
    raise exception 'ABORTADO: no existe el producto de prueba del smoke. Correr primero smoke-bloque3-preparar.sql.';
  end if;

  if exists (select 1 from transaction_items ti join limpiar_ventas v on v.id = ti.transaction_id
              where ti.nutraceutical_id not in (select id from limpiar_productos)) then
    raise exception 'ABORTADO: una venta del producto de prueba tiene tambien otro producto. No se borra: se mira a mano.';
  end if;
  if exists (select 1 from limpiar_ventas v left join patients p on p.id = v.patient_id
              where p.id is null or not p.is_test) then
    raise exception 'ABORTADO: una venta del producto de prueba es de un paciente que NO esta marcado de prueba.';
  end if;
  if exists (select 1 from limpiar_ventas where wompi_env = 'produccion' or alegra_env = 'produccion') then
    raise exception 'ABORTADO: una venta del producto de prueba es de produccion. No se borra.';
  end if;

  raise notice 'Ventas del producto de prueba a borrar: %', (select count(*) from limpiar_ventas);
  for r in select status, coalesce(stock_state, '-') as stock_state, count(*) as n
             from limpiar_ventas group by 1, 2 order by 1, 2 loop
    raise notice '  % venta(s) % / inventario %', r.n, r.status, r.stock_state;
  end loop;
end $$;

-- ── 1. LIBERAR LAS RESERVAS ───────────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  update inventory_reservations r
     set released_at = now()
    from transaction_items ti
    join limpiar_ventas v on v.id = ti.transaction_id
   where r.transaction_item_id = ti.id
     and r.released_at is null and r.consumed_at is null;
  get diagnostics n = row_count;
  raise notice 'Reservas liberadas: %', n;
end $$;

-- ── 2. LOS MOVIMIENTOS DE VENTA, Y EL SALDO ───────────────────────────────────────────────────────
create temp table limpiar_movs on commit drop as
  select m.id, m.location_id, m.nutraceutical_id, m.lot_id, m.delta, m.type::text as tipo
    from nutraceutical_stock_movements m
    join transaction_items ti on ti.id = m.transaction_item_id
    join limpiar_ventas v on v.id = ti.transaction_id;

do $$
begin
  if exists (select 1 from limpiar_movs where tipo <> 'venta') then
    raise exception 'ABORTADO: una venta del producto de prueba tiene movimientos que no son de venta.';
  end if;
  raise notice 'Movimientos de venta a borrar: % (% unidades vuelven al saldo)',
    (select count(*) from limpiar_movs), (select coalesce(-sum(delta), 0) from limpiar_movs);
end $$;

-- Append-only por trigger: se desactiva DENTRO de esta transaccion (el DDL es transaccional).
alter table nutraceutical_stock_movements disable trigger nutra_movement_append_only_trg;
delete from nutraceutical_stock_movements m using limpiar_movs x where m.id = x.id;
alter table nutraceutical_stock_movements enable trigger nutra_movement_append_only_trg;

update nutraceutical_inventory i
   set stock_quantity = (
         select coalesce(sum(m.delta), 0) from nutraceutical_stock_movements m
          where m.location_id = i.location_id and m.nutraceutical_id = i.nutraceutical_id
            and m.lot_id = i.lot_id and m.type <> 'remesa'),
       last_updated = now()
 where (i.location_id, i.nutraceutical_id, i.lot_id) in
       (select distinct location_id, nutraceutical_id, lot_id from limpiar_movs);

-- ── 3. LAS VENTAS ─────────────────────────────────────────────────────────────────────────────────
delete from payment_webhook_events e
 using limpiar_ventas v
 where e.provider = 'wompi'
   and e.payload -> 'data' -> 'transaction' ->> 'reference' = v.id::text;

delete from transactions t using limpiar_ventas v where t.id = v.id;

-- ── LO QUE QUEDO ──────────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  if exists (select 1 from transaction_items where nutraceutical_id in (select id from limpiar_productos)) then
    raise exception 'ABORTADO: quedaron ventas del producto de prueba.';
  end if;
  if exists (select 1 from inventory_reservations
              where nutraceutical_id in (select id from limpiar_productos)
                and released_at is null and consumed_at is null) then
    raise exception 'ABORTADO: quedaron reservas vivas del producto de prueba.';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'nutra_movement_append_only_trg' and tgenabled <> 'O') then
    raise exception 'ABORTADO: el trigger de inmutabilidad de los movimientos quedo desactivado.';
  end if;
  for r in select n.name, l.code, i.stock_quantity
             from nutraceutical_inventory i
             join lots l on l.id = i.lot_id
             join nutraceuticals n on n.id = i.nutraceutical_id
            where n.id in (select id from limpiar_productos)
            order by n.name, l.code loop
    raise notice 'Saldo que queda: % lote % = % unidad(es)', r.name, r.code, r.stock_quantity;
  end loop;
end $$;

commit;
