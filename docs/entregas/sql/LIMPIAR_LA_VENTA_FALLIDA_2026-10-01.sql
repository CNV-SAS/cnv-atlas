-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- QUITAR UN LINK DE PAGO QUE NUNCA COBRO NADA  ·  el caso de Maria Camila
--
-- QUE RESUELVE: en su perfil aparece "Fallida · Pasarela · OMEGA COMPLEX x1 · 124.260", de una prueba suya.
-- Es un intento de cobro que no llego a cobrar: no movio dinero, no movio inventario (su estado es
-- 'liberado': la reserva se solto) y no tiene factura.
--
-- ── LO QUE SE PUEDE Y LO QUE NO ──
--
-- SE PUEDE QUITAR esta: un link que nunca cobro no es un hecho contable, es un intento. No tiene filas de
-- ingreso, ni comision, ni movimientos de inventario, ni factura. Nada queda suelto al sacarla.
--
-- NO SE PUEDE QUITAR la otra ("Pagada · LUVIA x1 · 90.000", devuelta despues). ESA OCURRIO: hay una factura
-- emitida, hubo dinero, salio una unidad de su vitrina y volvio a cuarentena, y todo eso quedo en
-- movimientos que son append-only por trigger (el registro de custodia). Su dinero YA esta neutralizado: la
-- devolucion revirtio el ingreso y la comision, asi que no infla ninguna cifra. Lo unico que queda es la
-- linea en su lista, y esa es la verdad de lo que paso.
--
-- EL GUION COMPRUEBA ANTES DE BORRAR. Si la venta tuviera cualquier rastro (ingreso, comision, movimiento,
-- reversa o factura), el DELETE no la toca: la condicion lo impide. Asi no hay forma de usarlo sobre una
-- venta equivocada.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. VER los links fallidos de ese integrante, con la comprobacion de que no dejaron rastro.
SELECT t.id, t.created_at::date AS dia, t.amount, t.status, t.stock_state,
       t.alegra_invoice_number,
       (SELECT count(*) FROM professional_revenue WHERE transaction_id = t.id) AS filas_de_comision,
       (SELECT count(*) FROM cnv_revenue WHERE transaction_id = t.id) AS filas_de_ingreso,
       (SELECT count(*) FROM nutraceutical_stock_movements m
          JOIN transaction_items ti ON ti.id = m.transaction_item_id
         WHERE ti.transaction_id = t.id) AS movimientos,
       (SELECT count(*) FROM sale_reversals WHERE transaction_id = t.id) AS reversas
  FROM transactions t
  JOIN professional_profiles pp ON pp.id = t.professional_id
  JOIN profiles p ON p.id = pp.profile_id
 WHERE p.email = 'CAMBIAR@correo.com'
   AND t.status = 'failed'
 ORDER BY t.created_at DESC;

-- 2. BORRARLA. Solo si TODAS las cuentas de arriba estan en cero: la condicion lo verifica otra vez, asi que
--    si algo tiene rastro, esta sentencia no borra nada y no hay dano posible.
WITH limpias AS (
  SELECT t.id
    FROM transactions t
    JOIN professional_profiles pp ON pp.id = t.professional_id
    JOIN profiles p ON p.id = pp.profile_id
   WHERE p.email = 'CAMBIAR@correo.com'
     AND t.status = 'failed'
     AND t.alegra_invoice_number IS NULL
     AND NOT EXISTS (SELECT 1 FROM professional_revenue WHERE transaction_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM cnv_revenue WHERE transaction_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM sale_reversals WHERE transaction_id = t.id)
     AND NOT EXISTS (
       SELECT 1 FROM nutraceutical_stock_movements m
         JOIN transaction_items ti ON ti.id = m.transaction_item_id
        WHERE ti.transaction_id = t.id
     )
)
DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM limpias);

WITH limpias AS (
  SELECT t.id
    FROM transactions t
    JOIN professional_profiles pp ON pp.id = t.professional_id
    JOIN profiles p ON p.id = pp.profile_id
   WHERE p.email = 'CAMBIAR@correo.com'
     AND t.status = 'failed'
     AND t.alegra_invoice_number IS NULL
     AND NOT EXISTS (SELECT 1 FROM professional_revenue WHERE transaction_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM cnv_revenue WHERE transaction_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM sale_reversals WHERE transaction_id = t.id)
)
DELETE FROM transactions WHERE id IN (SELECT id FROM limpias);

-- 3. COMPROBAR: el paso 1 tiene que devolver cero filas.
--
-- Y SI DESPUES DE ESTO SIGUE APARECIENDO ALGO EN SU LISTA, es la venta pagada y devuelta. Esa se queda.
