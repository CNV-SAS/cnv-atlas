-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CARGA DEL INVENTARIO INICIAL  ·  Bloque 0/1  ·  primera tanda del laboratorio
--
-- NO SE CORRE TODAVIA. Faltan piezas, y estan listadas abajo en "LO QUE BLOQUEA".
--
-- QUE CARGA: las unidades que los SIETE Integrantes ya tienen en su vitrina. Se corre DESPUES de
-- `purga-comercial.sql` y de la migracion 0118.
--
-- CARGA TAMBIEN LA BODEGA CENTRAL, desde la migracion 0121: las 1.284 unidades que quedan en CNV
-- (386 + 386 + 312 + 186 de producto propio, mas 14 de LUVIA). Antes no tenian donde vivir, porque el
-- saldo iba por (profesional, producto) y un movimiento de la central no tiene profesional.
--
-- ── POR QUE LA CARGA NO ES UN AJUSTE ─────────────────────────────────────────────────────────────
--
-- Atlas nunca reflejo la operacion real: tenia 108 unidades de UN profesional de pruebas contra 500
-- recibidas y 114 entregadas entre siete Integrantes. No hay nada que conciliar, hay todo que cargar.
--
-- ── EL SALDO DE APERTURA ES UNA FOTO, NO UNA HISTORIA ────────────────────────────────────────────
--
-- La fecha de corte es el dia de la purga: antes de ella nada cuenta. Asi que estos movimientos se
-- fechan al correr el script, NO en las fechas reales de agosto, que contradiria el corte. Las fechas
-- reales viven en `reason`, que es dato y no linea de tiempo.
--
-- ── LAS DOS RECEPCIONES DE LUVIA VAN COMO DOS MOVIMIENTOS ────────────────────────────────────────
--
-- 60 unidades el 2026-08-26 y 24 el 2026-08-27, mismo lote. DOS movimientos y no uno de 84, por tres
-- razones, y ninguna es de gusto:
--   · Un movimiento es un HECHO de custodia, no un saldo. El saldo ya es la proyeccion (`inventory`).
--   · El proveedor va a conciliar contra SUS remisiones, que son dos. Un 84 suelto no cruza con nada.
--   · Es producto de TERCERO: CNV le debe al proveedor por unidad vendida, asi que la procedencia de
--     cada unidad es parte del soporte, no un detalle.
-- Colapsarlas borraria que 24 unidades llegaron un dia despues, y eso no se recupera.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ══ 1. LOS DATOS, COMO DATOS ══════════════════════════════════════════════════════════════════════
-- Se declaran en tablas temporales para que se REVISEN como una tabla y para que la verificacion de mas
-- abajo pueda comprobar la aritmetica ANTES de insertar nada.

-- ── LOS SIETE INTEGRANTES ────────────────────────────────────────────────────────────────────────
--
-- LOS SIETE EXISTEN. Santiago creo los seis que faltaban el 2026-09-11, por la aplicacion (/admin), que
-- es como tienen que crearse: un perfil profesional arrastra cuenta, rol y perfil profesional en una sola
-- transaccion, y hacerlo por SQL deja las tres cosas a medias.
--
-- IDS VERIFICADOS CONTRA LA NUBE el 2026-09-11, en solo lectura. La verificacion de mas abajo comprueba
-- ademas que cada uno exista de verdad en `professional_profiles` antes de insertar nada, asi que un id
-- mal pegado aborta el script en vez de cargar inventario a nombre de nadie.
--
-- NO ESTAN EN ESTA LISTA, y es correcto: Gildardo Uribe (Direccion Cientifica, no es Integrante) y las dos
-- cuentas de prueba (Santi pruebas, Profesional Demo).
drop table if exists carga_integrantes;
create temp table carga_integrantes (nombre text primary key, profesional_id uuid) on commit drop;
insert into carga_integrantes (nombre, profesional_id) values
  ('Katherine',      'cbe86871-ad02-4cc0-8310-ec6403eee5fd'),  -- Katherine Ruiz Velez
  ('Diana',          'ea583fe5-25c1-469b-8c79-0c4b6d11d66d'),  -- Diana Marcela Restrepo Anchico
  ('Maria Camila',   '9a22fefa-3f63-4990-9da6-46f56abbd732'),  -- Maria Camila Aristizábal Foronda
  ('Valentina',      'a3256c41-38b3-4318-86c1-330967c87df7'),  -- Valentina Ramírez Huertas
  ('Angela',         '9e06368a-37b3-4b36-8596-577d65ec9684'),  -- Angela Marin Ramirez
  ('Camilo',         'cd7359ef-02ab-446a-8a4d-823e7170ec71'),  -- Camilo Alberto Camargo Puerto
  ('Roberto Jarava', '03a93b95-ced7-4297-bc35-ca1bb06c98dd');  -- Roberto Carlos Jarava Brun

