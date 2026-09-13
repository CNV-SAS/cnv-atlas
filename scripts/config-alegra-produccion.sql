-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CONFIGURACION DE ALEGRA PRODUCCION  ·  Bloque 2b
--
-- QUE HACE: inserta la fila 'produccion' de `alegra_config` y apunta los cinco productos a sus items de
-- Alegra PRODUCCION. No toca la fila del sandbox.
--
-- CUANDO: en la ventana del paso a produccion, justo antes de cambiar las variables en Vercel. Ver
-- `docs/entregas/GUIA_2B_PASO_A_PRODUCCION.md`, que dice el orden. Se ENSAYA antes, sin --commit.
--
-- COMO SE CORRE (nunca en el editor SQL de Supabase, que no sostiene la transaccion):
--   En una ventana de PowerShell con $env:DATABASE_URL de la nube (ver la guia del 2b, A2):
--     node scripts/aplicar-migracion.mjs scripts/config-alegra-produccion.sql
--   ... y lo mismo con --commit al final cuando el ensayo diga "SIN ERRORES".
--
-- ── LO QUE HAY QUE SABER ANTES DE CORRERLO ──────────────────────────────────────────────────────
--
-- EL MAPA DE ITEMS ES DE UN SOLO AMBIENTE POR PRODUCTO. `nutraceuticals.alegra_item_id` guarda UN id con
-- su ambiente, asi que este script SOBRESCRIBE los ids del sandbox. Desde el --commit, una venta facturada
-- contra el sandbox falla con "Items de otro ambiente": por eso se corre en la ventana y no antes. Volver
-- al sandbox es `scripts/vuelta-atras-alegra-sandbox.sql`.
--
-- LOS VALORES SE LLENAN A MANO, COPIADOS DE `scripts/leer-alegra.mjs` corrido con las credenciales de
-- produccion. Mientras quede un '<LLENAR>' o un valor que no sea un numero, el script ABORTA sin escribir.
--
-- ES REPETIBLE: correrlo dos veces con los mismos valores deja lo mismo. Si un id estaba mal, se corrige
-- aqui y se vuelve a correr.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ══ 1. LOS VALORES. LO UNICO QUE SE EDITA ════════════════════════════════════════════════════════

create temp table cfg_produccion (clave text primary key, valor text not null) on commit drop;
insert into cfg_produccion (clave, valor) values
  -- NUMERACIONES DE FACTURA: la ELECTRONICA activa con prefijo FE (la de la facturacion manual; Atlas
  -- continua esa misma numeracion, decision de contabilidad del 2026-09-13).
  ('invoice_template_id',      '<LLENAR>'),
  -- NUMERACIONES DE NOTA CREDITO: la ELECTRONICA activa (la de NC1 y NC2).
  ('credit_note_template_id',  '<LLENAR>'),
  -- IMPUESTOS: el IVA al 19%.
  ('iva_tax_id',               '<LLENAR>'),
  -- CENTROS DE COSTO. OJO A NO INVERTIRLOS: el cotejo no puede saber cual es cual, solo avisa por nombre.
  ('cost_center_propio_id',    '<LLENAR>'),   -- productos PROPIOS de CNV (MULTI-CELL, OMEGA, CURCUMIN, D3-K2)
  ('cost_center_tercero_id',   '<LLENAR>'),   -- productos de TERCERO (LUVIA)
  -- CUENTAS PUENTE. Nunca una de tipo bank.
  ('bank_account_efectivo_id', '<LLENAR>'),   -- "Efectivo en poder de Integrantes"
  ('bank_account_pasarela_id', '<LLENAR>');   -- "Wompi por liquidar"

create temp table items_produccion (producto text primary key, item text not null) on commit drop;
insert into items_produccion (producto, item) values
  -- El nombre de la izquierda es el de ATLAS, tal cual (no se toca). El id es el del item de Alegra
  -- produccion. MULTI-CELL, OMEGA y CURCUMIN tienen el MISMO precio: cruzarlos no lo detecta ningun
  -- cotejo de precios, solo el de nombre. Copiar mirando el nombre, no la cifra.
  ('MULTI-CELL BASE',   '<LLENAR>'),
  ('OMEGA COMPLEX',     '<LLENAR>'),
  ('CURCUMIN BIOACTIV', '<LLENAR>'),
  ('D3-K2 OSTEO',       '<LLENAR>'),
  ('LUVIA',             '<LLENAR>');

-- ══ 2. LA VERIFICACION. Nada se escribe si algo falla ══════════════════════════════════════════════

do $$
declare
  faltan    text;
  v         record;
  n         int;
