-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA CARGA INICIAL DEL INVENTARIO AL ARRANQUE  ·  se corre EL DIA del arranque, no antes
--
-- ═══ LAS CIFRAS SON LAS CORREGIDAS DEL 2026-11-20 ═══
--
-- Santiago reviso el inventario a fondo con el chat contable. Tres cifras de lo entregado se movieron
-- (Angela OMEGA 32 -> 38 y LUVIA 11 -> 13; Katherine OMEGA 24 -> 34), y con ellas la bodega esperada pasa
-- de 345/344/271/153/33 a 345/328/271/153/31. LA PRUEBA DE QUE SON LAS BUENAS ES LUVIA: con 13 para
-- Angela, la bodega da 31, que es EXACTAMENTE el conteo fisico del 19 de noviembre; antes daba 33 contra un
-- conteo de 31.
--
-- Y lo que se carga sigue siendo LO RECIBIDO, no el saldo de hoy. El archivo corregido trae las dos cifras,
-- pero cargar el saldo de hoy y despues subir el xlsx de ventas atrasadas restaria esas ventas DOS VECES.
--
-- ═══ LA REGLA QUE APLICA (Santiago, 2026-11-17) ═══
--
-- Textual suya: *"El inventario de cada integrante se carga con TODO LO QUE RECIBIO, segun la lista. Las
-- ventas reales de antes del arranque estan marcadas como prueba en Atlas y facturadas a mano en Alegra.
-- Despues del arranque se subiran desde un xlsx como ventas atrasadas, y ahi si descontaran inventario.
-- Hasta entonces el sistema muestra mas que el fisico: es aceptado y temporal."*
--
-- O SEA QUE ESTO NO ES UN CONTEO FISICO. Es una DECLARACION de punto de partida: "de aqui arranca cada
-- vitrina". El conteo fisico sigue siendo otro acto, y para ese esta
-- `CONCILIAR_EL_INVENTARIO_AL_ARRANQUE_2026-10-15.sql`, que es de donde sale la mecanica de este.
--
-- ═══ POR QUE FIJA EL SALDO Y NO SUMA LA DIFERENCIA ═══
--
-- Medido contra produccion el 2026-11-17 (`scripts/EL_INVENTARIO_CONTRA_LO_RECIBIDO_2026-11-17.mjs`):
-- **46 movimientos de venta ya descontaron 56 unidades**, y las 64 ventas de la nube cuentan todas como de
-- prueba. La marca NO devuelve la unidad al estante: el libro de movimientos es append-only porque describe
-- algo que PASO, y la unidad salio de verdad aunque el acto fuera una prueba.
--
-- Asi que sumar "lo que falta" encima de un saldo ya contaminado da otra cifra equivocada. Lo que se afirma
-- aqui es el saldo RESULTANTE, que es exactamente lo que dice un movimiento de `conciliacion`: *"el saldo
-- estaba mal y lo que hay es esto"*. No se inventa camino: es el que ya existe.
--
-- Y NO SE USA `baja`: `baja` afirma que una unidad existia y se perdio o se destruyo. Aqui no se destruyo
-- nada; lo que se corrige es el saldo. Usar `baja` para bajar las vitrinas de los dos Integrantes que ya no
-- siguen diria que CNV destruyo 75 frascos que tiene en la bodega.
--
-- ═══ POR QUE NO ES UNA REMESA, QUE ERA LA DUDA DE SANTIAGO ═══
--
-- Su duda textual: *"no se si eliminamos el inventario de todas las personas y les armo la remesa como admin
-- para que ellos acepten"*. La remesa NO sirve para esto, y la razon es lo que la remesa SIGNIFICA: una
-- remesa mas su aceptacion son el Integrante DECLARANDO que recibio X unidades hoy. Estas unidades las
-- recibio en agosto y septiembre, y la mayoria ya las tiene en el saldo. Pedirle que las acepte hoy seria
-- (a) hacerle declarar un hecho con fecha falsa y (b) SUMARLAS encima de lo que ya tiene, o sea contarlas
-- dos veces. El peso de la aceptacion es real y por eso no se salta: lo que pasa es que aqui no aplica,
-- porque no hay ninguna entrega nueva que aceptar.
--
-- LA REMESA SIGUE SIENDO EL CAMINO para lo que venga despues: toda entrega NUEVA se despacha como remesa y
-- el Integrante la confirma. Esto es solo el punto de partida.
--
-- ═══ COMO SE CORRE ═══
--
--   1. Pegarlo en el editor SQL de Supabase de PRODUCCION y correrlo TAL CUAL: termina en `rollback`, asi
--      que no guarda nada y muestra los cuadros de verificacion.
--   2. Leer los TRES cuadros, en este orden:
--        · (3c) SALDO FUERA DEL PLAN. Tiene que venir VACIO. Si trae una ubicacion con saldo, esa ubicacion
--          no esta declarada en el bloque (2) y sus unidades van a quedar sueltas.
--        · (4) LO QUE VA A PASAR, linea por linea.
--        · (4b) EL VEREDICTO. Tiene que decir CUADRA en los cinco productos.
--   3. Solo entonces, cambiar `rollback` por `commit` y volver a correr.
--
-- ═══ EL NETO NO SE ESCRIBE A MANO, SE CALCULA (Santiago, 2026-11-18) ═══
--
-- La version anterior decia "el neto tiene que dar +12 MULTI y +8 OMEGA", que era la medicion del 17 de
-- noviembre. ESA CIFRA YA NO SIRVE: el smoke del 18 y el 19 mueve mas unidades, y una cifra escrita a mano
-- que envejece es peor que ninguna, porque quien la lee cree que cuadra o cree que no por la razon
-- equivocada. Ahora el bloque (4b) la CALCULA contra lo que de verdad se movio, y dice CUADRA o NO CUADRA.
--
-- LA INVARIANTE QUE COMPRUEBA: al terminar, el total por producto en todo el sistema tiene que ser la
-- primera tanda completa (500 / 500 / 426 / 300 / 84). Es la unica cifra que no depende de como se repartio
-- nada: son los frascos que CNV compro, y ninguno se destruyo.
--
-- ⚠ DESPUES DE `commit` NO SE DESHACE: un movimiento no se borra, se corrige con otro movimiento. El paso 2
-- no es opcional.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── (0) PARAMETROS ───────────────────────────────────────────────────────────────────────────────
--
-- PARA_REVISAR: el correo del actor, que queda como autor de cada ajuste y de cada fila de auditoria.
create temporary table _ajuste(correo text, motivo text) on commit drop;
insert into _ajuste values (
  'gilurgi69@gmail.com',
  'Carga inicial al arranque 2026-11-20: el saldo de cada vitrina queda en lo que esa persona recibio'
);