-- ── LOS PRODUCTOS, SU LOTE Y LO RECIBIDO DEL LABORATORIO ─────────────────────────────────────────
--
-- Los ids del catalogo estan verificados contra la nube el 2026-09-11, igual que los PVP, que YA
-- coinciden con los que entrego el laboratorio (107.100 y 166.600, IVA del 19% incluido).
--
-- OJO CON EL NOMBRE: el laboratorio escribe "MULTI-CELL BASE" y el catalogo dice "MULTICELL BASE". Se
-- empareja por ID, no por nombre, asi que no bloquea; conviene unificarlo por prolijidad.
--
-- `codigo_alegra` NO SE INSERTA: `nutraceuticals` todavia no tiene esa columna (entra en el Bloque 1).
-- Se deja aqui para que el dato no se pierda y para el re-mapeo del Bloque 2.
drop table if exists carga_productos;
create temp table carga_productos (
  clave text primary key, producto_id uuid, codigo_alegra text,
  lote text, vence date, recibido_lab integer
) on commit drop;
insert into carga_productos (clave, producto_id, codigo_alegra, lote, vence, recibido_lab) values
  ('MULTICELL',  '77777777-7777-7777-7777-777777777702', 'NUT-001', '19826',    '2028-07-18', 500),
  ('OMEGA',      '77777777-7777-7777-7777-777777777701', 'NUT-002', '20226',    '2028-07-22', 500),
  ('CURCUMIN',   '77777777-7777-7777-7777-777777777703', 'NUT-003', '20526',    '2028-07-25', 426),
  ('D3K2',       '77777777-7777-7777-7777-777777777704', 'NUT-004', '19726',    '2028-07-17', 300),
  -- LUVIA no esta en el catalogo y NO tiene codigo en Alegra. Ver "LO QUE BLOQUEA", punto 4.
  -- PVP 90.000 con IVA (base 75.630, IVA 14.370), confirmado por contabilidad: viene de redondear 89.990.
  ('LUVIA',      null,                                    null,     '04197232', '2028-07-10',  84);

-- ── LO ENTREGADO A CADA INTEGRANTE ───────────────────────────────────────────────────────────────
drop table if exists carga_entregas;
create temp table carga_entregas (nombre text, clave text, unidades integer) on commit drop;
insert into carga_entregas (nombre, clave, unidades) values
  ('Katherine','MULTICELL',24), ('Katherine','OMEGA',24), ('Katherine','CURCUMIN',24), ('Katherine','D3K2',24),
  ('Diana','MULTICELL',15), ('Diana','OMEGA',15), ('Diana','CURCUMIN',15), ('Diana','D3K2',15),
  ('Maria Camila','MULTICELL',15), ('Maria Camila','OMEGA',15), ('Maria Camila','CURCUMIN',15), ('Maria Camila','D3K2',15), ('Maria Camila','LUVIA',15),
  ('Valentina','MULTICELL',15), ('Valentina','OMEGA',15), ('Valentina','CURCUMIN',15), ('Valentina','D3K2',15), ('Valentina','LUVIA',15),
  ('Angela','MULTICELL',15), ('Angela','OMEGA',15), ('Angela','CURCUMIN',15), ('Angela','D3K2',15), ('Angela','LUVIA',15),
  ('Camilo','MULTICELL',15), ('Camilo','OMEGA',15), ('Camilo','CURCUMIN',15), ('Camilo','D3K2',15), ('Camilo','LUVIA',10),
  ('Roberto Jarava','MULTICELL',15), ('Roberto Jarava','OMEGA',15), ('Roberto Jarava','CURCUMIN',15), ('Roberto Jarava','D3K2',15), ('Roberto Jarava','LUVIA',15);
