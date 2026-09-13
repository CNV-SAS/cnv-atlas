-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- PURGA DE LAS VENTAS DE PRUEBA DEL SMOKE  ·  Bloque 2b  ·  decision de Santiago del 2026-09-13
--
-- QUE BORRA: las ventas con `wompi_env = 'test'` (las del smoke del 2a, pagadas con tarjetas de prueba), y
-- lo que cuelga de ellas: sus lineas, su comision, el ingreso de CNV y sus eventos de Wompi.
--
-- POR QUE: viven en la base de produccion DESPUES de la fecha de corte del Bloque 0, que dice que desde
-- ella todo registro es real. Y ya contaminan: el tablero de Direccion (cobrado, ingreso y comisiones), el
-- tablero del profesional (ventas y comision del mes) y el banner tributario del Integrante al que el smoke
-- le asigno comision.
--
-- CUANDO: DESPUES de la venta controlada del 2b (guia, paso D). Desde el cambio de llaves ya no nacen
-- ventas de prueba en produccion, asi que se corre una vez.
--
-- LO QUE NO TOCA:
--   · Ninguna venta con `wompi_env = 'produccion'`. El bloque de verificacion aborta si alguna cambiaria.
--   · Las facturas del SANDBOX de Alegra: son de otro sistema.
--   · Los pacientes de prueba (`is_test`): la decision fue sobre las ventas.
--   · El inventario REAL. Desde el Bloque 3 una venta de prueba SI puede haber movido inventario (reserva y
--     movimiento de venta). Esos movimientos se borran con ella y el saldo de sus lotes se RECALCULA desde
--     los movimientos que quedan: un pago de prueba nunca saco producto de la vitrina, asi que devolver ese
--     saldo es corregirlo, no alterarlo. Nada mas se toca.
--
-- NO DEJA RASTRO EN clinical_audit_log, igual que la purga del Bloque 0: aceptable en datos de prueba,
-- no en reales.
--
-- COMO SE CORRE (nunca en el editor SQL de Supabase, que no sostiene la transaccion):
--   node --env-file=.env.produccion.local scripts/aplicar-migracion.mjs scripts/purga-ventas-de-prueba.sql
--   ... revisar los NOTICE, y lo mismo con --commit al final.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

create temp table purga_ids on commit drop as
  select id, amount, status, created_at, alegra_invoice_state, alegra_env
    from transactions
   where wompi_env = 'test';

create temp table purga_antes on commit drop as
  select (select count(*) from transactions where wompi_env <> 'test')          as ventas_reales,
         (select coalesce(sum(amount), 0) from transactions where wompi_env <> 'test') as monto_real,
         (select count(*) from purga_ids)                                            as a_borrar;

do $$
declare r record;
begin
  -- UNA VENTA DE PRUEBA CON FACTURA DE PRODUCCION seria un documento fiscal real colgado de ella: borrarla
  -- dejaria esa factura sin su venta en Atlas. El gate de 0135 lo impide; si aparece, se mira a mano.
  if exists (select 1 from purga_ids where alegra_env = 'produccion') then
    raise exception 'ABORTADO: hay ventas de prueba con factura de PRODUCCION. No se borran sin revisarlas.';
  end if;

  raise notice 'Ventas de prueba a borrar: %', (select a_borrar from purga_antes);
  for r in select * from purga_ids order by created_at loop
    raise notice '  % | % | % | factura % (%)', r.created_at, r.amount, r.status, coalesce(r.alegra_invoice_state::text, '-'), coalesce(r.alegra_env, '-');
  end loop;
end $$;

-- ── LOS MOVIMIENTOS DE VENTA DE ESTAS VENTAS (Bloque 3) ────────────────────────────────────────────
--
-- Son append-only por trigger, asi que el borrado va con el trigger desactivado DENTRO de esta transaccion
-- (el DDL es transaccional: si algo falla, vuelve solo). Mismo patron que la purga del Bloque 0. Sin esto,
-- borrar la venta chocaria con la FK RESTRICT del movimiento y la purga abortaria entera.
create temp table purga_movs on commit drop as
  select m.id, m.location_id, m.nutraceutical_id, m.lot_id, m.delta, m.type::text as tipo
    from nutraceutical_stock_movements m
    join transaction_items ti on ti.id = m.transaction_item_id
    join purga_ids p on p.id = ti.transaction_id;

do $$
begin
  raise notice 'Movimientos de venta de prueba a borrar: % (% unidades)',
    (select count(*) from purga_movs), (select coalesce(-sum(delta), 0) from purga_movs);
  -- Solo movimientos de VENTA: si una venta de prueba tuviera otro tipo ligado, algo no es lo que parece.
  if exists (select 1 from purga_movs where tipo <> 'venta') then
    raise exception 'ABORTADO: una venta de prueba tiene movimientos que no son de venta.';
  end if;
end $$;

alter table nutraceutical_stock_movements disable trigger nutra_movement_append_only_trg;
delete from nutraceutical_stock_movements m using purga_movs x where m.id = x.id;
alter table nutraceutical_stock_movements enable trigger nutra_movement_append_only_trg;

-- EL SALDO SE RECALCULA desde los movimientos, igual que lo hace el trigger: es una proyeccion. El trigger de
-- coherencia del saldo valida cada fila al actualizarla.
update nutraceutical_inventory i
   set stock_quantity = (
         select coalesce(sum(m.delta), 0) from nutraceutical_stock_movements m
          where m.location_id = i.location_id and m.nutraceutical_id = i.nutraceutical_id
            and m.lot_id = i.lot_id and m.type <> 'remesa'),
       last_updated = now()
 where (i.location_id, i.nutraceutical_id, i.lot_id) in
       (select distinct location_id, nutraceutical_id, lot_id from purga_movs);

-- Los eventos de Wompi guardan la venta en el `reference` del payload, no en una columna.
delete from payment_webhook_events e
 using purga_ids p
 where e.provider = 'wompi'
   and e.payload -> 'data' -> 'transaction' ->> 'reference' = p.id::text;

-- Lineas, reservas, comision e ingreso de CNV se van con la venta (ON DELETE CASCADE).
delete from transactions t using purga_ids p where t.id = p.id;

do $$
declare
  a record;
  quedan int;
begin
  select * into a from purga_antes;
  select count(*) into quedan from transactions where wompi_env = 'test';
  if quedan <> 0 then
    raise exception 'ABORTADO: quedaron % ventas de prueba.', quedan;
  end if;
  if (select count(*) from transactions where wompi_env <> 'test') <> a.ventas_reales
     or (select coalesce(sum(amount), 0) from transactions where wompi_env <> 'test') <> a.monto_real then
    raise exception 'ABORTADO: cambiaria una venta REAL. No se borra nada.';
  end if;
  if exists (select 1 from professional_revenue pr where not exists (select 1 from transactions t where t.id = pr.transaction_id))
     or exists (select 1 from cnv_revenue cr where not exists (select 1 from transactions t where t.id = cr.transaction_id)) then
    raise exception 'ABORTADO: quedaria comision o ingreso sin su venta.';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'nutra_movement_append_only_trg' and tgenabled <> 'O') then
    raise exception 'ABORTADO: el trigger de inmutabilidad de los movimientos quedo desactivado.';
  end if;
  raise notice 'Ventas reales intactas: % por %.', a.ventas_reales, a.monto_real;
end $$;

commit;