-- EL ACTOR TIENE QUE EXISTIR. Sin esto, un correo mal escrito dejaria `created_by` en nulo y el ajuste
-- quedaria sin autor, que es justo lo que este script existe para evitar.
do $$
declare v_id uuid;
begin
  select p.id into v_id from profiles p join _ajuste a on true where lower(p.email) = lower(a.correo);
  if v_id is null then
    raise exception 'No hay ningun perfil con ese correo. Revisa el parametro `correo` del bloque (0).';
  end if;
end $$;

-- ── (1) EL SALDO DE HOY, para cotejar antes de tocar nada ────────────────────────────────────────
select 'SALDO DE HOY' as que,
       l.kind as tipo_de_ubicacion, l.name as ubicacion, n.name as producto, lt.code as lote,
       lt.expires_on as vence, i.stock_quantity as sistema
  from nutraceutical_inventory i
  join inventory_locations l on l.id = i.location_id
  join nutraceuticals n on n.id = i.nutraceutical_id
  join lots lt on lt.id = i.lot_id
 where i.stock_quantity <> 0
   and l.kind <> 'cuarentena'
   and coalesce(n.is_test, false) = false
 order by l.kind, l.name, n.name, lt.code;

-- ── (2) EL PUNTO DE PARTIDA DECLARADO ────────────────────────────────────────────────────────────
--
-- PARA_REVISAR: una fila por (ubicacion, producto, lote) con el saldo que tiene que QUEDAR. Lo imprime el
-- bloque 8 del script de lectura; los nombres se copian TAL CUAL porque el emparejamiento es por nombre y
-- el bloque (3b) aborta si uno no existe.
--
-- LO QUE NO SE LISTA NO SE TOCA, y es deliberado: las cuentas de smoke (Profesional Prueba, Profesional
-- demo 2, Profesional Demo) tienen ADAPTO-STRESS, que es otro asunto (seccion 4l del segundo smoke), y los
-- Integrantes sin entrega estan en cero y ahi se quedan. No hay bandera de "llevar a cero lo no listado",
-- a diferencia del script de conciliacion: aqui una linea olvidada no debe borrar nada.
create temporary table _conteo(ubicacion text, producto text, lote text, contado integer) on commit drop;