-- Katherine no recibe LUVIA: su consultorio es QUIEN NOS PROVEE LUVIA (Centro de Nutricion Integral
-- Katherine Ruiz). Es la doble consignacion de la seccion 7 del modelo, y conviene tenerlo presente
-- porque es tambien el conflicto de interes de la 7.9: la proveedora es Integrante de la red.

-- ══ 2. VERIFICACION ANTES DE INSERTAR ════════════════════════════════════════════════════════════
-- Aborta antes de tocar nada si la aritmetica no cuadra o si falta un dato. Es la unica parte de este
-- script que sirve igual aunque no se pueda correr: revisa los numeros.
do $$
declare r record; faltan text := '';
begin
  -- (a) Todos los integrantes tienen id. Sin esto, el insert fallaria a mitad.
  select string_agg(nombre, ', ') into faltan from carga_integrantes where profesional_id is null;
  if faltan is not null then
    raise exception 'ABORTADO: estos Integrantes no existen todavia en Atlas -> %. Crealos por la aplicacion y pega sus ids arriba.', faltan;
  end if;

  -- (a2) Y esos ids EXISTEN de verdad. Un uuid bien formado pero ajeno cargaria inventario a nombre de
  -- nadie y el error no se veria hasta que alguien buscara su stock y no lo encontrara.
  select string_agg(i.nombre, ', ') into faltan
    from carga_integrantes i
   where not exists (select 1 from professional_profiles pp where pp.id = i.profesional_id);
  if faltan is not null then
    raise exception 'ABORTADO: estos ids no existen en `professional_profiles` -> %.', faltan;
  end if;

  -- (b) Todos los productos existen en el catalogo.
  select string_agg(clave, ', ') into faltan from carga_productos where producto_id is null;
  if faltan is not null then
    raise exception 'ABORTADO: estos productos no estan en el catalogo -> %.', faltan;
  end if;
  select string_agg(p.clave, ', ') into faltan
    from carga_productos p where not exists (select 1 from nutraceuticals n where n.id = p.producto_id);
  if faltan is not null then
    raise exception 'ABORTADO: estos ids de producto no existen en `nutraceuticals` -> %.', faltan;
  end if;

  -- (c) LA ARITMETICA: lo entregado nunca puede superar lo recibido del laboratorio.
  for r in
    select p.clave, p.recibido_lab, coalesce(sum(e.unidades), 0) as entregado
      from carga_productos p left join carga_entregas e on e.clave = p.clave
     group by p.clave, p.recibido_lab
  loop
    if r.entregado > r.recibido_lab then
      raise exception 'ABORTADO: de % se entregaron % unidades y el laboratorio entrego %.',
        r.clave, r.entregado, r.recibido_lab;
    end if;
    raise notice '%: recibido % · entregado a Integrantes % · queda en bodega central %',
      r.clave, r.recibido_lab, r.entregado, r.recibido_lab - r.entregado;
  end loop;

  -- (c2) HAY UBICACION PARA TODOS, incluida la central. Sin ella, las 1.284 unidades de CNV se quedarian
  -- fuera EN SILENCIO: el insert no encontraria fila y no insertaria nada, sin error.
  if not exists (select 1 from inventory_locations where kind = 'central') then
    raise exception 'ABORTADO: no existe la bodega central. La crea la migracion 0120.';
  end if;
  select string_agg(i.nombre, ', ') into faltan
    from carga_integrantes i
   where not exists (select 1 from inventory_locations l where l.professional_id = i.profesional_id);
  if faltan is not null then
    raise exception 'ABORTADO: estos Integrantes no tienen ubicación de inventario -> %.', faltan;
  end if;

  -- (d) El inventario tiene que estar VACIO: este script carga la apertura, no ajusta un saldo previo.
  if (select count(*) from nutraceutical_stock_movements) <> 0 then
    raise exception 'ABORTADO: ya hay movimientos de inventario. Corre `purga-comercial.sql` primero.';
  end if;
