-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ⛔ NO SE CORRIO EL 2026-10-15, Y NO SE DEBE CORRER HOY. LA PRIMERA TANDA YA ESTABA CARGADA.
--
-- Al mirar el saldo de la nube ANTES de correrlo, la primera tanda ya estaba en la central desde el
-- 2026-09-11 (movimiento `recepcion`, texto *"Carga inicial: saldo en bodega central tras la primera entrega
-- a Integrantes"*), con ESTOS MISMOS lotes y vencimientos, y cuadrando unidad por unidad con lo declarado:
-- 500 MULTI-CELL, 500 OMEGA, 426 CURCUMIN, 300 D3-K2 y 84 LUVIA, repartidas entre la central y siete vitrinas.
--
-- Correrlo habria dejado 3.632 unidades donde hay 1.822.
--
-- ESTE SCRIPT SIRVE PARA EL SEGUNDO ENVIO DEL LABORATORIO: se editan las lineas del bloque (1) con los lotes
-- nuevos y se corre. El bloque (2b) aborta solo si algun lote de la tanda ya tiene saldo en la central.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CARGAR LA BODEGA CENTRAL CON LA PRIMERA TANDA DEL LABORATORIO  ·  2026-10-15
--
-- ═══ DE DONDE SALE ═══
--
-- Santiago no puede contar fisicamente hoy, y su plan es otro: *"iniciar con todo en 0 y que admin vaya
-- poniendo X nutraceuticos a tal profesional... ya luego voy a la oficina, cuento y comparo."* Para eso la
-- bodega tiene que ARRANCAR CON ALGO, y lo que hay es la primera tanda que entrego el laboratorio.
--
-- ═══ POR QUE ES UN SCRIPT APARTE Y NO EL BLOQUE (2) DE LA CONCILIACION ═══
--
-- Porque la conciliacion ajusta contra un CONTEO y dice, con razon, que NO INVENTA LOTES: un lote lleva
-- fecha de vencimiento y esa es informacion del empaque, que ella no tiene. Aqui SI la tenemos, asi que esto
-- es otra cosa: una RECEPCION declarada, con su lote y su vencimiento reales.
--
-- Y la diferencia importa para el historial: un movimiento `conciliacion` dice *"el sistema estaba
-- descuadrado y lo cuadre"*; un `recepcion` dice *"entraron estas unidades"*. Lo segundo es lo que paso.
--
-- ═══ EL ORDEN, Y NO ES INDIFERENTE ═══
--
--   1. PRIMERO la conciliacion con la bandera en `true` y el bloque (2) VACIO: deja todo en cero.
--   2. DESPUES este script: carga la bodega.
--
-- Al reves, la conciliacion llevaria a cero lo que este script acaba de cargar.
--
-- ⚠ Y CAMBIA EL MOTIVO DE LA CONCILIACION antes de correrla asi: el que trae dice "ajuste al conteo fisico"
--   y no hubo conteo. Que diga que el inventario se declara en cero y se vuelve a cargar.
--
-- COMO SE CORRE (nunca en el editor SQL de Supabase, que no sostiene la transaccion):
--   node --env-file=.env.local scripts/aplicar-migracion.mjs scripts/CARGAR_LA_BODEGA_AL_ARRANQUE_2026-10-15.sql
--   ... y lo mismo con --commit al final cuando el ensayo diga "SIN ERRORES" y el cuadro cuadre.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── (0) PARAMETROS ───────────────────────────────────────────────────────────────────────────────
-- PARA_REVISAR: el correo del actor. Queda como autor de cada movimiento.
create temporary table _carga(correo text) on commit drop;
insert into _carga values ('gilurgi69@gmail.com');

do $$
declare v_id uuid;
begin
  select p.id into v_id from profiles p join _carga c on true where lower(p.email) = lower(c.correo);
  if v_id is null then
    raise exception 'No hay ningun perfil con ese correo. Revisa el parametro del bloque (0).';
  end if;
end $$;

-- ── (1) LA PRIMERA TANDA, TAL COMO LA ENTREGO EL LABORATORIO ─────────────────────────────────────
--
-- LOS NOMBRES SON LOS DE ATLAS, exactos. Los codigos NUT-00X son los de ALEGRA y NO se usan aqui: el
-- inventario de Atlas no los conoce, y meterlos invitaria a confundirlos con el lote.
--
-- `recibido_el` es la fecha REAL de entrega y viaja en el texto del movimiento, NO en `created_at`: esa
-- columna dice cuando se ESCRIBIO la fila, y backdatearla en un libro append-only seria afirmar que el
-- registro existe desde agosto. Las dos verdades caben: la fila se escribe hoy, la mercancia llego ese dia.
create temporary table _tanda(
  producto    text,
  lote        text,
  vence       date,
  unidades    integer,
  recibido_el text
) on commit drop;

insert into _tanda (producto, lote, vence, unidades, recibido_el) values
  ('MULTI-CELL BASE',   '19826',    '2028-07-18', 500, 'primera tanda del laboratorio'),
  ('OMEGA COMPLEX',     '20226',    '2028-07-22', 500, 'primera tanda del laboratorio'),
  ('CURCUMIN BIOACTIV', '20526',    '2028-07-25', 426, 'primera tanda del laboratorio'),
  ('D3-K2 OSTEO',       '19726',    '2028-07-17', 300, 'primera tanda del laboratorio'),
  -- ═══ LUVIA VA EN DOS LINEAS, Y ES A PROPOSITO ═══
  --
  -- Llegaron 60 el 2026-08-26 y 24 el 2026-08-27, mismo lote. Dos entregas son dos hechos: una sola linea
  -- de 84 cuadra el total y pierde la unica informacion que hay sobre como llego.
  --
  -- Y LUVIA ES DE TERCERO (`ownership = 'tercero'`, con su titular de marca ya cargado): el modelo SI lo
  -- distingue. No es inventario propio de CNV, y de ahi cuelgan el centro de costo de su factura y la linea
  -- del titular de marca que el paciente ve. Lo que NO cambia es el inventario: las unidades estan en la
  -- bodega de CNV igual, y hay que saber cuantas son.
  ('LUVIA',             '04197232', '2028-07-10',  60, 'consignacion de tercero, recibido el 2026-08-26'),
  ('LUVIA',             '04197232', '2028-07-10',  24, 'consignacion de tercero, recibido el 2026-08-27');

-- ── (2) QUE TODO RESUELVA, Y SI NO, ABORTAR ──────────────────────────────────────────────────────
--
-- Un nombre mal copiado no puede pasar en silencio: el producto quedaria sin cargar y la bodega arrancaria
-- corta sin que nadie lo note.
do $$
declare v text; n int;
begin
  for v in select distinct producto from _tanda loop
    select count(*) into n from nutraceuticals where name = v and not is_test;
    if n <> 1 then
      raise exception 'ABORTADO: "%" corresponde a % productos de Atlas, y tiene que ser exactamente 1.', v, n;
    end if;
  end loop;

  if exists (select 1 from _tanda where unidades <= 0) then
    raise exception 'ABORTADO: hay una linea con cero o menos unidades.';
  end if;

  -- ═══ UNA SOLA BODEGA CENTRAL, Y SE COMPRUEBA ═══
  --
  -- El codigo de la aplicacion resuelve la central con `limit 1` porque da por hecho que hay una sola. En la
  -- base LOCAL hay decenas (las crean los fixtures de los tests), y con `limit 1` este script cargaria 1.810
  -- unidades en una bodega CUALQUIERA, sin error y sin aviso. Eso en produccion seria una carga invisible en
  -- el sitio equivocado, que es peor que no cargar nada.
  select count(*) into n from inventory_locations where kind = 'central' and is_active;
  if n = 0 then
    raise exception 'ABORTADO: no hay bodega central activa.';
  elsif n > 1 then
    raise exception 'ABORTADO: hay % bodegas centrales activas y este script no puede elegir. Resuelvelo antes.', n;
  end if;
end $$;

-- ── (2b) EL GUARD QUE FALTABA: ESTA TANDA YA PUEDE ESTAR CARGADA ─────────────────────────────────
--
-- ═══ POR QUE SE AGREGO, Y COSTO CARO NO TENERLO (2026-10-15) ═══
--
-- Este script se escribio el 14 dando por hecho que la central estaba vacia, y se ensayo con exito. Al mirar
-- el saldo de la nube el 15, ANTES de correrlo, la primera tanda ya estaba cargada desde el 2026-09-11 (con
-- estos mismos lotes y vencimientos) y cuadraba unidad por unidad con lo declarado. Correrlo habria dejado
-- 3.632 unidades donde hay 1.822, y nadie podria decir cual mitad es inventada.
--
-- LO QUE HAY QUE ENTENDER: el script no podia saberlo solo mirando su propia logica. Cargar una recepcion es
-- una operacion legitima, y un SEGUNDO envio del laboratorio se ve exactamente igual que una doble carga.
-- La diferencia no esta en la forma del movimiento, esta en el LOTE: un envio nuevo trae lotes nuevos.
--
-- ASI QUE EL GUARD MIRA EL LOTE, no el producto ni el total: si alguna linea de la tanda nombra un lote que
-- YA tiene saldo en la central, esta tanda ya entro y el script aborta. Para el segundo envio, los lotes seran
-- otros y el guard deja pasar sin tocar nada.
--
-- Y SI DE VERDAD HICIERA FALTA REPETIR UN LOTE que ya tiene saldo (un envio del mismo lote, que el laboratorio
-- puede mandar), se quita este bloque A MANO en una copia del script, mirando el saldo primero. Que cueste un
-- gesto deliberado es el punto: lo que no puede pasar es que ocurra sin que nadie lo decida.
do $$
declare r record; n int := 0;
begin
  for r in
    select t.producto, t.lote, sum(i.stock_quantity)::int as saldo
      from _tanda t
      join nutraceuticals nu on lower(btrim(nu.name)) = lower(btrim(t.producto))
      join lots l on l.nutraceutical_id = nu.id and btrim(l.code) = btrim(t.lote)
      join nutraceutical_inventory i on i.lot_id = l.id and i.nutraceutical_id = nu.id
      join inventory_locations lo on lo.id = i.location_id and lo.kind = 'central' and lo.is_active
     group by t.producto, t.lote
    having sum(i.stock_quantity) > 0
  loop
    n := n + 1;
    raise notice 'YA CARGADO: % lote % tiene % unidades en la central.', r.producto, r.lote, r.saldo;
  end loop;
  if n > 0 then
    raise exception 'ABORTADO: % de las lineas de esta tanda ya tienen saldo en la central con ESE MISMO LOTE. Esta tanda ya entro; correrlo duplicaria el inventario. Mira los NOTICE de arriba.', n;
  end if;
  raise notice 'GUARD (2b): ninguno de los lotes de esta tanda tiene saldo en la central. Se puede cargar.';
end $$;

-- ── (3) LOS LOTES: SE CREAN CON SU VENCIMIENTO REAL ──────────────────────────────────────────────
--
-- Y SI YA EXISTEN, SE CORRIGE EL VENCIMIENTO SOLO CUANDO ERA PROVISIONAL. `resolverLoteDeRecepcion` crea
-- lotes con un vencimiento inventado (hoy + un año) cuando un Integrante declara un codigo que no existia, y
-- los marca PROVISIONAL justo para poder completarlos despues. Este es ese despues.
--
-- SI EXISTE CON OTRA FECHA Y NO ERA PROVISIONAL, SE ABORTA: dos fechas de vencimiento del mismo lote es una
-- contradiccion que decide alguien, no un script. Pisarla en silencio podria mover la alerta de vencimiento
-- de un producto que la gente se toma.
do $$
declare r record;
begin
  for r in
    select distinct t.producto, t.lote, t.vence, n.id as nutra_id
      from _tanda t join nutraceuticals n on n.name = t.producto and not n.is_test
  loop
    if not exists (select 1 from lots where nutraceutical_id = r.nutra_id and code = r.lote) then
      insert into lots (nutraceutical_id, code, expires_on, notes)
      values (r.nutra_id, r.lote, r.vence,
              'Primera tanda del laboratorio, cargada al arranque del 2026-10-15. Vencimiento tomado del empaque.');
      raise notice 'lote CREADO: % / % vence %', r.producto, r.lote, r.vence;
    else
      declare v_vence date; v_notes text; begin
        select expires_on, notes into v_vence, v_notes
          from lots where nutraceutical_id = r.nutra_id and code = r.lote;
        if v_vence = r.vence then
          raise notice 'lote ya existia y cuadra: % / %', r.producto, r.lote;
        elsif coalesce(v_notes, '') like '%PROVISIONAL%' then
          update lots set expires_on = r.vence,
                 notes = 'Vencimiento confirmado contra el empaque en la carga del arranque 2026-10-15 (antes era provisional).'
           where nutraceutical_id = r.nutra_id and code = r.lote;
          raise notice 'lote COMPLETADO: % / % de % a %', r.producto, r.lote, v_vence, r.vence;
        else
          raise exception 'ABORTADO: el lote % de % ya existe con vencimiento % y la tanda dice %. Decidelo a mano.',
            r.lote, r.producto, v_vence, r.vence;
        end if;
      end;
    end if;
  end loop;
end $$;

-- ── (4) LO QUE VA A PASAR ────────────────────────────────────────────────────────────────────────
do $$
declare r record; v_total int := 0;
begin
  raise notice '--- LO QUE VA A ENTRAR A LA BODEGA CENTRAL ---';
  for r in
    select t.producto, t.lote, t.unidades, t.recibido_el,
           coalesce((select i.stock_quantity
                       from nutraceutical_inventory i
                       join inventory_locations l on l.id = i.location_id and l.kind = 'central'
                       join lots lt on lt.id = i.lot_id and lt.code = t.lote
                       join nutraceuticals n2 on n2.id = i.nutraceutical_id and n2.name = t.producto
                      limit 1), 0) as saldo_antes
      from _tanda t order by t.producto, t.recibido_el
  loop
    raise notice '% / lote % : +% (%) [saldo antes en central: %]',
      r.producto, r.lote, r.unidades, r.recibido_el, r.saldo_antes;
    v_total := v_total + r.unidades;
  end loop;
  raise notice 'TOTAL A CARGAR: % unidades en % lineas', v_total, (select count(*) from _tanda);
end $$;

-- ── (5) LOS MOVIMIENTOS ──────────────────────────────────────────────────────────────────────────
--
-- `recepcion` y no `conciliacion`: entraron unidades, no se cuadro un descuadre.
--
-- `professional_id` NULO porque la bodega central NO TIENE DUEÑO (igual que la devolucion que entra a
-- central y que la reincorporacion). Y eso ademas la mantiene fuera de la bandeja de "recepciones no
-- respaldadas" de /faltantes, que solo mira las que tienen Integrante: una recepcion sin remesa en la
-- bodega de CNV no es una discrepancia, es como entra la mercancia.
insert into nutraceutical_stock_movements
    (professional_id, nutraceutical_id, location_id, lot_id, type, delta, reason, created_by)
select null,
       n.id,
       (select id from inventory_locations where kind = 'central' and is_active limit 1),
       lt.id,
       'recepcion',
       t.unidades,
       'Carga inicial de la bodega central al arranque (2026-10-15): ' || t.recibido_el,
       (select p.id from profiles p join _carga c on true where lower(p.email) = lower(c.correo))
  from _tanda t
  join nutraceuticals n on n.name = t.producto and not n.is_test
  join lots lt on lt.nutraceutical_id = n.id and lt.code = t.lote;

-- ── (6) EL RESULTADO ─────────────────────────────────────────────────────────────────────────────
do $$
declare r record;
begin
  raise notice '--- SALDO DE LA BODEGA CENTRAL DESPUES ---';
  for r in
    select n.name as producto, lt.code as lote, lt.expires_on as vence, i.stock_quantity as saldo
      from nutraceutical_inventory i
      join inventory_locations l on l.id = i.location_id
      join nutraceuticals n on n.id = i.nutraceutical_id
      join lots lt on lt.id = i.lot_id
     -- SIN LOS PRODUCTOS DE PRUEBA, y la razon es que el cuadro se pueda REVISAR: la base local tiene
     -- cientos de productos de prueba con saldo en la central (los crean los fixtures), y entre ellos no se
     -- ve la tanda real. El mismo criterio que usa el bloque (1) de la conciliacion.
     where l.kind = 'central' and l.is_active and not n.is_test and i.stock_quantity <> 0
     order by n.name, lt.code
  loop
    raise notice '% / lote % (vence %): %', r.producto, r.lote, r.vence, r.saldo;
  end loop;
end $$;

rollback;
-- commit;
