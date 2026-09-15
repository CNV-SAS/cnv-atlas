-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- RETIRAR EL PRODUCTO DE PRUEBA DEL SMOKE DEL BLOQUE 3
--
-- Lo deja NO DISPONIBLE (desaparece de lo vendible) y le quita el mapa a Alegra. NO lo borra: sus movimientos
-- son inmutables y sus ventas de prueba las borra `purga-ventas-de-prueba.sql`, que tambien devuelve el saldo.
-- Le cambia el nombre para que un smoke siguiente pueda crear otro sin chocar.
--
-- COMO SE CORRE: igual que el de preparar, con --commit al final.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  -- Se quita su item del mapa por ambiente (0144): el item "PRUEBA" del sandbox queda libre para el siguiente
  -- smoke, que lo vuelve a usar.
  delete from alegra_items
   where nutraceutical_id in (select id from nutraceuticals where name = 'PRUEBA SMOKE BLOQUE 3' and is_test);
  update nutraceuticals
     set commercial_availability = 'no_disponible',
         alegra_item_id = null,
         alegra_env = null,
         -- HORA DE BOGOTA, no la del servidor (UTC): "13:48" en el nombre era 8:48 de la manana (2026-09-14).
         name = 'PRUEBA SMOKE BLOQUE 3 (retirado ' || to_char(now() at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') || ')',
         updated_at = now()
   where name = 'PRUEBA SMOKE BLOQUE 3' and is_test;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'ABORTADO: no hay producto de prueba del smoke que retirar.';
  end if;
  raise notice 'Producto de prueba retirado: ya no se puede vender.';
end $$;

commit;