insert into _conteo values
  -- Lo entregado, segun la lista de Santiago del 2026-11-17.
  ('Katherine Ruiz Velez',             'MULTI-CELL BASE',   '19826',    24),
  ('Katherine Ruiz Velez',             'OMEGA COMPLEX',     '20226',    34),
  ('Katherine Ruiz Velez',             'CURCUMIN BIOACTIV', '20526',    24),
  ('Katherine Ruiz Velez',             'D3-K2 OSTEO',       '19726',    24),
  ('Zoraida Meneses',                  'MULTI-CELL BASE',   '19826',    15),
  ('Zoraida Meneses',                  'OMEGA COMPLEX',     '20226',    14),
  ('Zoraida Meneses',                  'CURCUMIN BIOACTIV', '20526',    14),
  ('Zoraida Meneses',                  'D3-K2 OSTEO',       '19726',    14),
  ('Maria Camila Aristizábal Foronda', 'MULTI-CELL BASE',   '19826',    15),
  ('Maria Camila Aristizábal Foronda', 'OMEGA COMPLEX',     '20226',    15),
  ('Maria Camila Aristizábal Foronda', 'CURCUMIN BIOACTIV', '20526',    15),
  ('Maria Camila Aristizábal Foronda', 'D3-K2 OSTEO',       '19726',    15),
  ('Maria Camila Aristizábal Foronda', 'LUVIA',             '04197232', 15),
  ('Valentina Ramírez Huertas',        'MULTI-CELL BASE',   '19826',    15),
  ('Valentina Ramírez Huertas',        'OMEGA COMPLEX',     '20226',    15),
  ('Valentina Ramírez Huertas',        'CURCUMIN BIOACTIV', '20526',    15),
  ('Valentina Ramírez Huertas',        'D3-K2 OSTEO',       '19726',    15),
  ('Valentina Ramírez Huertas',        'LUVIA',             '04197232', 10),
  ('Angela Marin Ramirez',             'MULTI-CELL BASE',   '19826',    31),
  ('Angela Marin Ramirez',             'OMEGA COMPLEX',     '20226',    38),
  ('Angela Marin Ramirez',             'CURCUMIN BIOACTIV', '20526',    31),
  ('Angela Marin Ramirez',             'D3-K2 OSTEO',       '19726',    23),
  ('Angela Marin Ramirez',             'LUVIA',             '04197232', 13),
  ('Camilo Alberto Camargo Puerto ',   'MULTI-CELL BASE',   '19826',    15),
  ('Camilo Alberto Camargo Puerto ',   'OMEGA COMPLEX',     '20226',    15),
  ('Camilo Alberto Camargo Puerto ',   'CURCUMIN BIOACTIV', '20526',    15),
  ('Camilo Alberto Camargo Puerto ',   'D3-K2 OSTEO',       '19726',    15),
  ('Camilo Alberto Camargo Puerto ',   'LUVIA',             '04197232', 10),
  ('Frank Carrera',                    'MULTI-CELL BASE',   '19826',    10),
  ('Frank Carrera',                    'OMEGA COMPLEX',     '20226',    10),
  ('Frank Carrera',                    'CURCUMIN BIOACTIV', '20526',    10),
  ('Frank Carrera',                    'D3-K2 OSTEO',       '19726',    10),
  ('Frank Carrera',                    'LUVIA',             '04197232',  5),
  -- LOS DOS QUE FALTABAN EN LA LISTA (Santiago, 2026-11-18): 15 de cada uno de los cuatro, sin LUVIA. Son
  -- 120 unidades que estaban contadas en la bodega y no lo estaban: por eso la bodega esperada baja de
  -- 375/374/301/183/33 a 345/344/271/153/33, y con la correccion del 20 a 345/328/271/153/31.
  ('Víctor Cano',                      'MULTI-CELL BASE',   '19826',    15),
  ('Víctor Cano',                      'OMEGA COMPLEX',     '20226',    15),
  ('Víctor Cano',                      'CURCUMIN BIOACTIV', '20526',    15),
  ('Víctor Cano',                      'D3-K2 OSTEO',       '19726',    15),
  ('María Teresa Aragón Herrera',      'MULTI-CELL BASE',   '19826',    15),
  ('María Teresa Aragón Herrera',      'OMEGA COMPLEX',     '20226',    15),
  ('María Teresa Aragón Herrera',      'CURCUMIN BIOACTIV', '20526',    15),
  ('María Teresa Aragón Herrera',      'D3-K2 OSTEO',       '19726',    15),
  -- LOS DOS QUE YA NO SIGUEN. Quedan INACTIVOS, no borrados: su cuenta, su historial y lo que se les deba
  -- se conservan, y pueden reactivarse. Lo que se pone en cero es la CUSTODIA, porque el producto fisico ya
  -- no esta con ellos. Una vitrina con saldo de alguien que no opera es una promesa de venta imposible.
  --
  -- Y LAS 3 UNIDADES DE LA INTEGRANTE INACTIVA SI SE CARGAN (1 OMEGA, 1 CURCUMIN, 1 D3-K2): son las que
  -- vendio, y tienen que estar en su vitrina para que el xlsx de ventas atrasadas pueda descontarlas y
  -- dejarla en cero. Sin ellas, su venta se registraria contra un saldo que no existe.
  ('Diana Marcela Restrepo Anchico',   'MULTI-CELL BASE',   '19826',     0),
  ('Diana Marcela Restrepo Anchico',   'OMEGA COMPLEX',     '20226',     1),
  ('Diana Marcela Restrepo Anchico',   'CURCUMIN BIOACTIV', '20526',     1),
  ('Diana Marcela Restrepo Anchico',   'D3-K2 OSTEO',       '19726',     1),
  ('Roberto Carlos Jarava Brun',       'MULTI-CELL BASE',   '19826',     0),
  ('Roberto Carlos Jarava Brun',       'OMEGA COMPLEX',     '20226',     0),
  ('Roberto Carlos Jarava Brun',       'CURCUMIN BIOACTIV', '20526',     0),
  ('Roberto Carlos Jarava Brun',       'D3-K2 OSTEO',       '19726',     0),
  ('Roberto Carlos Jarava Brun',       'LUVIA',             '04197232',  0),
  -- ═══ LAS VITRINAS DEL SMOKE VUELVEN A CERO, Y ESTA ES LA LINEA QUE EL SMOKE OBLIGA A AÑADIR ═══
  --
  -- El smoke del 18 y el 19 corre contra el SANDBOX de Wompi y de Alegra, pero el INVENTARIO ES EL MISMO:
  -- sus remesas sacan unidades de la bodega central de verdad, y sus ventas las descuentan de verdad. Esas
  -- unidades NUNCA SE MOVIERON FISICAMENTE: siguen en la bodega.
  --
  -- Si estas vitrinas no se declararan, el script dejaria la bodega en su cifra correcta Y ADEMAS dejaria
  -- las unidades del smoke en las vitrinas de prueba. El total por producto quedaria por ENCIMA de la
  -- primera tanda, o sea frascos que no existen. El bloque (4b) lo detectaria, pero mas vale no provocarlo.
  --
  -- Van los CINCO productos reales aunque hoy alguna este en cero: lo que el smoke vaya a usar no se sabe
  -- de antemano, y una linea en cero sobre una vitrina vacia no hace nada. Lo que no se lista es
  -- ADAPTO-STRESS y los "PRUEBA SMOKE", que son productos `is_test` y no cuentan en ninguna cifra.
  ('Profesional Demo',                 'MULTI-CELL BASE',   '19826',     0),
  ('Profesional Demo',                 'OMEGA COMPLEX',     '20226',     0),
  ('Profesional Demo',                 'CURCUMIN BIOACTIV', '20526',     0),
  ('Profesional Demo',                 'D3-K2 OSTEO',       '19726',     0),
  ('Profesional Demo',                 'LUVIA',             '04197232',  0),
  ('Profesional Prueba',               'MULTI-CELL BASE',   '19826',     0),
  ('Profesional Prueba',               'OMEGA COMPLEX',     '20226',     0),
  ('Profesional Prueba',               'CURCUMIN BIOACTIV', '20526',     0),
  ('Profesional Prueba',               'D3-K2 OSTEO',       '19726',     0),
  ('Profesional Prueba',               'LUVIA',             '04197232',  0),
  ('Profesional demo 2',               'MULTI-CELL BASE',   '19826',     0),
  ('Profesional demo 2',               'OMEGA COMPLEX',     '20226',     0),
  ('Profesional demo 2',               'CURCUMIN BIOACTIV', '20526',     0),
  ('Profesional demo 2',               'D3-K2 OSTEO',       '19726',     0),
  ('Profesional demo 2',               'LUVIA',             '04197232',  0),
  ('Santi pruebas',                    'MULTI-CELL BASE',   '19826',     0),
  ('Santi pruebas',                    'OMEGA COMPLEX',     '20226',     0),
  ('Santi pruebas',                    'CURCUMIN BIOACTIV', '20526',     0),
  ('Santi pruebas',                    'D3-K2 OSTEO',       '19726',     0),
  ('Santi pruebas',                    'LUVIA',             '04197232',  0),
  -- LA BODEGA: lo inicial menos lo entregado, y nada mas. 500/500/426/300/84 menos la lista de arriba.
  --
  -- NO ES EL CONTEO FISICO, y la diferencia es un dato, no un error del script: el conteo del 19 de
  -- noviembre dio 334 / 304 / 254 / 151 / 31. De la diferencia, casi todo esta explicado (los despachos
  -- directos de bodega para las ventas de Angela y Maria Camila, las ventas de precio especial, las compras
  -- de socios y familia, y las 3 unidades que vendio la Integrante inactiva), y lo que el xlsx de ventas
  -- atrasadas va a restar. Quedan CUATRO unidades (1 MULTI, 1 OMEGA, 1 CURCUMIN, 1 D3-K2) que salieron sin
  -- registro: eso lo cierra el conteo fisico de C5, no esta carga.
  ('Bodega central CNV',               'MULTI-CELL BASE',   '19826',   345),
  ('Bodega central CNV',               'OMEGA COMPLEX',     '20226',   328),
  ('Bodega central CNV',               'CURCUMIN BIOACTIV', '20526',   271),
  ('Bodega central CNV',               'D3-K2 OSTEO',       '19726',   153),
  ('Bodega central CNV',               'LUVIA',             '04197232', 31);

