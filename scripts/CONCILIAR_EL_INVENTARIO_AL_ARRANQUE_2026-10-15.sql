-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ⛔ NO SE CORRIO EL 2026-10-15, Y NO SE DEBE CORRER EN CERO. OCHO UBICACIONES TIENEN PRODUCTO REAL.
--
-- El plan del 14 era correrlo con el bloque (2) VACIO y `llevar_a_cero_lo_no_listado` en `true`, para que
-- todo arrancara en cero. Santiago pidio confirmar antes *"que eso no borra el saldo de ninguna vitrina que
-- de verdad tenga producto fisico encima"*. **Lo tienen la central y siete vitrinas de Integrantes reales:
-- 1.822 unidades de la primera tanda del laboratorio.** En cero las habria borrado, sin vuelta atras.
--
-- ESTE SCRIPT SIGUE SIENDO EL CORRECTO PARA SU PROPOSITO: cuadrar contra un CONTEO FISICO. Cuando Santiago
-- cuente en la oficina, se llena el bloque (2) con lo contado y se corre. Lo que no se vuelve a plantear es
-- usarlo para "arrancar en cero": ese arranque ya ocurrio en septiembre y la data esta buena.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL INVENTARIO SE CUADRA CON EL CONTEO FISICO  ·  arranque del 2026-10-15
--
-- ═══ POR QUE ESTE SCRIPT EXISTE APARTE DEL DE ARRANQUE ═══
--
-- Porque necesita una cifra que SOLO SANTIAGO TIENE: cuantas unidades hay de verdad, por ubicacion y por
-- lote. Dentro del script de arranque quedaria comentado y sin poder correrse; aparte, se corre cuando el
-- conteo exista, que es otro dia y otra decision.
--
-- ═══ LA DECISION QUE APLICA (Santiago, 2026-10-14) ═══
--
-- Textual suya: *"pienso que la bodega de CNV inicie con todas las unidades y admin va descontando poco a
-- poco y va haciendo remesas"*. El contexto: movieron inventario de un Integrante que ya no sigue, parte
-- entro a la bodega, y a otro se le repuso. O sea que el saldo del sistema NO describe lo que hay.
--
-- ═══ POR QUE SON MOVIMIENTOS Y NO UN UPDATE DEL SALDO ═══
--
-- El saldo de `nutraceutical_inventory` NO es un dato que se escriba: lo calcula un trigger como la SUMA de
-- los movimientos de esa ubicacion y ese lote. Un `update` directo quedaria descuadrado contra su propia
-- fuente, y el trigger lo volveria a pisar en el siguiente movimiento.
--
-- Y POR ESO MARCAR UNA VENTA COMO PRUEBA NO DEVUELVE LA UNIDAD AL ESTANTE, que es la pregunta que mas se
-- repite: el libro de movimientos es append-only a proposito, porque describe algo que PASO. La unidad salio
-- de verdad, aunque el acto fuera una prueba. Lo que corrige el saldo es declarar lo que hay, que es esto.
--
-- ═══ COMO SE CORRE ═══
--
--   1. CORRER SOLO EL BLOQUE (1) para ver el saldo de hoy, con el nombre exacto de cada ubicacion, producto
--      y lote. Esas tres cadenas son las que hay que copiar en el bloque (2): el script empareja por nombre
--      para que no haya que pegar uuid.
--   2. CONTAR FISICAMENTE y llenar el bloque (2) con lo CONTADO (no con la diferencia).
--   3. Correr el script entero con `rollback` al final (esta asi por defecto): imprime que haria.
--   4. Revisar el cuadro "LO QUE VA A PASAR". Si cuadra, cambiar `rollback` por `commit` y volver a correr.
--
-- ⚠ NO SE PUEDE DESHACER DESPUES DE `commit`: un movimiento no se borra, se corrige con otro movimiento. Por
-- eso el paso 3 no es opcional.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── (0) PARAMETROS ───────────────────────────────────────────────────────────────────────────────
--
-- PARA_REVISAR: el correo del actor (queda como autor del ajuste) y la bandera de abajo.
create temporary table _ajuste(correo text, motivo text, llevar_a_cero_lo_no_listado boolean) on commit drop;
insert into _ajuste values (
  'gilurgi69@gmail.com',
  'Arranque a produccion 2026-10-15: ajuste al conteo fisico',
  -- ═══ LA BANDERA, Y HAY QUE ENTENDERLA ANTES DE PONERLA EN `true` ═══
  --
  -- `false` (como esta): solo se ajusta lo que aparezca en el bloque (2). Lo que no se liste se queda como
  -- esta. Es lo seguro, y es lo correcto si el conteo es parcial.
  --
  -- `true`: TODO lo que el sistema cuenta y NO este en el bloque (2) se lleva a CERO. Es lo que hace cierta
  -- la frase "la bodega inicia con todas las unidades y nadie mas tiene nada", pero con una consecuencia que
  -- no se puede deshacer: una linea OLVIDADA en el bloque (2) se interpreta como "ahi no hay nada" y su
  -- saldo se borra. Ponerla en `true` es afirmar que el conteo esta COMPLETO.
  false
);

