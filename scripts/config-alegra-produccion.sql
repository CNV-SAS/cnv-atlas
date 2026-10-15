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
-- EL MAPA DE ITEMS ES POR AMBIENTE DESDE LA 0144 (`alegra_items`). Este script escribe la fila de PRODUCCION
-- de cada producto y NO TOCA la del sandbox: los dos mapas conviven, y la factura lee el del ambiente con que
-- factura. Por eso ya no hace falta "volver los items" al sandbox despues de una vuelta atras.
-- (Antes de la 0144 sobrescribia los ids del sandbox en `nutraceuticals`; eso ya no pasa.)
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
  ('bank_account_pasarela_id', '<LLENAR>'),   -- "Wompi por liquidar"
  -- ═══ Y LA DE LA TRANSFERENCIA, QUE FALTABA (2026-10-15) ═══
  --
  -- NO ES OPCIONAL AUNQUE LA COLUMNA LA ADMITA NULA. `cuentaDelPago` devuelve null sin ella, y entonces la
  -- factura de una venta pagada POR TRANSFERENCIA se emite y el pago NO se registra: el panel dice por que,
  -- pero mientras nadie lo mire el paciente figura "por cobrar" en Alegra.
  --
  -- Y NO HEREDA LA DEL EFECTIVO a proposito (2026-09-25): "Efectivo en poder de Integrantes" dice que la
  -- plata esta en el bolsillo de alguien, y una transferencia ya llego a una cuenta.
  ('bank_account_transferencia_id', '<LLENAR>');  -- la cuenta PUENTE de las transferencias

-- ══ 1b. EL VISTO BUENO DE LAS VENTAS QUE QUEDAN PENDIENTES ═══════════════════════════════════════
--
-- ═══ POR QUE ESTE SCRIPT PREGUNTA ESTO (Santiago, 2026-10-15) ═══
--
-- EL ORDEN ES LA REGLA, NO UNA RECOMENDACION: las llaves de produccion NO se montan hasta que el smoke
-- termine y todo lo de prueba este marcado. Y la razon es que la marca a mano solo frena la factura si llega
-- ANTES que la cola: en el instante en que esta fila queda escrita y Vercel apunta a produccion, todo lo que
-- estaba esperando se emite con numeracion de la DIAN. Lo que se marque cinco minutos despues ya no se
-- arregla con una marca, se arregla con una nota credito que tiene que hacer una persona.
--
-- Y el smoke se hace con profesionales y pacientes REALES (decision suya del 15: *"es lo que necesita para
-- probar de verdad"*), asi que esas ventas NACEN REALES. El unico freno que las cubre es la marca a mano.
--
-- LO QUE HACE EL BLOQUE (2) DE ABAJO: lista, una por una, las ventas que la cola emitiria en cuanto esto
-- quede, y ABORTA mientras esta bandeja diga '<REVISAR>'. No decide por nadie: obliga a mirar la lista. Si
-- la lista sale vacia, no pregunta nada.
--
-- PARA VER LA LISTA SIN MONTAR NADA: correr este mismo script en ENSAYO (sin --commit) con los '<LLENAR>'
-- como estan. La lista se imprime antes de que se revise cualquier otra cosa.
create temp table revision_previa (clave text primary key, valor text not null) on commit drop;
insert into revision_previa (clave, valor) values
  -- Se cambia a 'si' cuando CADA venta de la lista este decidida: marcada como prueba (si fue del smoke) o
  -- aceptada como real (y entonces su factura es correcta y tiene que salir).
  ('ventas_pendientes_revisadas', '<REVISAR>');

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
  -- ══ LO QUE SE VA A FACTURAR EN EL INSTANTE EN QUE ESTO QUEDE ══════════════════════════════════
  --
  -- VA PRIMERO, ANTES DE REVISAR LOS VALORES, por dos razones: es lo irreversible (un id mal copiado se
  -- corrige y se vuelve a correr; una factura emitida pide nota credito), y asi la lista se puede ver hoy
  -- corriendo el script en ensayo con los '<LLENAR>' puestos.
  --
  -- ⚠ ESTA CONDICION ES LA DE LA COLA, COPIADA. Sale de LE_FALTA_ALGO, FACTURABLE y LA_FACTURA_ES_DE_CNV
  --   (src/modules/payments/data/facturacion-repository.ts), mas la marca a mano y el tope de intentos. Se
  --   escribe con el prefijo "transactions." aunque sobre, para que coincida LETRA POR LETRA con lo que
  --   exporta ese archivo: el candado "las-llaves-no-entran-con-ventas-sin-revisar.test.ts" compara los
  --   textos, y si la cola cambia, se pone rojo nombrando este archivo. Una condicion parecida seria peor
  --   que ninguna: diria que no hay nada que facturar y la cola emitiria otra cosa.
  --
  -- NO ENTRAN LAS DE PACIENTE DE PRUEBA: a esas las frena "motivoSiPacienteYAmbienteNoCuadran", que en
  -- produccion exige paciente real. Las peligrosas son las de paciente REAL que fueron pruebas, que es
  -- justo lo que deja el smoke.
  select count(*) into n
    from transactions
    left join patients pa on pa.id = transactions.patient_id
   where transactions.status = 'paid'
     and (transactions.registered_retroactively_at is null and (transactions.alegra_invoice_state is distinct from 'emitida' or transactions.alegra_payment_id is null))
     and (transactions.review_reason is null or transactions.review_resolution in ('segunda_compra', 'efectivo_no_recibido'))
     and (transactions.modalidad_de_la_venta <> 'distribucion')
     and transactions.marcada_como_prueba_at is null
     and transactions.alegra_attempts < 5
     and coalesce(pa.cuenta_como_de_prueba, false) = false;

  raise notice '--- VENTAS QUE SE FACTURARIAN EN PRODUCCION EN CUANTO ESTO QUEDE: % ---', n;
  for v in
    select transactions.id, transactions.created_at::date as dia, transactions.amount,
           transactions.payment_method, pr.full_name as profesional,
           (select string_agg(nn.name || ' x' || ti.quantity, ', ' order by nn.name)
              from transaction_items ti join nutraceuticals nn on nn.id = ti.nutraceutical_id
             where ti.transaction_id = transactions.id) as productos
      from transactions
      left join patients pa on pa.id = transactions.patient_id
      left join professional_profiles pp on pp.id = transactions.professional_id
      left join profiles pr on pr.id = pp.profile_id
     where transactions.status = 'paid'
       and (transactions.registered_retroactively_at is null and (transactions.alegra_invoice_state is distinct from 'emitida' or transactions.alegra_payment_id is null))
       and (transactions.review_reason is null or transactions.review_resolution in ('segunda_compra', 'efectivo_no_recibido'))
       and (transactions.modalidad_de_la_venta <> 'distribucion')
       and transactions.marcada_como_prueba_at is null
       and transactions.alegra_attempts < 5
       and coalesce(pa.cuenta_como_de_prueba, false) = false
     order by transactions.created_at
     -- UN TOPE, porque la salida se lee: con cientos de lineas el aviso del final se pierde arriba. El
     -- numero de la cabecera y el aborto cuentan TODAS; esta lista solo sirve para reconocerlas.
     limit 40
  loop
    -- SIN DATOS DEL PACIENTE: esta salida se pega en un chat y en un documento de entrega. Con la fecha, el
    -- monto, el medio y el Integrante alcanza para reconocer una venta propia.
    raise notice 'venta % | % | % | % | % | %', v.id, v.dia, v.amount, v.payment_method,
      coalesce(v.profesional, 'sin Integrante'), coalesce(v.productos, 'sin lineas');
  end loop;
  if n > 40 then
    raise notice '... y % mas. Si son tantas, la lista no es el camino: mira /pagos con el filtro de prueba.', n - 40;
  end if;

  if n > 0 and (select valor from revision_previa where clave = 'ventas_pendientes_revisadas') <> 'si' then
    raise exception 'ABORTADO: % ventas se facturarian en Alegra PRODUCCION con numeracion de la DIAN en cuanto esto quede. Revisa la lista de arriba: lo que fue del smoke se marca como prueba en /pagos (la marca frena la factura en cualquier ambiente), y lo que es real se deja. Despues cambia ventas_pendientes_revisadas a si, en el bloque (1b) de este archivo.', n;
  end if;

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
  -- LAS TRES CUENTAS PUENTE SON TRES SITIOS DISTINTOS. Si dos coinciden es que se copio la misma linea, y el
  -- cotejo contra el extracto no puede notarlo: veria una cuenta que cuadra en el total y miente en el origen.
  if (select valor from cfg_produccion where clave = 'bank_account_transferencia_id')
   in (select valor from cfg_produccion where clave in ('bank_account_efectivo_id', 'bank_account_pasarela_id')) then
    raise exception 'ABORTADO: la cuenta de transferencias repite la de efectivo o la de Wompi.';
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
   bank_account_efectivo_id, bank_account_pasarela_id, bank_account_transferencia_id, note, updated_at)