-- ── (2b) LA PRIMERA TANDA, que es contra lo que se comprueba el total ───────────────────────────
--
-- Lo que CNV compro. No se reparte, no se destruye: al terminar el script, la suma de todas las ubicaciones
-- tiene que ser exactamente esto, producto por producto.
create temporary table _inicial(producto text, unidades integer) on commit drop;
insert into _inicial values
  ('MULTI-CELL BASE',   500),
  ('OMEGA COMPLEX',     500),
  ('CURCUMIN BIOACTIV', 426),
  ('D3-K2 OSTEO',       300),
  ('LUVIA',              84);

-- ── (3) EL PLAN, resuelto contra los nombres ──────────────────────────────────────────────────────
--
-- SE RESUELVE EN UNA TABLA INTERMEDIA para poder MOSTRAR lo que va a pasar antes de que pase. Un script que
-- escribe y luego cuenta lo que escribio ya no deja decidir.
create temporary table _plan on commit drop as
select l.id                                  as location_id,
       n.id                                  as nutraceutical_id,
       lt.id                                 as lot_id,
       c.ubicacion, c.producto, c.lote,
       coalesce(i.stock_quantity, 0)         as sistema,
       c.contado
  from _conteo c
  left join inventory_locations l on l.name = c.ubicacion and l.is_active
  left join nutraceuticals n on n.name = c.producto
  left join lots lt on lt.code = c.lote and lt.nutraceutical_id = n.id
  left join nutraceutical_inventory i
         on i.location_id = l.id and i.nutraceutical_id = n.id and i.lot_id = lt.id;