do $$
declare v_id uuid;
begin
  select p.id into v_id from profiles p join _ajuste a on true where lower(p.email) = lower(a.correo);
  if v_id is null then
    raise exception 'No hay ningun perfil con ese correo. Revisa el parametro `correo` del bloque (0).';
  end if;
end $$;

-- ── (1) EL SALDO DE HOY: DE AQUI SE COPIAN LOS NOMBRES ───────────────────────────────────────────
--
-- Trae tambien las lineas en cero, porque a la bodega hay que PONERLE unidades que hoy no tiene y hace falta
-- saber que lote existe. Un lote que no aparezca aqui hay que crearlo primero desde la pantalla de recepcion:
-- este script no inventa lotes, porque un lote lleva fecha de vencimiento y esa es informacion del empaque.
select 'SALDO DE HOY' as que,
       l.kind                    as tipo_de_ubicacion,
       l.name                    as ubicacion,
       n.name                    as producto,
       lt.code                   as lote,
       lt.expires_on             as vence,
       coalesce(i.stock_quantity, 0) as sistema
  from inventory_locations l
  cross join lots lt
  join nutraceuticals lt_n on lt_n.id = lt.nutraceutical_id
  join nutraceuticals n on n.id = lt.nutraceutical_id
  left join nutraceutical_inventory i
         on i.location_id = l.id and i.nutraceutical_id = lt.nutraceutical_id and i.lot_id = lt.id
 where l.is_active
   and l.kind <> 'cuarentena'
   and coalesce(n.is_test, false) = false
   and (coalesce(i.stock_quantity, 0) <> 0 or l.kind = 'central')
 order by l.kind, l.name, n.name, lt.code;

-- ── (2) LO CONTADO ───────────────────────────────────────────────────────────────────────────────
--
-- PARA_REVISAR: esto es lo unico que hay que escribir. Una fila por (ubicacion, producto, lote), con las
-- unidades CONTADAS. Los nombres se copian TAL CUAL de la salida del bloque (1).
--
-- EJEMPLO (borrar y poner las de verdad):
--
--   insert into _conteo values
--     ('Bodega central CNV', 'LUVIA',        'L-2026-03', 40),
--     ('Bodega central CNV', 'ADAPTO-STRESS','A-2026-01', 25),
--     ('Vitrina Katherine',  'LUVIA',        'L-2026-03',  0);
create temporary table _conteo(ubicacion text, producto text, lote text, contado integer) on commit drop;

insert into _conteo values
  -- ⚠ VACIO A PROPOSITO: asi, corrido tal cual, este script no cambia nada y solo informa. Un script de
  -- inventario que trae cifras de ejemplo activas es como se ajusta un saldo con un numero inventado.
  (null, null, null, null);
delete from _conteo where ubicacion is null;