select 'produccion',
       max(valor) filter (where clave = 'invoice_template_id'),
       max(valor) filter (where clave = 'credit_note_template_id'),
       max(valor) filter (where clave = 'iva_tax_id'),
       max(valor) filter (where clave = 'cost_center_propio_id'),
       max(valor) filter (where clave = 'cost_center_tercero_id'),
       max(valor) filter (where clave = 'bank_account_efectivo_id'),
       max(valor) filter (where clave = 'bank_account_pasarela_id'),
       max(valor) filter (where clave = 'bank_account_transferencia_id'),
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
  bank_account_transferencia_id = excluded.bank_account_transferencia_id,
  note                     = excluded.note,
  updated_at               = now();

do $$
declare n int;
begin
  insert into alegra_items (nutraceutical_id, env, item_id)
  select n.id, 'produccion', i.item
    from items_produccion i join nutraceuticals n on n.name = i.producto and not n.is_test
  on conflict (nutraceutical_id, env) do update set item_id = excluded.item_id, updated_at = now();
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
    raise notice 'alegra_config %: factura % | nota credito % | IVA % | centro propio % | centro tercero % | cuenta efectivo % | cuenta Wompi % | cuenta transferencias %',
      r.env, r.invoice_template_id, r.credit_note_template_id, r.iva_tax_id,
      r.cost_center_propio_id, r.cost_center_tercero_id, r.bank_account_efectivo_id, r.bank_account_pasarela_id,
      r.bank_account_transferencia_id;
  end loop;
  for r in select n.name, n.ownership, ai.item_id, ai.env from alegra_items ai
             join nutraceuticals n on n.id = ai.nutraceutical_id
            order by n.name, ai.env loop
    raise notice 'producto % (%) -> item % de %', rpad(r.name, 18), r.ownership, r.item_id, r.env;
  end loop;
end $$;

commit;
