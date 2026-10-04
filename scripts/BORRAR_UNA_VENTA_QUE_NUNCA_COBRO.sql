-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- BORRAR UNA VENTA QUE NUNCA COBRO  ·  guion reutilizable
--
-- Sustituye a `BORRAR_EL_LINK_DE_ENTRENAMIENTO_2026-10-04.sql`, que llevaba el id escrito en cuatro sitios.
-- Aqui va en UNO solo, abajo, y todo lo demas sale de el.
--
-- ── CUANDO SE PUEDE USAR, Y CUANDO NO ──
--
-- SE PUEDE cuando la venta no cobro, no facturo y NO MOVIO INVENTARIO: no hay rastro de custodia que quede
-- suelto. Es el caso de un link armado por error.
--
-- NO SE PUEDE con una venta que si movio unidades, aunque haya sido de prueba. Y no depende de que lo
-- recordemos: `nutraceutical_stock_movements.transaction_item_id` es ON DELETE RESTRICT, asi que la base
-- RECHAZA el borrado. El guard es el esquema, no el cuidado de quien corre esto.
--
-- EL CASO TIPICO QUE NO PASA: una venta con `stock_state = 'sin_saldo'`. Ese estado significa "se desconto lo
-- que habia y faltaron unidades", o sea que SI hubo movimiento. Esas se cierran descartando su pendiente en
-- "Pendientes sin salida", no borrandolas.
--
-- LAS CINCO CONDICIONES SE COMPRUEBAN Y ABORTAN nombrando la que falle. Si aborta, no se borro nada.
--
-- NO DEJA RASTRO EN clinical_audit_log, a proposito y con su limite: es una fila que nunca represento un
-- hecho clinico ni un cobro. NO es el patron para borrar una venta real.
--
-- COMO SE CORRE (nunca en el editor SQL de Supabase, que no sostiene la transaccion):
--   1. Cambia el id en la linea que dice CAMBIA AQUI.
--   2. En PowerShell, con $env:DATABASE_URL de la nube:
--        node scripts/aplicar-migracion.mjs scripts/BORRAR_UNA_VENTA_QUE_NUNCA_COBRO.sql
--   3. Lee los NOTICE. Si dice lo esperado, lo mismo con --commit al final.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ─────────────────────────────── CAMBIA AQUI ───────────────────────────────
  v_id uuid := 'bd992993-c9e6-4053-810f-2c22b04e123a';
  -- ───────────────────────────────────────────────────────────────────────────
  v record;
  v_movimientos int;
  v_comisiones int;
  v_ingresos int;
  v_reversas int;
  v_lineas int;
  v_reservas int;
begin
  select t.status, t.cancelled_at, t.cancelled_by_sale_id, t.alegra_invoice_number, t.stock_state, t.amount
    into v
    from transactions t where t.id = v_id;

  if not found then
    raise exception 'No existe la venta %. ¿Ya se borro, o el id esta mal?', v_id;
  end if;

  -- (1) NUNCA SE COBRO.
  if v.status <> 'failed' then
    raise exception 'ABORTA: la venta esta en estado "%", no "failed". Una venta cobrada NO se borra.', v.status;
  end if;

  -- (2) SE ANULO A MANO, no la reemplazo otro cobro. Si la hubiera reemplazado otra venta, borrarla dejaria
  --     a esa otra sin la referencia que explica por que existe.
  if v.cancelled_at is null then
    raise exception 'ABORTA: la venta no esta anulada. Solo se borra un link anulado a mano.';
  end if;
  if v.cancelled_by_sale_id is not null then
    raise exception 'ABORTA: este link lo reemplazo otro cobro. Borrarlo dejaria esa venta sin su explicacion.';
  end if;

  -- (3) NO FACTURO.
  if v.alegra_invoice_number is not null then
    raise exception 'ABORTA: tiene factura (%). Una venta facturada no se borra: se corrige con nota credito.',
      v.alegra_invoice_number;
  end if;

  -- (4) NO MOVIO INVENTARIO. Por los movimientos REALES, no por `stock_state`: el estado es un resumen y los
  --     movimientos son el hecho.
  select count(*) into v_movimientos
    from nutraceutical_stock_movements m
    join transaction_items ti on ti.id = m.transaction_item_id
   where ti.transaction_id = v_id;
  if v_movimientos > 0 then
    raise exception 'ABORTA: tiene % movimiento(s) de inventario. Esa venta saco unidades de verdad y su rastro de custodia no se borra. Si sobra en una bandeja, descartala en "Pendientes sin salida".',
      v_movimientos;
  end if;

  -- (5) NO GENERO DINERO NI REVERSAS.
  select count(*) into v_comisiones from professional_revenue where transaction_id = v_id;
  select count(*) into v_ingresos   from cnv_revenue          where transaction_id = v_id;
  select count(*) into v_reversas   from sale_reversals       where transaction_id = v_id;
  if v_comisiones > 0 or v_ingresos > 0 or v_reversas > 0 then
    raise exception 'ABORTA: tiene % comision(es), % ingreso(s) y % reversa(s). Eso es dinero reconocido.',
      v_comisiones, v_ingresos, v_reversas;
  end if;

  raise notice 'LAS CINCO CONDICIONES SE CUMPLEN. Venta % por % COP, anulada el %.', v_id, v.amount, v.cancelled_at;

  -- Las reservas cuelgan de las LINEAS, no de la venta: se borran primero para poder contarlas.
  delete from inventory_reservations r
   using transaction_items ti
   where ti.id = r.transaction_item_id and ti.transaction_id = v_id;
  get diagnostics v_reservas = row_count;

  delete from transaction_items where transaction_id = v_id;
  get diagnostics v_lineas = row_count;

  delete from transactions where id = v_id;

  if exists (select 1 from transactions where id = v_id) then
    raise exception 'ABORTA: la venta sigue ahi despues del delete.';
  end if;

  raise notice 'LISTO: borrada la venta, % linea(s) y % reserva(s). Nada mas.', v_lineas, v_reservas;
end $$;
