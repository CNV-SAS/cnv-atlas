-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- VUELTA ATRAS DEL MAPA DE ITEMS AL SANDBOX  ·  Bloque 2b
--
-- DESDE LA 0144 YA NO REESCRIBE NADA QUE ESTE BIEN. El mapa de items es por ambiente (`alegra_items`) y
-- configurar produccion no toca las filas del sandbox. Este script queda como COMPROBACION: asegura que los
-- cinco productos siguen mapeados a sus items del SANDBOX (los de la migracion 0130, leidos del sandbox por API
-- el 2026-09-12 y releidos el 2026-09-13), y repone el que falte. No borra la fila 'produccion' de
-- `alegra_config` ni las de produccion de `alegra_items`: con las variables de sandbox en Vercel no se usan.
--
-- CUANDO HACE FALTA: SOLO si despues de volver atras se va a facturar otra vez en el sandbox (un smoke).
-- Para frenar la emision en produccion NO hace falta: eso lo hace devolver las variables de Vercel.
--
-- COMO SE CORRE:
--   En una ventana de PowerShell con $env:DATABASE_URL de la nube (ver la guia del 2b, A2):
--     node scripts/aplicar-migracion.mjs scripts/vuelta-atras-alegra-sandbox.sql
--   ... y con --commit al final cuando el ensayo diga "SIN ERRORES".
--
-- Para volver a produccion despues: `scripts/config-alegra-produccion.sql` otra vez, con sus valores.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

create temp table items_sandbox (producto text primary key, item text not null) on commit drop;
insert into items_sandbox (producto, item) values
  ('MULTI-CELL BASE',   '5'),   -- NUT-001 (registro RSA-3987-2026, con guion; migracion 0137)
  ('OMEGA COMPLEX',     '6'),   -- NUT-002
  ('CURCUMIN BIOACTIV', '2'),   -- NUT-003
  ('D3-K2 OSTEO',       '3'),   -- NUT-004
  ('LUVIA',             '4');   -- EXT-001

do $$
declare n int;
begin
  if not exists (select 1 from alegra_config where env = 'sandbox') then
    raise exception 'ABORTADO: no hay fila de sandbox en alegra_config; volver los items no serviria de nada.';
  end if;

  insert into alegra_items (nutraceutical_id, env, item_id)
  select n.id, 'sandbox', s.item
    from items_sandbox s join nutraceuticals n on n.name = s.producto and not n.is_test
  on conflict (nutraceutical_id, env) do update set item_id = excluded.item_id, updated_at = now();
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'ABORTADO: se esperaban 5 productos y se escribieron %.', n;
  end if;

  raise notice 'Items del sandbox: %',
    (select string_agg(nu.name || ' -> ' || ai.item_id, ', ' order by nu.name)
       from alegra_items ai join nutraceuticals nu on nu.id = ai.nutraceutical_id
      where ai.env = 'sandbox' and not nu.is_test);
end $$;

commit;
