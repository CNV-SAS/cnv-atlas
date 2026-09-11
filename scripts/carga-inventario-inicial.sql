-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CARGA DEL INVENTARIO INICIAL  ·  Bloque 0/1  ·  primera tanda del laboratorio
--
-- NO SE CORRE TODAVIA. Faltan piezas, y estan listadas abajo en "LO QUE BLOQUEA".
--
-- QUE CARGA: las unidades que los SIETE Integrantes ya tienen en su vitrina. Se corre DESPUES de
-- `purga-comercial.sql` y de la migracion 0118.
--
-- QUE NO CARGA, Y HAY QUE SABERLO: las 1.284 unidades que quedan en la BODEGA CENTRAL de CNV
-- (386 + 386 + 312 + 186 de producto propio, mas 14 de LUVIA). Hoy `nutraceutical_inventory` esta
-- indexado por (PROFESIONAL, producto) y no existe el concepto de bodega central, asi que ese saldo no
-- tiene donde vivir. Entra con `inventory_locations` en el Bloque 1. La cifra queda en el acta para que
-- no se pierda.
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
-- ⚠ SEIS DE LOS SIETE NO EXISTEN TODAVIA EN LA NUBE. Atlas tiene cuatro perfiles profesionales y solo
-- UNO es de esta lista:
--
--   a3256c41-38b3-4318-86c1-330967c87df7  Valentina Ramírez Huertas   <- REAL, Integrante de la lista
--   f94edfb4-9f22-4ce0-bc8a-cc69a8516508  Gildardo Uribe              <- real, pero no es Integrante
--   9c59bdac-426e-404d-8a66-2c114b126e7c  Santi pruebas               <- de prueba
--   320e7829-d3a4-4a57-a84b-b1a17deef553  Profesional Demo            <- de prueba
--
-- Los seis que faltan se crean POR LA APLICACION (alta de integrante), no por SQL: un perfil profesional
-- arrastra cuenta, rol y perfil tributario, y crearlo a mano deja las tres cosas a medias.
-- Al crearlos, se pegan aqui sus ids.
drop table if exists carga_integrantes;
create temp table carga_integrantes on commit drop (nombre text primary key, profesional_id uuid);
insert into carga_integrantes (nombre, profesional_id) values
  ('Katherine',      null),  -- ⚠ PENDIENTE de crear
  ('Diana',          null),  -- ⚠ PENDIENTE de crear
  ('Maria Camila',   null),  -- ⚠ PENDIENTE de crear
  ('Valentina',      'a3256c41-38b3-4318-86c1-330967c87df7'),
  ('Angela',         null),  -- ⚠ PENDIENTE de crear
  ('Camilo',         null),  -- ⚠ PENDIENTE de crear
  ('Roberto Jarava', null);  -- ⚠ PENDIENTE de crear

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
create temp table carga_productos on commit drop (
  clave text primary key, producto_id uuid, codigo_alegra text,
  lote text, vence date, recibido_lab integer
);
insert into carga_productos (clave, producto_id, codigo_alegra, lote, vence, recibido_lab) values
  ('MULTICELL',  '77777777-7777-7777-7777-777777777702', 'NUT-001', '19826',    '2028-07-18', 500),
  ('OMEGA',      '77777777-7777-7777-7777-777777777701', 'NUT-002', '20226',    '2028-07-22', 500),
  ('CURCUMIN',   '77777777-7777-7777-7777-777777777703', 'NUT-003', '20526',    '2028-07-25', 426),
  ('D3K2',       '77777777-7777-7777-7777-777777777704', 'NUT-004', '19726',    '2028-07-17', 300),
  -- LUVIA no esta en el catalogo y NO tiene codigo en Alegra. Ver "LO QUE BLOQUEA", punto 4.
  ('LUVIA',      null,                                    null,     '04197232', '2028-07-10',  84);

-- ── LO ENTREGADO A CADA INTEGRANTE ───────────────────────────────────────────────────────────────
drop table if exists carga_entregas;
create temp table carga_entregas on commit drop (nombre text, clave text, unidades integer);
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

  -- (d) El inventario tiene que estar VACIO: este script carga la apertura, no ajusta un saldo previo.
  if (select count(*) from nutraceutical_stock_movements) <> 0 then
    raise exception 'ABORTADO: ya hay movimientos de inventario. Corre `purga-comercial.sql` primero.';
  end if;
end $$;

-- ══ 3. LA CARGA ══════════════════════════════════════════════════════════════════════════════════
--
-- Tipo `recepcion` (+N): es exactamente lo que significa, el Integrante reconoce que tiene en custodia
-- esas unidades. `remesa_id` va nulo a proposito: no hubo remesa declarada en Atlas porque la entrega
-- fisica ocurrio antes de que Atlas existiera para esto. Eso las deja como "recepcion sin respaldo", que
-- es justo como `/faltantes` las va a listar, y esta bien: es verdad.
--
-- El trigger `nutra_movement_apply_trg` proyecta el saldo solo; `nutraceutical_inventory` no se escribe
-- a mano (lo impide el trigger de coherencia, y con razon).

