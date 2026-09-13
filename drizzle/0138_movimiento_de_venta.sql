-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL MOVIMIENTO DE VENTA  ·  Bloque 3, sesion 1  ·  2026-09-13
--
-- Decision 1 del plan de inventario y ventas: LA VENTA DESCUENTA INVENTARIO, y la entrega deja de ser un
-- movimiento independiente. Hasta hoy el unico movimiento de salida hacia un paciente era `despacho`, que no
-- sabe de la venta. `venta` es la salida ligada a una LINEA de venta.
--
-- `despacho` NO SE BORRA NI SE RENOMBRA: hay movimientos historicos de ese tipo (inmutables por trigger), y
-- su CHECK de 0118 sigue siendo cierto para ellos.
--
-- VA SOLA A PROPOSITO: un valor nuevo de enum no se puede usar en la misma transaccion que lo crea (55P04,
-- ya visto en la 0133). La 0139 no lo nombra como enum por la misma razon, porque drizzle aplica juntas
-- las migraciones pendientes.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TYPE "public"."nutraceutical_movement_type" ADD VALUE IF NOT EXISTS 'venta';
