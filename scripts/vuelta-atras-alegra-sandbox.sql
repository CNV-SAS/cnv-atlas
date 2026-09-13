-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- VUELTA ATRAS DEL MAPA DE ITEMS AL SANDBOX  ·  Bloque 2b
--
-- QUE HACE: vuelve a apuntar los cinco productos a sus items del SANDBOX (los de la migracion 0130, leidos
-- del sandbox por API el 2026-09-12 y releidos el 2026-09-13). No borra la fila 'produccion' de
-- `alegra_config`: con las variables de sandbox en Vercel no se usa, y dejarla evita tener que volver a
-- llenarla el dia que se reintente.
--
-- CUANDO HACE FALTA: SOLO si despues de volver atras se va a facturar otra vez en el sandbox (un smoke).
-- Para frenar la emision en produccion NO hace falta: eso lo hace devolver las variables de Vercel.
--
-- COMO SE CORRE:
--   node --env-file=.env.produccion.local scripts/aplicar-migracion.mjs scripts/vuelta-atras-alegra-sandbox.sql
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

  update nutraceuticals
     set alegra_item_id = s.item, alegra_env = 'sandbox', updated_at = now()
    from items_sandbox s
   where nutraceuticals.name = s.producto and not nutraceuticals.is_test;
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'ABORTADO: se esperaban 5 productos y se actualizaron %.', n;
  end if;

  raise notice 'Items de vuelta en sandbox: %',
    (select string_agg(name || ' -> ' || alegra_item_id, ', ' order by name)
       from nutraceuticals where alegra_env = 'sandbox');
end $$;

commit;