-- Producto propio: las cuatro lineas por Integrante.
insert into nutraceutical_stock_movements (professional_id, nutraceutical_id, delta, type, reason, lote)
select i.profesional_id, p.producto_id, e.unidades, 'recepcion',
       'Carga inicial: primera tanda del laboratorio, entregada al Integrante antes del corte de arranque',
       p.lote
  from carga_entregas e
  join carga_integrantes i on i.nombre = e.nombre
  join carga_productos   p on p.clave  = e.clave
 where e.clave <> 'LUVIA';

-- LUVIA: DOS movimientos por Integrante, uno por cada recepcion del proveedor, en proporcion a lo que
-- cada recepcion aporto (60 de 84 y 24 de 84). Ver la nota de la cabecera sobre por que no se colapsan.
-- ⚠ Este bloque queda COMENTADO hasta que LUVIA exista en el catalogo (punto 4 de lo que bloquea).
-- insert into nutraceutical_stock_movements (professional_id, nutraceutical_id, delta, type, reason, lote)
-- select i.profesional_id, p.producto_id, e.unidades, 'recepcion',
--        'Carga inicial LUVIA (producto de tercero): recepcion del proveedor del 2026-08-26, 60 unidades',
--        p.lote
--   from carga_entregas e
--   join carga_integrantes i on i.nombre = e.nombre
--   join carga_productos   p on p.clave  = e.clave
--  where e.clave = 'LUVIA';

-- ══ 4. CONTEO PARA EL ACTA ═══════════════════════════════════════════════════════════════════════
-- Una fila por producto: lo recibido del laboratorio, lo cargado a Integrantes, y lo que queda en la
-- bodega central SIN cargar (porque todavia no hay donde). Esta tabla va al acta.
select p.clave,
       p.lote,
       p.vence,
       p.recibido_lab                                            as recibido_del_laboratorio,
       coalesce(sum(e.unidades), 0)                              as entregado_a_integrantes,
       p.recibido_lab - coalesce(sum(e.unidades), 0)             as queda_en_bodega_central_sin_cargar,
       coalesce((select sum(m.delta) from nutraceutical_stock_movements m
                  where m.nutraceutical_id = p.producto_id), 0)  as cargado_en_atlas
  from carga_productos p
  left join carga_entregas e on e.clave = p.clave
 group by p.clave, p.lote, p.vence, p.recibido_lab, p.producto_id
 order by p.clave;

-- REVISA LA TABLA DE ARRIBA ANTES DE CONFIRMAR.
-- `entregado_a_integrantes` y `cargado_en_atlas` tienen que coincidir en los cuatro productos propios.
-- Si cuadra:      commit;
-- Si no cuadra:   rollback;
commit;

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LO QUE BLOQUEA ESTE SCRIPT, en orden de lo que cuesta resolverlo
--
-- 1. SEIS PERFILES DE INTEGRANTE NO EXISTEN (Katherine, Diana, Maria Camila, Angela, Camilo, Roberto
--    Jarava). Se crean por la aplicacion, no por SQL. Es el bloqueo mayor y no depende del conteo
--    fisico: se puede resolver hoy.
--
-- 2. NO HAY BODEGA CENTRAL. Las 1.284 unidades que quedan en CNV no tienen donde vivir hasta que exista
--    `inventory_locations` (Bloque 1). El script las CUENTA y no las carga.
--
-- 3. EL LOTE NO GOBIERNA EL SALDO. Hoy `lote` es texto libre en el movimiento y el saldo se lleva por
--    (profesional, producto). Con un solo lote por producto da igual hoy; con la segunda tanda, no.
--    Es el principio 8 del modelo ("todo movimiento contra un lote") y entra en el Bloque 1.
--
-- 4. LUVIA NO ESTA EN EL CATALOGO, y crearlo hoy seria crearlo mal: faltan `ownership`, `brand_owner`,
--    `supplier_id` y su esquema de reparto, que son Bloque 1. Ademas NO TIENE PVP declarado en la
--    entrega del laboratorio; el modelo comercial usa 90.000 (base 75.630, IVA 14.370), que hay que
--    confirmar.
--
--    Y UNA CONDICION DE SEGURIDAD: el dia que LUVIA entre al catalogo, `no_disponible` NO basta para
--    impedir que se venda. Esa bandera gatea la ENTREGA y no la VENTA: el checkout de /pagos filtra el
--    catalogo solo por "tiene precio". Hay que cerrar ese hueco ANTES de crear la fila de LUVIA.
--
-- 5. EL CODIGO DE ALEGRA (NUT-001..004) no tiene columna donde ir. Entra con `alegra_item_id` en el
--    Bloque 1 y se usa en el Bloque 2.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════