end $$;

-- ══ 3. LOS LOTES ═════════════════════════════════════════════════════════════════════════════════
--
-- Desde la migracion 0121 el lote es una FILA con vencimiento, no un texto libre, porque es lo que permite
-- un retiro dirigido. Se crean antes de mover nada.
insert into lots (nutraceutical_id, code, expires_on, received_on, notes)
select p.producto_id, p.lote, p.vence, date '2026-08-26',
       'Primera tanda del laboratorio, cargada en el arranque de la operacion'
  from carga_productos p
 where p.producto_id is not null
on conflict (nutraceutical_id, code) do nothing;

-- ══ 4. LA CARGA ══════════════════════════════════════════════════════════════════════════════════
--
-- Tipo `recepcion` (+N): es exactamente lo que significa, el Integrante reconoce que tiene en custodia
-- esas unidades. `remesa_id` va nulo a proposito: no hubo remesa declarada en Atlas porque la entrega
-- fisica ocurrio antes de que Atlas existiera para esto. Eso las deja como "recepcion sin respaldo", que
-- es justo como `/faltantes` las va a listar, y esta bien: es verdad.
--
-- El trigger `nutra_movement_apply_trg` proyecta el saldo solo; `nutraceutical_inventory` no se escribe
-- a mano (lo impide el trigger de coherencia, y con razon).

-- ── 4a. LO QUE ESTA EN LA VITRINA DE CADA INTEGRANTE ────────────────────────────────────────────
insert into nutraceutical_stock_movements
  (professional_id, location_id, lot_id, nutraceutical_id, delta, type, reason, lote)
select i.profesional_id, loc.id, lo.id, p.producto_id, e.unidades, 'recepcion',
       'Carga inicial: primera tanda del laboratorio, entregada al Integrante antes del corte de arranque',
       p.lote
  from carga_entregas e
  join carga_integrantes   i   on i.nombre = e.nombre
  join carga_productos     p   on p.clave  = e.clave
  join inventory_locations loc on loc.professional_id = i.profesional_id
  join lots                lo  on lo.nutraceutical_id = p.producto_id and lo.code = p.lote
 where e.clave <> 'LUVIA';

-- ── 4b. LO QUE QUEDA EN LA BODEGA CENTRAL ───────────────────────────────────────────────────────
--
-- `professional_id` VA NULO, y es lo correcto: la central no tiene dueño. Es exactamente lo que la
-- migracion 0121 vino a permitir, y la razon por la que estas 1.284 unidades no se podian registrar.
--
-- SE CALCULA, NO SE ESCRIBE: lo recibido menos lo entregado. Escribir el 386 a mano seria una tercera
-- cifra capaz de contradecir a las otras dos.
insert into nutraceutical_stock_movements
  (professional_id, location_id, lot_id, nutraceutical_id, delta, type, reason, lote)
select null, cen.id, lo.id, p.producto_id,
       p.recibido_lab - coalesce((select sum(e.unidades) from carga_entregas e where e.clave = p.clave), 0),
       'recepcion',
       'Carga inicial: saldo en bodega central tras la primera entrega a Integrantes',
       p.lote
  from carga_productos p
  join lots lo on lo.nutraceutical_id = p.producto_id and lo.code = p.lote
  cross join (select id from inventory_locations where kind = 'central') cen
 where p.producto_id is not null
   and p.recibido_lab - coalesce((select sum(e.unidades) from carga_entregas e where e.clave = p.clave), 0) > 0;

