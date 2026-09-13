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
--   · El inventario: estas ventas nunca movieron existencias.
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

-- Los eventos de Wompi guardan la venta en el `reference` del payload, no en una columna.
delete from payment_webhook_events e
 using purga_ids p
 where e.provider = 'wompi'
   and e.payload -> 'data' -> 'transaction' ->> 'reference' = p.id::text;

-- Lineas, comision e ingreso de CNV se van con la venta (ON DELETE CASCADE).
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
  raise notice 'Ventas reales intactas: % por %.', a.ventas_reales, a.monto_real;
end $$;

commit;
