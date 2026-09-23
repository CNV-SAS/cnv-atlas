-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LAS REGLAS DE LA DEVOLUCION FISICA  ·  Bloque 3b, sesion 2  ·  2026-09-22
--
-- VA EN SU PROPIA MIGRACION porque un valor de enum recien añadido NO se puede USAR en la misma transaccion
-- que lo creo (Postgres). La 0164 los añade; esta los usa.
--
-- Lo que la base garantiza, para que ninguna pantalla pueda saltarselo:
--   · una devolucion del paciente entra CON SU LINEA DE VENTA y SUMA (la unidad vuelve);
--   · una baja RESTA y lleva su motivo escrito (se da de baja contra gasto: sin motivo no es auditable);
--   · y la reincorporacion lleva SIEMPRE quien la hizo, porque es la decision humana que D-3b-3 exige.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "nutraceutical_stock_movements"
  DROP CONSTRAINT IF EXISTS "nutra_movement_devolucion_paciente_exige_linea";--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements"
  ADD CONSTRAINT "nutra_movement_devolucion_paciente_exige_linea"
  CHECK (
    "type"::text <> 'devolucion_paciente'
    OR ("transaction_item_id" IS NOT NULL AND "delta" > 0)
  );--> statement-breakpoint

ALTER TABLE "nutraceutical_stock_movements"
  DROP CONSTRAINT IF EXISTS "nutra_movement_baja_exige_motivo";--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements"
  ADD CONSTRAINT "nutra_movement_baja_exige_motivo"
  CHECK (
    "type"::text <> 'baja'
    OR ("reason" IS NOT NULL AND length(trim("reason")) >= 5 AND "delta" < 0)
  );--> statement-breakpoint

-- QUIEN VERIFICO: `created_by` es quien hizo el movimiento, y en la reincorporacion ese es el verificador.
-- Se exige que exista, que es lo que convierte la reincorporacion en una decision con responsable.
ALTER TABLE "nutraceutical_stock_movements"
  DROP CONSTRAINT IF EXISTS "nutra_movement_reincorporacion_exige_quien";--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements"
  ADD CONSTRAINT "nutra_movement_reincorporacion_exige_quien"
  CHECK ("type"::text <> 'reincorporacion' OR "created_by" IS NOT NULL);