-- ── (3) LAS DIFERENCIAS, RESUELTAS CONTRA LOS NOMBRES ────────────────────────────────────────────
--
-- SE RESUELVE EN UNA TABLA INTERMEDIA y no en el `insert` final, para poder MOSTRAR lo que va a pasar antes
-- de que pase. Un script que escribe y luego cuenta lo que escribio ya no deja decidir.
create temporary table _plan on commit drop as
with contado as (
  select c.contado,
         (select l.id from inventory_locations l where l.name = c.ubicacion and l.is_active) as location_id,
         (select n.id from nutraceuticals n where n.name = c.producto) as nutraceutical_id,
         (select lt.id from lots lt join nutraceuticals n on n.id = lt.nutraceutical_id
           where lt.code = c.lote and n.name = c.producto) as lot_id,
         c.ubicacion, c.producto, c.lote
    from _conteo c
),
-- LO QUE EL SISTEMA CUENTA HOY, incluida la ubicacion de un Integrante que ya no sigue.
sistema as (
  select i.location_id, i.nutraceutical_id, i.lot_id, i.stock_quantity,
         l.name as ubicacion, n.name as producto, lt.code as lote
    from nutraceutical_inventory i
    join inventory_locations l on l.id = i.location_id
    join nutraceuticals n on n.id = i.nutraceutical_id
    join lots lt on lt.id = i.lot_id
   where i.stock_quantity <> 0
     and l.kind <> 'cuarentena'
     and coalesce(n.is_test, false) = false
)
select coalesce(c.location_id, s.location_id)             as location_id,
       coalesce(c.nutraceutical_id, s.nutraceutical_id)   as nutraceutical_id,
       coalesce(c.lot_id, s.lot_id)                       as lot_id,
       coalesce(c.ubicacion, s.ubicacion)                 as ubicacion,
       coalesce(c.producto, s.producto)                   as producto,
       coalesce(c.lote, s.lote)                           as lote,
       coalesce(s.stock_quantity, 0)                      as sistema,
       -- UNA LINEA NO LISTADA vale CERO solo si la bandera lo dice; si no, se deja como esta (sistema).
       case when c.contado is not null then c.contado
            when (select llevar_a_cero_lo_no_listado from _ajuste) then 0
            else coalesce(s.stock_quantity, 0) end        as contado,
       c.contado is null                                  as no_listada
  from contado c
  full outer join sistema s
    on s.location_id = c.location_id and s.nutraceutical_id = c.nutraceutical_id and s.lot_id = c.lot_id;

-- ── (3b) LO QUE NO SE PUDO RESOLVER: se para, no se adivina ──────────────────────────────────────
--
-- UN NOMBRE MAL COPIADO NO PUEDE PASAR EN SILENCIO. Si se dejara pasar, su linea simplemente no se
-- ajustaria, y el que corre el script creeria que si: el peor desenlace de los tres (peor que fallar).
do $$
declare v_malas int;
begin
  select count(*) into v_malas from _plan
   where location_id is null or nutraceutical_id is null or lot_id is null;
  if v_malas > 0 then
    raise exception 'Hay % linea(s) del bloque (2) cuyo nombre de ubicacion, producto o lote no existe. Copialos tal cual de la salida del bloque (1).', v_malas;
  end if;
end $$;

-- ── (4) LO QUE VA A PASAR: LEER ESTO ANTES DE CAMBIAR rollback POR commit ───────────────────────
select 'LO QUE VA A PASAR' as que,
       p.ubicacion, p.producto, p.lote,
       p.sistema, p.contado, (p.contado - p.sistema) as ajuste,
       case when p.contado = p.sistema then 'sin cambio'
            when p.no_listada           then 'NO LISTADA: se lleva a cero por la bandera'
            when p.contado > p.sistema  then 'sobra en el sistema menos de lo contado: sube'
            else 'el sistema contaba mas de lo que hay: baja' end as lectura
  from _plan p
 order by (p.contado - p.sistema) = 0, p.ubicacion, p.producto, p.lote;

-- ── (5) EL AJUSTE: UN MOVIMIENTO POR DIFERENCIA ─────────────────────────────────────────────────
--
-- `conciliacion` es el tipo que ya usa el ajuste por conteo fisico, asi que esto no inventa un camino: usa
-- el que existe, y el saldo lo recalcula el mismo trigger que recalcula cualquier otro movimiento.
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
       (select motivo from _ajuste) || ' (sistema ' || p.sistema || ' -> contado ' || p.contado || ')',
       (select pr.id from profiles pr join _ajuste a on true where lower(pr.email) = lower(a.correo))
  from _plan p
  join inventory_locations l on l.id = p.location_id
 where p.contado <> p.sistema;

-- ── (6) COMO QUEDO ──────────────────────────────────────────────────────────────────────────────
select 'COMO QUEDO' as que,
       l.name as ubicacion, n.name as producto, lt.code as lote, i.stock_quantity as sistema
  from nutraceutical_inventory i
  join inventory_locations l on l.id = i.location_id
  join nutraceuticals n on n.id = i.nutraceutical_id
  join lots lt on lt.id = i.lot_id
 where i.stock_quantity <> 0
   and coalesce(n.is_test, false) = false
 order by l.kind, l.name, n.name, lt.code;

-- ⚠ POR DEFECTO NO GUARDA. Revisar el cuadro (4) y cambiar esta linea por `commit;` para aplicarlo.
rollback;
-- commit;
