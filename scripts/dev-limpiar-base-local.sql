-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CERRAR LA COLA DE FACTURACION DE LA BASE DE DESARROLLO  ·  SOLO LOCAL  ·  2026-09-18
--
-- POR QUE: meses de corridas de la suite dejaron 1.176 ventas pendientes en la cola de facturacion de la base
-- LOCAL. Varios candados contra base real piden "las primeras N de la mas vieja a la mas nueva" y su venta recien
-- creada queda FUERA de esa ventana, asi que fallan sin que haya nada roto. Es lo que hacia fallar a
-- `venta-anulacion-y-revision-db`, y un test que falla a veces ensena a ignorar las fallas.
--
-- NO BORRA NADA, y esa fue la segunda version: borrar las ventas exige soltar los movimientos de inventario, que
-- son append-only por diseno (el registro de custodia no se edita ni se borra, se corrige con un movimiento
-- inverso). Cerrar la cola logra lo mismo sin tocar esa regla: las ventas viejas quedan como facturadas y dejan
-- de aparecer en el barrido.
--
-- SE NIEGA A CORRER EN LA NUBE, y el candado no es el nombre de la base (las dos se llaman `postgres`): es la
-- DIRECCION DEL SERVIDOR. La local corre en un contenedor, con IP privada; la nube, no.
-- Y NO se puede usar "¿hay pacientes reales?" como candado, que fue lo primero que intente: el seed local trae
-- 113 pacientes sin marcar de prueba, asi que abortaba siempre en el sitio equivocado.
--
-- COMO SE CORRE (en la maquina de desarrollo, con DATABASE_URL apuntando a la LOCAL):
--   node scripts/aplicar-migracion.mjs scripts/dev-limpiar-base-local.sql --commit
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  servidor inet := inet_server_addr();
  antes int;
  cerradas int;
begin
  if servidor is null then
    raise exception 'ABORTADO: no se pudo leer la direccion del servidor. Esto es solo para la base local.';
  end if;
  if not (servidor <<= inet '127.0.0.0/8' or servidor <<= inet '10.0.0.0/8'
          or servidor <<= inet '172.16.0.0/12' or servidor <<= inet '192.168.0.0/16') then
    raise exception 'ABORTADO: % no es una direccion privada. Esta base NO es la local, y aqui no se borra ni se cierra nada.', servidor;
  end if;
  raise notice 'Servidor local confirmado: %', servidor;

  select count(*) into antes from transactions t
   where t.status = 'paid'
     and (t.alegra_invoice_state is distinct from 'emitida' or t.alegra_payment_id is null);
  raise notice 'Ventas en la cola de facturacion antes: %', antes;

  -- Solo las de AYER hacia atras: una venta creada hoy puede ser de un candado que esta corriendo ahora mismo.
  update transactions
     set alegra_invoice_state = 'emitida',
         alegra_payment_id = coalesce(alegra_payment_id, 'dev-cerrada'),
         alegra_attempts = 0,
         updated_at = now()
   where status = 'paid'
     and created_at < date_trunc('day', now())
     and (alegra_invoice_state is distinct from 'emitida' or alegra_payment_id is null);
  get diagnostics cerradas = row_count;

  raise notice 'Cerradas: %. La cola queda con las de hoy, y los candados vuelven a ver lo que crean ellos.', cerradas;

  -- Y EL SALDO DE LOS PRODUCTOS QUE INVENTAN LOS TESTS ("TEST VENTA <id>"): son cientos de filas de inventario de
  -- productos que no existen para nadie, y hacen que un lector que pide "todo el inventario" se pase del tope de
  -- 1.000 filas de PostgREST y devuelva una lista donde falta justo el producto que el candado busca. Se borra la
  -- PROYECCION del saldo, no los movimientos, que son append-only.
  delete from nutraceutical_inventory i
   using nutraceuticals n
   where n.id = i.nutraceutical_id and n.name like 'TEST VENTA %';
  get diagnostics cerradas = row_count;
  raise notice 'Saldos de productos inventados por los tests, borrados: %', cerradas;
end $$;

commit;