-- ── (3b) LO QUE NO SE PUDO RESOLVER: SE PARA, NO SE ADIVINA ──────────────────────────────────────
--
-- UN NOMBRE MAL COPIADO NO PUEDE PASAR EN SILENCIO. Si se dejara pasar, su linea no se ajustaria y quien
-- corre el script creeria que si: el peor de los tres desenlaces, peor que fallar.
do $$
declare v_malas int; v_detalle text;
begin
  select count(*), string_agg(ubicacion || ' / ' || producto || ' / ' || lote, '; ')
    into v_malas, v_detalle
    from _plan
   where location_id is null or nutraceutical_id is null or lot_id is null;
  if v_malas > 0 then
    raise exception 'Hay % linea(s) del bloque (2) con un nombre que no existe: %. Copialos tal cual de la salida del script de lectura.', v_malas, v_detalle;
  end if;
end $$;

-- ── (3c) SALDO QUE QUEDA FUERA DEL PLAN: TIENE QUE VENIR VACIO ──────────────────────────────────
--
-- "Lo que no se lista no se toca" es la regla del bloque (2), y es la correcta: una linea olvidada no debe
-- borrar nada. Pero tiene una consecuencia que hay que VER, no suponer: si una ubicacion tiene saldo y no
-- esta declarada, sus unidades se quedan donde estan y el total por producto no da la primera tanda.
--
-- Este cuadro es el unico sitio donde eso se nota ANTES de escribir. Si trae algo, hay dos salidas
-- legitimas: declararlo en el bloque (2) con la cifra que debe quedar, o decidir a conciencia que esa
-- ubicacion se queda como esta (y entonces el veredicto de (4b) dira NO CUADRA, y esta bien que lo diga).
select 'SALDO FUERA DEL PLAN' as que,
       l.kind as tipo_de_ubicacion, l.name as ubicacion, n.name as producto, lt.code as lote,
       i.stock_quantity as sistema
  from nutraceutical_inventory i
  join inventory_locations l on l.id = i.location_id
  join nutraceuticals n on n.id = i.nutraceutical_id
  join lots lt on lt.id = i.lot_id
 where i.stock_quantity <> 0
   and l.kind <> 'cuarentena'
   and coalesce(n.is_test, false) = false
   and not exists (
     select 1 from _plan p
      where p.location_id = i.location_id
        and p.nutraceutical_id = i.nutraceutical_id
        and p.lot_id = i.lot_id
   )
 order by l.kind, l.name, n.name;

