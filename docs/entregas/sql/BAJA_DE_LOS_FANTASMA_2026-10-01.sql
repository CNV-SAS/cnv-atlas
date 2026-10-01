-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- DAR DE BAJA EL SALDO DE LOS LOTES RETIRADOS DE PROFESIONAL DEMO  ·  se corre una vez
--
-- QUE RESUELVE: su vitrina muestra siete filas de "PRUEBA SMOKE BLOQUE 3 (retirado ...)" con 3 unidades
-- cada una, 21 en total. Son de un producto RETIRADO: retirar un producto no mueve inventario (y no deberia:
-- los movimientos son el registro de custodia), asi que el saldo se queda. La vitrina dice que hay algo que
-- no hay.
--
-- NO SE BORRA NADA, SE DA DE BAJA. Es la operacion que ya existe para esto: un movimiento negativo con su
-- motivo y su responsable, que deja el saldo en cero y la historia completa. Borrar el movimiento seria
-- imposible (trigger de append-only) y ademas romperia el rastro.
--
-- ANTES DE CORRER: cambiar el correo si el profesional es otro, y revisar la lista del paso 1.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. VER QUE SE VA A DAR DE BAJA. Solo producto de prueba y solo lo que tiene saldo.
SELECT n.name AS producto, n.is_test, l.code AS lote, loc.name AS ubicacion, i.stock_quantity AS saldo
  FROM nutraceutical_inventory i
  JOIN nutraceuticals n ON n.id = i.nutraceutical_id
  JOIN lots l ON l.id = i.lot_id
  JOIN inventory_locations loc ON loc.id = i.location_id
  JOIN professional_profiles pp ON pp.id = i.professional_id
  JOIN profiles p ON p.id = pp.profile_id
 WHERE p.email = 'profesional.demo@cnvsystem.com'
   AND i.stock_quantity > 0
   AND coalesce(n.is_test, false) = true
 ORDER BY n.name, l.code;

-- 2. LA BAJA. Un movimiento negativo por cada fila con saldo, con su motivo y con quien la hace.
--    `created_by` tiene que ser el perfil de quien decide (admin), no el del integrante: la baja es una
--    decision de CNV sobre producto en custodia.
INSERT INTO nutraceutical_stock_movements
  (professional_id, nutraceutical_id, location_id, lot_id, delta, type, reason, created_by)
SELECT i.professional_id, i.nutraceutical_id, i.location_id, i.lot_id, -i.stock_quantity, 'baja',
       'Baja del saldo de un producto de prueba retirado: la vitrina contaba unidades que no existen (2026-10-01)',
       (SELECT id FROM profiles WHERE email = 'hola@cnvsystem.com')
  FROM nutraceutical_inventory i
  JOIN nutraceuticals n ON n.id = i.nutraceutical_id
  JOIN professional_profiles pp ON pp.id = i.professional_id
  JOIN profiles p ON p.id = pp.profile_id
 WHERE p.email = 'profesional.demo@cnvsystem.com'
   AND i.stock_quantity > 0
   AND coalesce(n.is_test, false) = true;

-- 3. COMPROBAR: el paso 1 tiene que devolver cero filas.
