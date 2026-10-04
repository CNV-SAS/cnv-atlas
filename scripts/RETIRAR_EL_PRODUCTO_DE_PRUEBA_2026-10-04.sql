-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- RETIRAR "PRUEBA SMOKE BLOQUE 3" DE LO QUE SE PUEDE VENDER  ·  2026-10-04
--
-- EL HALLAZGO (Santiago, smoke del 2026-10-04): ese producto sigue ofreciendose en /pagos para armar un
-- checkout o una venta en efectivo, y Profesional Prueba NO esta marcado como de prueba. O sea que cualquier
-- Integrante REAL puede venderle a un paciente un producto que no existe.
--
-- ── POR QUE NO ES UN DEFECTO DEL CODIGO, Y SI UN DATO QUE SE QUEDO VIEJO ──
--
-- Que un producto de prueba `en_consultorio` se pueda vender fue una DECISION del 2026-10-02 (Santiago eligio
-- la opcion (a): dejar el producto del smoke usable), y el candado `catalogo-prescribible-db` la fija.
--
-- LO QUE CAMBIO ES LA RAZON DE ESA EXCEPCION: el smoke ahora corre con ADAPTO-STRESS, que es un producto REAL,
-- y con un profesional que tampoco esta marcado. Asi que la excepcion ya no compra nada y solo deja la puerta
-- abierta.
--
-- ── POR QUE ASI Y NO CON UN FILTRO NUEVO EN EL CODIGO ──
--
-- Porque el mecanismo YA EXISTE y ya esta probado: el catalogo prescribible oculta los `no_disponible`, sean
-- de prueba o no (el mismo candado lo comprueba con un producto de prueba retirado). Marcar este producto como
-- retirado usa la puerta que ya hay, no inventa una segunda regla que manana contradiga a la primera, y se
-- deshace cambiando un valor.
--
-- SI SE QUIERE LA REGLA FUERTE ("ningun producto de prueba se vende, nunca"), eso REVIERTE la decision del
-- 2026-10-02 y hay que decirlo: cambia el candado y deja al smoke sin producto propio.
--
-- LO QUE NO HACE: no toca el saldo de nadie. Un `no_disponible` con unidades SIGUE viendose en el inventario
-- de quien las tenga (la regla es "con saldo siempre"), para que su conteo fisico no se contradiga. Lo que
-- deja de poder es VENDERSE, que es justo lo que se busca. Si esas unidades sobran, se dan de BAJA, no se
-- venden.
--
-- COMO SE CORRE:
--   node scripts/aplicar-migracion.mjs scripts/RETIRAR_EL_PRODUCTO_DE_PRUEBA_2026-10-04.sql
--   ... leer los NOTICE, y lo mismo con --commit.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

do $$
declare
  v record;
  v_unidades int;
  v_ventas int;
begin
  select id, name, commercial_availability, is_test
    into v
    from nutraceuticals
   where name ilike 'PRUEBA SMOKE BLOQUE 3%' and coalesce(is_test, false)
   limit 1;

  if not found then
    raise exception 'No encontre un producto de prueba llamado "PRUEBA SMOKE BLOQUE 3". Revisa el nombre.';
  end if;

  if v.commercial_availability = 'no_disponible' then
    raise notice 'Ya estaba retirado (%). No hay nada que hacer.', v.commercial_availability;
    return;
  end if;

  select coalesce(sum(stock_quantity), 0) into v_unidades
    from nutraceutical_inventory where nutraceutical_id = v.id;
  select count(*) into v_ventas
    from transaction_items where nutraceutical_id = v.id;

  raise notice 'Producto: % (hoy "%")', v.name, v.commercial_availability;
  raise notice 'Unidades que alguien todavia tiene: %. Siguen viendose en su inventario; lo que deja de poder es venderse.', v_unidades;
  raise notice 'Lineas de venta historicas: %. No se tocan: son el registro de lo que paso.', v_ventas;
end $$;

update nutraceuticals
   set commercial_availability = 'no_disponible'
 where name ilike 'PRUEBA SMOKE BLOQUE 3%'
   and coalesce(is_test, false)
   and commercial_availability <> 'no_disponible';

do $$
declare v record;
begin
  select name, commercial_availability into v
    from nutraceuticals where name ilike 'PRUEBA SMOKE BLOQUE 3%' and coalesce(is_test, false) limit 1;
  if v.commercial_availability <> 'no_disponible' then
    raise exception 'ABORTA: el producto sigue en "%"', v.commercial_availability;
  end if;
  raise notice 'LISTO: "%" queda retirado. Deja de ofrecerse para checkout, venta en efectivo y prescripcion.', v.name;
end $$;