-- ── (4) LO QUE VA A PASAR: LEER ESTO ANTES DE CAMBIAR rollback POR commit ───────────────────────
select 'LO QUE VA A PASAR' as que,
       p.ubicacion, p.producto, p.lote,
       p.sistema, p.contado, (p.contado - p.sistema) as ajuste,
       case when p.contado = p.sistema then 'sin cambio'
            when p.contado > p.sistema then 'sube: el sistema tiene menos de lo que esa persona recibio'
            else 'baja: el sistema tiene mas de lo que esa persona debe tener' end as lectura
  from _plan p
 order by (p.contado - p.sistema) = 0, p.ubicacion, p.producto, p.lote;

-- ── (4b) EL VEREDICTO: EL NETO CALCULADO, Y SI EL TOTAL VA A CUADRAR ───────────────────────────
--
-- NO HAY NINGUNA CIFRA ESCRITA A MANO AQUI salvo la primera tanda del bloque (2b), que son los frascos que
-- CNV compro y no cambian. Todo lo demas se mide contra lo que de verdad hay hoy, asi que el smoke puede
-- mover lo que quiera y este cuadro sigue diciendo la verdad.
--
--   · `movido_por_las_ventas` es lo que falta hoy respecto de la primera tanda: las unidades que las
--     ventas de prueba y las del smoke se llevaron. Es el neto que el ajuste TIENE que reponer.
--   · `ajuste_del_plan` es lo que el bloque (2) va a ajustar de verdad.
--   · Si los dos coinciden, el total queda en la primera tanda: CUADRA.
select 'VEREDICTO' as que,
       ini.producto,
       ini.unidades                                      as primera_tanda,
       coalesce(hoy.total, 0)                            as total_hoy,
       ini.unidades - coalesce(hoy.total, 0)             as movido_por_las_ventas,
       coalesce(plan.ajuste, 0)                          as ajuste_del_plan,
       coalesce(hoy.total, 0) + coalesce(plan.ajuste, 0) as total_despues,
       case when coalesce(hoy.total, 0) + coalesce(plan.ajuste, 0) = ini.unidades
            then 'CUADRA'
            else '⛔ NO CUADRA: revisa (3c) y el bloque (2). NO corras el commit.' end as veredicto
  from _inicial ini
  left join (
    select n.name as producto, sum(i.stock_quantity)::int as total
      from nutraceutical_inventory i
      join nutraceuticals n on n.id = i.nutraceutical_id
      join inventory_locations l on l.id = i.location_id
     where coalesce(n.is_test, false) = false and l.kind <> 'cuarentena'
     group by n.name
  ) hoy on hoy.producto = ini.producto
  left join (
    select p.producto, sum(p.contado - p.sistema)::int as ajuste
      from _plan p group by p.producto
  ) plan on plan.producto = ini.producto
 order by ini.producto;