-- ── 4c. LUVIA ──────────────────────────────────────────────────────────────────────────────────
--
-- ⚠ COMENTADO hasta que LUVIA exista en el catalogo con su `ownership`, su titular de marca y su
-- proveedor. Y con una condicion de seguridad: se crea con `commercial_availability = 'no_disponible'`,
-- que desde el 2026-09-11 SI impide venderlo (hasta entonces esa bandera solo gateaba la entrega).
-- insert into nutraceutical_stock_movements (professional_id, nutraceutical_id, delta, type, reason, lote)
-- select i.profesional_id, p.producto_id, e.unidades, 'recepcion',
--        'Carga inicial LUVIA (producto de tercero): recepcion del proveedor del 2026-08-26, 60 unidades',
--        p.lote
--   from carga_entregas e
--   join carga_integrantes i on i.nombre = e.nombre
--   join carga_productos   p on p.clave  = e.clave
--  where e.clave = 'LUVIA';

-- ══ 5. CONTEO PARA EL ACTA ═══════════════════════════════════════════════════════════════════════
-- Una fila por producto, con las cifras que tienen que cuadrar entre si. Esta tabla va al acta.
select p.clave,
       p.lote,
       p.vence,
       p.recibido_lab                                   as recibido_del_laboratorio,
       coalesce(sum(e.unidades), 0)                     as entregado_a_integrantes,
       p.recibido_lab - coalesce(sum(e.unidades), 0)    as queda_en_bodega_central,
       coalesce((select sum(m.delta) from nutraceutical_stock_movements m
                  where m.nutraceutical_id = p.producto_id), 0) as cargado_en_atlas,
       coalesce((select sum(i.stock_quantity) from nutraceutical_inventory i
                  join inventory_locations l on l.id = i.location_id
                 where i.nutraceutical_id = p.producto_id and l.kind = 'central'), 0)    as saldo_central,
       coalesce((select sum(i.stock_quantity) from nutraceutical_inventory i
                  join inventory_locations l on l.id = i.location_id
                 where i.nutraceutical_id = p.producto_id and l.kind = 'integrante'), 0) as saldo_integrantes
  from carga_productos p
  left join carga_entregas e on e.clave = p.clave
 group by p.clave, p.lote, p.vence, p.recibido_lab, p.producto_id
 order by p.clave;

-- REVISA LA TABLA DE ARRIBA ANTES DE CONFIRMAR. En los cuatro productos propios tienen que cumplirse LAS
-- TRES a la vez:
--   cargado_en_atlas  = recibido_del_laboratorio
--   saldo_integrantes = entregado_a_integrantes
--   saldo_central     = queda_en_bodega_central
-- Si solo cuadran dos, el saldo y los movimientos estan diciendo cosas distintas, que es justo lo que este
-- sistema no puede permitirse.
-- Si cuadra:      commit;
-- Si no cuadra:   rollback;
commit;

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LO QUE BLOQUEA ESTE SCRIPT
--
-- 1. [RESUELTO 2026-09-11] Los seis perfiles que faltaban ya estan creados, y sus ids pegados arriba.
-- 2. [RESUELTO, migraciones 0120/0121] La bodega central existe y el saldo va por (ubicacion, producto,
--    lote), asi que las 1.284 unidades de CNV ya tienen donde vivir. Este script las carga.
-- 3. [RESUELTO, migracion 0121] El lote gobierna el saldo. Los cinco se crean en el paso 3.
--
-- 4. LUVIA SIGUE FUERA. Falta crearlo en el catalogo con `ownership='tercero'`, su titular de marca
--    (Centro de Nutricion Integral Katherine Ruiz), su proveedor como entidad en `suppliers`, y su
--    esquema de reparto en `revenue_splits` (proveedor 0,70 y umbral de aviso 0,10). El PVP ya no
--    bloquea: 90.000 con IVA, confirmado por contabilidad.
--
--    Y NO SE HABILITA PARA VENTA hasta que Direccion Cientifica firme las equivalencias de alergenos.
--
-- 5. EL CODIGO DE ALEGRA ya tiene columna (`alegra_item_id`, migracion 0120) y se rellena en el
--    Bloque 2. Los cuatro codigos estan arriba, en `carga_productos`, esperando ese momento.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════
