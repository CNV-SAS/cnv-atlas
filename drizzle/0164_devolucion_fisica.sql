-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA DEVOLUCION FISICA  ·  Bloque 3b, sesion 2  ·  2026-09-22
--
-- LA DECISION DE CONTABILIDAD (D-3b-3, 2026-09-16), y su razon es SANITARIA antes que contable: el producto
-- es alimento registrado ante INVIMA, y una unidad que salio del control de CNV no tiene cadena de custodia.
--
--   1. Una unidad devuelta NO vuelve al lote vendible: entra a una ubicacion de "devueltas pendientes de
--      verificacion", que NO es vendible.
--   2. Alguien la inspecciona. Sellada, integra y sin vencer PUEDE reincorporarse al lote, CON REGISTRO DE
--      QUIEN VERIFICO. Abierta, dañada o con duda, se da de baja contra gasto.
--   3. La reincorporacion es una DECISION HUMANA REGISTRADA, nunca automatica.
--
-- Y EL TIPO DE MOVIMIENTO ES PROPIO: el `devolucion` que ya existe significa "el Integrante devuelve a CNV",
-- no "el paciente devuelve el producto". Reusarlo mezclaria dos hechos distintos en el mismo saldo.
--
-- VA EN CINCO MIGRACIONES, y no por gusto: `ALTER TYPE ... ADD VALUE` no corre dentro de una transaccion
-- (la 0086 ya lo dejo escrito), y un valor recien añadido tampoco se puede USAR en la misma. Asi que cada
-- valor va solo en su archivo, y las reglas que los usan van al final.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── LA UBICACION NO VENDIBLE ───────────────────────────────────────────────────────────────────────
--
-- `sellable` es del SITIO, no del producto: lo que decide si una unidad se puede vender es DONDE esta.
--
-- Y LA CUARENTENA ES SU PROPIA CLASE DE UBICACION, no una central mas: la base exige que haya UNA SOLA
-- central (`loc_una_central`), que es la bodega de CNV, y la cuarentena no es una bodega: es el sitio donde
-- espera lo que volvio hasta que alguien lo verifique. Sin dueño, como la central.
ALTER TABLE "inventory_locations"
  ADD COLUMN IF NOT EXISTS "sellable" boolean DEFAULT true NOT NULL;--> statement-breakpoint

ALTER TABLE "inventory_locations" DROP CONSTRAINT IF EXISTS "loc_kind_valido";--> statement-breakpoint
ALTER TABLE "inventory_locations"
  ADD CONSTRAINT "loc_kind_valido" CHECK ("kind" IN ('central', 'integrante', 'cuarentena'));--> statement-breakpoint

ALTER TABLE "inventory_locations" DROP CONSTRAINT IF EXISTS "loc_central_sin_dueño";--> statement-breakpoint
ALTER TABLE "inventory_locations"
  ADD CONSTRAINT "loc_central_sin_dueño" CHECK (
    ("kind" IN ('central', 'cuarentena') AND "professional_id" IS NULL)
    OR ("kind" = 'integrante' AND "professional_id" IS NOT NULL)
  );--> statement-breakpoint

-- Y UNA SOLA CUARENTENA, por la misma razon que una sola central: dos sitios de espera para lo mismo se
-- convierten en dos verdades sobre donde esta una unidad devuelta.
CREATE UNIQUE INDEX IF NOT EXISTS "loc_una_cuarentena"
  ON "inventory_locations" (("kind")) WHERE "kind" = 'cuarentena';--> statement-breakpoint

INSERT INTO "inventory_locations" ("name", "kind", "professional_id", "sellable")
SELECT 'Devueltas pendientes de verificación', 'cuarentena', NULL, false
 WHERE NOT EXISTS (SELECT 1 FROM "inventory_locations" WHERE "kind" = 'cuarentena');
