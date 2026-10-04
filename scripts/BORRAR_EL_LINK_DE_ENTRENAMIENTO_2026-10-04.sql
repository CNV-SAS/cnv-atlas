-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- BORRAR UN LINK DE PAGO QUE NUNCA COBRO  ·  decision de Santiago, 2026-10-04
--
-- EL CASO: una Integrante armo un checkout para una paciente REAL mientras Atlas apunta al sandbox, y
-- despues le cobro por transferencia. El link quedo anulado a mano y /direccion lo cuenta: "Anulados a mano:
-- 1 · alguien cambio de opinion o se equivoco al armarlo".
--
-- POR QUE SE BORRA Y NO SE MARCA, que era mi propuesta y aqui NO sirve: marcar al paciente como de prueba
-- seria MENTIR SOBRE UNA PACIENTE REAL para limpiar una cifra, y esa marca la leen el diagnostico, la
-- facturacion y la investigacion. El remedio seria peor que el problema.
--
-- Y POR QUE ESTE SI SE PUEDE BORRAR, que es la otra mitad: no cobro nada, no facturo nada, y NO MOVIO
-- INVENTARIO. No hay rastro de custodia que quede suelto. Una venta que si movio unidades NO se borra, y en
-- este caso ni siquiera depende de que lo recordemos: `nutraceutical_stock_movements.transaction_item_id` es
-- ON DELETE RESTRICT, asi que la base RECHAZA el borrado si hubo un movimiento. El guard es la base, no el
-- cuidado de quien corre esto.
--
-- LAS CINCO CONDICIONES SE COMPRUEBAN ABAJO Y ABORTAN. Si alguna no se cumple, no se borra nada y el
-- mensaje dice cual.
--
-- LO QUE SE VA EN CASCADA: sus lineas (`transaction_items`) y las reservas de inventario de esas lineas. Lo
-- demas (comision, ingreso de CNV, reversas) no existe para una venta que nunca se pago, y el bloque de
-- verificacion lo confirma antes de tocar nada.
--
-- NO DEJA RASTRO EN clinical_audit_log, a proposito y con su limite: es una fila que nunca represento un
-- hecho clinico ni un cobro. Esto NO es el patron para borrar una venta real.
--
-- COMO SE CORRE (nunca en el editor SQL de Supabase, que no sostiene la transaccion):
--   En PowerShell, con $env:DATABASE_URL de la nube:
--     node scripts/aplicar-migracion.mjs scripts/BORRAR_EL_LINK_DE_ENTRENAMIENTO_2026-10-04.sql
--   ... leer los NOTICE, y si dice lo esperado, lo mismo con --commit al final.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_id uuid := 'bd992993-c9e6-4053-810f-2c22b04e123a';
  v record;
  v_movimientos int;
  v_comisiones int;
  v_ingresos int;
  v_reversas int;
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

  -- (4) NO MOVIO INVENTARIO. Se comprueba por los movimientos REALES, no por `stock_state`: el estado es un
  --     resumen y los movimientos son el hecho.
  select count(*) into v_movimientos
    from nutraceutical_stock_movements m
    join transaction_items ti on ti.id = m.transaction_item_id
   where ti.transaction_id = v_id;
  if v_movimientos > 0 then
    raise exception 'ABORTA: tiene % movimiento(s) de inventario. Esa venta saco unidades de verdad y su rastro de custodia no se borra.',
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
  raise notice 'Se borrara la venta, sus lineas y las reservas de esas lineas. Nada mas.';
end $$;

-- Las reservas no cuelgan de la venta sino de sus LINEAS, y su cascade es desde la linea. Se borran
-- explicitamente para que el conteo de abajo las nombre.
delete from inventory_reservations r
 using transaction_items ti
 where ti.id = r.transaction_item_id
   and ti.transaction_id = 'bd992993-c9e6-4053-810f-2c22b04e123a';

delete from transaction_items where transaction_id = 'bd992993-c9e6-4053-810f-2c22b04e123a';

delete from transactions where id = 'bd992993-c9e6-4053-810f-2c22b04e123a';

do $$
declare v_quedan int;
begin
  select count(*) into v_quedan from transactions where id = 'bd992993-c9e6-4053-810f-2c22b04e123a';
  if v_quedan > 0 then
    raise exception 'ABORTA: la venta sigue ahi despues del delete.';
  end if;
  raise notice 'LISTO: la venta ya no esta. En /direccion, "Anulados a mano" tiene que bajar a 0.';
end $$;