begin
  -- Todo lleno, y con forma de id de Alegra (un entero). Un '<LLENAR>', un vacio o un nombre pegado donde
  -- iba el id abortan aqui.
  select string_agg(clave, ', ') into faltan from cfg_produccion where valor !~ '^[0-9]+$';
  if faltan is not null then
    raise exception 'ABORTADO: falta llenar (o no es un id numerico): %', faltan;
  end if;
  select string_agg(producto, ', ') into faltan from items_produccion where item !~ '^[0-9]+$';
  if faltan is not null then
    raise exception 'ABORTADO: falta el item de Alegra de: %', faltan;
  end if;

  -- Pares que no pueden ser el mismo id. Si lo son, se copio dos veces la misma linea.
  if (select valor from cfg_produccion where clave = 'cost_center_propio_id')
   = (select valor from cfg_produccion where clave = 'cost_center_tercero_id') then
    raise exception 'ABORTADO: el centro de costo propio y el de tercero son el mismo id.';
  end if;
  if (select valor from cfg_produccion where clave = 'bank_account_efectivo_id')
   = (select valor from cfg_produccion where clave = 'bank_account_pasarela_id') then
    raise exception 'ABORTADO: la cuenta de efectivo y la de Wompi son el mismo id.';
  end if;
  if (select valor from cfg_produccion where clave = 'invoice_template_id')
   = (select valor from cfg_produccion where clave = 'credit_note_template_id') then
    raise exception 'ABORTADO: la numeracion de factura y la de nota credito son el mismo id.';
  end if;
  if (select count(distinct item) from items_produccion) <> (select count(*) from items_produccion) then
    raise exception 'ABORTADO: dos productos apuntan al mismo item de Alegra. La factura diria un producto que no es.';
  end if;

  -- Cada nombre tiene que ser EXACTAMENTE un producto de Atlas. Buscar por texto ancla mal si el nombre
  -- no coincide (cero filas: el producto quedaria sin mapear) o si se repite (dos filas: un item para dos).
  for v in select producto from items_produccion loop
    select count(*) into n from nutraceuticals where name = v.producto and not is_test;
    if n <> 1 then
      raise exception 'ABORTADO: "%" corresponde a % productos de Atlas, y tiene que ser exactamente 1.', v.producto, n;
    end if;
  end loop;

  -- Y al reves: ningun producto VENDIBLE puede quedar fuera de la lista. Quedaria con su id del sandbox y
  -- su primera venta en produccion fallaria con "Items de otro ambiente".
  select string_agg(name, ', ') into faltan
    from nutraceuticals
   where not is_test
     and commercial_availability <> 'no_disponible'
     and name not in (select producto from items_produccion);
  if faltan is not null then
    raise exception 'ABORTADO: productos vendibles que esta lista no mapea: %', faltan;
  end if;

  if not exists (select 1 from alegra_config where env = 'sandbox') then
    raise notice 'Aviso: no hay fila de sandbox. No impide nada, pero la vuelta atras no tendria a donde volver.';
  end if;
end $$;

-- ══ 3. LA ESCRITURA ════════════════════════════════════════════════════════════════════════════════

insert into alegra_config
  (env, invoice_template_id, credit_note_template_id, iva_tax_id,
   cost_center_propio_id, cost_center_tercero_id,
   bank_account_efectivo_id, bank_account_pasarela_id, note, updated_at)
select 'produccion',
       max(valor) filter (where clave = 'invoice_template_id'),
       max(valor) filter (where clave = 'credit_note_template_id'),
       max(valor) filter (where clave = 'iva_tax_id'),
       max(valor) filter (where clave = 'cost_center_propio_id'),
       max(valor) filter (where clave = 'cost_center_tercero_id'),
       max(valor) filter (where clave = 'bank_account_efectivo_id'),
       max(valor) filter (where clave = 'bank_account_pasarela_id'),
       'Leido de Alegra PRODUCCION con scripts/leer-alegra.mjs. Numeracion compartida con la facturacion manual (FE/NC), decision de contabilidad 2026-09-13. Pago contra cuentas PUENTE por el BRUTO.',
       now()
  from cfg_produccion
on conflict (env) do update set
  invoice_template_id      = excluded.invoice_template_id,
  credit_note_template_id  = excluded.credit_note_template_id,
  iva_tax_id               = excluded.iva_tax_id,
  cost_center_propio_id    = excluded.cost_center_propio_id,
  cost_center_tercero_id   = excluded.cost_center_tercero_id,
  bank_account_efectivo_id = excluded.bank_account_efectivo_id,
  bank_account_pasarela_id = excluded.bank_account_pasarela_id,
  note                     = excluded.note,
  updated_at               = now();

do $$
declare n int;
begin
  update nutraceuticals
     set alegra_item_id = i.item, alegra_env = 'produccion', updated_at = now()
    from items_produccion i
   where nutraceuticals.name = i.producto and not nutraceuticals.is_test;
  get diagnostics n = row_count;
  if n <> (select count(*) from items_produccion) then
    raise exception 'ABORTADO: se esperaban % productos actualizados y fueron %.', (select count(*) from items_produccion), n;
  end if;
end $$;

-- ══ 4. LO QUE QUEDO, PARA REVISARLO ═══════════════════════════════════════════════════════════════
-- Como NOTICE y no como SELECT: `aplicar-migracion.mjs` imprime los avisos de Postgres y no el resultado
-- de una consulta. Un SELECT de revision aqui no lo veria nadie.

do $$
declare r record;
begin
  for r in select * from alegra_config order by env loop
    raise notice 'alegra_config %: factura % | nota credito % | IVA % | centro propio % | centro tercero % | cuenta efectivo % | cuenta Wompi %',
      r.env, r.invoice_template_id, r.credit_note_template_id, r.iva_tax_id,
      r.cost_center_propio_id, r.cost_center_tercero_id, r.bank_account_efectivo_id, r.bank_account_pasarela_id;
  end loop;
  for r in select name, ownership, alegra_item_id, alegra_env from nutraceuticals
            where alegra_item_id is not null order by name loop
    raise notice 'producto % (%) -> item % de %', rpad(r.name, 18), r.ownership, r.alegra_item_id, r.alegra_env;
  end loop;
end $$;

commit;
