-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- FIJAR LA FECHA DE ARRANQUE  ·  se corre UNA vez, EL DIA de las llaves reales
--
-- Requiere la migracion 0198 aplicada.
--
-- QUE HACE: a partir de ese dia, las cifras de resumen de Direccion, de Inicio y de los insights cuentan
-- SOLO la operacion real. Lo de antes (los smokes, Profesional Demo, Maria Camila, las pruebas) deja de
-- sumar en esas tarjetas.
--
-- QUE NO HACE, y conviene tenerlo claro antes de correrlo:
--
--   · NO BORRA NADA. El historial queda entero y auditable. Si la fecha se pone mal, se corrige con este
--     mismo script y las cifras vuelven: no hay nada que recuperar.
--   · NO TOCA LO QUE SE LE DEBE A NADIE. Una comision anterior al arranque se sigue liquidando y se sigue
--     viendo en la cuenta del Integrante. La tarjeta de "comisiones" de Direccion lo dice en pantalla,
--     porque las dos cifras van a discrepar A PROPOSITO.
--   · NO TOCA EL INVENTARIO. Un saldo no es un flujo: las unidades que hay estan hoy en la bodega. La
--     tarjeta tambien lo dice.
--   · NO ALCANZA A PROFESIONAL DEMO despues de esa fecha. Para eso hace falta la segunda pieza
--     (`professional_profiles.is_test` con su barrido), que va aparte y con calma.
--
-- PONERLA ANTES DE TIEMPO ESCONDE OPERACION DE VERDAD. Se pone el dia, no antes.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. VER QUE HAY HOY (deberia salir NULL antes de fijarla).
SELECT fecha_de_arranque FROM commercial_config;

-- 2. FIJARLA. Cambiar la fecha por la del dia real antes de correr.
UPDATE commercial_config
   SET fecha_de_arranque = DATE '2026-10-01',
       updated_at = now();

-- 3. COMPROBAR. Las dos cifras de abajo son lo que las tarjetas van a dejar de contar y lo que van a
--    contar. Si la primera es cero, la fecha esta puesta mas atras de lo que se queria.
SELECT
  count(*) FILTER (
    WHERE (coalesce(operated_at, created_at) AT TIME ZONE 'America/Bogota')::date
          <  (SELECT fecha_de_arranque FROM commercial_config)
  ) AS ventas_que_salen_de_las_cifras,
  count(*) FILTER (
    WHERE (coalesce(operated_at, created_at) AT TIME ZONE 'America/Bogota')::date
          >= (SELECT fecha_de_arranque FROM commercial_config)
  ) AS ventas_que_quedan
FROM transactions
WHERE status = 'paid';

-- PARA DESHACERLO: UPDATE commercial_config SET fecha_de_arranque = NULL;
