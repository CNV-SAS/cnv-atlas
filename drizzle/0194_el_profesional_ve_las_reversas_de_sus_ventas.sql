-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL PROFESIONAL VE LAS REVERSAS DE SUS PROPIAS VENTAS  ·  2026-09-29
--
-- LO ENCONTRO SANTIAGO EN EL SMOKE, y es el defecto mas instructivo del dia:
--
--   Admin: 3.375.900 -> 3.238.300 (bajo 137.600, las devoluciones)
--   Profesional Demo: 3.285.900 -> 3.285.900 (no bajo nada)
--
-- Y QUEDO CON MENOS VENTAS EL ADMIN QUE EL PROFESIONAL, cuando el admin ve todas.
--
-- ── POR QUE, Y POR QUE EL CANDADO NO LO ATRAPO ──
--
-- La tarjeta de Inicio es UN SOLO lector para los dos roles: el descuento de las devoluciones se escribio una
-- vez y los dos pasan por el. El candado comprobo justo eso (que las dos pantallas llamen a la misma cuenta)
-- y estaba en lo cierto.
--
-- LO QUE NO SE MIRO FUE LA CAPA DE DATOS. `sale_reversals` solo la podian leer admin, direccion y soporte
-- (0147), asi que para el profesional la consulta devolvia CERO FILAS: el mismo codigo, con datos distintos,
-- daba otra cifra. Verificar el camino del CODIGO no verifica el camino de los DATOS.
--
-- ── Y ES CORRECTO QUE LAS VEA ──
--
-- Es SU venta: ya ve su monto, su estado y su comision, y la reversa es lo que explica por que su comision
-- bajo. Ocultarsela no protege nada y le deja una cifra sin causa, que es peor. Solo las de sus ventas: las
-- de otros siguen siendo de CNV.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "sale_reversals_select" ON "sale_reversals";--> statement-breakpoint
CREATE POLICY "sale_reversals_select" ON "sale_reversals"
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte')
    OR EXISTS (
      SELECT 1 FROM public.transactions t
       WHERE t.id = "sale_reversals"."transaction_id"
         AND t.professional_id IS NOT NULL
         AND public.is_own_professional_profile(t.professional_id)
    )
  );