-- ── (5) EL AJUSTE: UN MOVIMIENTO POR DIFERENCIA ─────────────────────────────────────────────────
--
-- El saldo de `nutraceutical_inventory` NO se escribe: lo recalcula el trigger de la 0040 como la suma de
-- los movimientos. Un `update` directo quedaria descuadrado contra su propia fuente.
--
-- EL `professional_id` SALE DE LA UBICACION, no del actor: describe de quien es la custodia (nulo en la
-- bodega central, que es de CNV). El actor queda en `created_by`.
insert into nutraceutical_stock_movements
  (professional_id, nutraceutical_id, location_id, lot_id, type, delta, reason, created_by)
select l.professional_id,
       p.nutraceutical_id,
       p.location_id,
       p.lot_id,
       'conciliacion',
       p.contado - p.sistema,
       (select motivo from _ajuste) || ' (sistema ' || p.sistema || ' -> queda ' || p.contado || ')',
       (select pr.id from profiles pr join _ajuste a on true where lower(pr.email) = lower(a.correo))
  from _plan p
  join inventory_locations l on l.id = p.location_id
 where p.contado <> p.sistema;

-- ── (5b) Y EL EVENTO AUDITADO, UNA FILA POR LINEA AJUSTADA ──────────────────────────────────────
--
-- EL MOVIMIENTO YA ES EL RASTRO del inventario (inmutable, con motivo y con autor), y esto es la otra
-- mitad: la pregunta "¿por que esta vitrina arranco con estas unidades?" se hace desde la AUDITORIA, no
-- desde el libro de movimientos, y una respuesta que solo vive en un sitio al que nadie va no es una
-- respuesta. Es el mismo criterio del script de arranque: una fila por entidad, no una por el lote.
--
-- `clinical_audit_log` es append-only POR TRIGGER: insertar esta permitido (describe algo que paso); lo que
-- la base prohibe es editar o borrar. Esto no desarma ningun candado.
insert into clinical_audit_log (event, entity_type, entity_id, actor_id, actor_email, payload)
select 'inventario.carga_inicial_al_arranque',
       'inventory_location',
       p.location_id::text,
       (select pr.id from profiles pr join _ajuste a2 on true where lower(pr.email) = lower(a2.correo)),
       a.correo,
       jsonb_build_object(
         'ubicacion', p.ubicacion,
         'producto', p.producto,
         'lote', p.lote,
         'sistema', p.sistema,
         'queda', p.contado,
         'ajuste', p.contado - p.sistema,
         'motivo', a.motivo
       )
  from _plan p
  join _ajuste a on true
 where p.contado <> p.sistema;

-- ── (6) COMO QUEDO ──────────────────────────────────────────────────────────────────────────────
select 'COMO QUEDO' as que,
       l.kind as tipo_de_ubicacion, l.name as ubicacion, n.name as producto, lt.code as lote,
       i.stock_quantity as sistema
  from nutraceutical_inventory i
  join inventory_locations l on l.id = i.location_id
  join nutraceuticals n on n.id = i.nutraceutical_id
  join lots lt on lt.id = i.lot_id
 where i.stock_quantity <> 0
   and coalesce(n.is_test, false) = false
 order by l.kind, l.name, n.name, lt.code;

-- Y EL TOTAL POR PRODUCTO YA AJUSTADO, contra la primera tanda. Es la misma comprobacion del (4b), hecha
-- ahora sobre el resultado en vez de sobre la prediccion: si las dos dicen lo mismo, el trigger de la 0040
-- hizo lo que se esperaba.
select 'TOTAL POR PRODUCTO' as que,
       ini.producto,
       coalesce(fin.total, 0) as unidades,
       ini.unidades           as primera_tanda,
       case when coalesce(fin.total, 0) = ini.unidades then 'CUADRA'
            else '⛔ NO CUADRA' end as veredicto
  from _inicial ini
  left join (
    select n.name as producto, sum(i.stock_quantity)::int as total
      from nutraceutical_inventory i
      join nutraceuticals n on n.id = i.nutraceutical_id
      join inventory_locations l on l.id = i.location_id
     where coalesce(n.is_test, false) = false and l.kind <> 'cuarentena'
     group by n.name
  ) fin on fin.producto = ini.producto
 order by ini.producto;

-- ⚠ POR DEFECTO NO GUARDA. Revisar los cuadros (4) y cambiar esta linea por `commit;` para aplicarlo.
rollback;
-- commit;
