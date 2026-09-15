-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL REPARTO SELLADO EN LA LINEA  ·  Bloque 3, paso 5 del 3.4  ·  2026-09-14
--
-- Hasta hoy el reparto de cada venta se CALCULABA al sellarla (comision, parte del proveedor y residuo de CNV)
-- y solo quedaban dos sumas por venta: `professional_revenue` y `cnv_revenue`. La parte del proveedor no
-- quedaba en ningun lado, y la tasa de IVA y la del Integrante con que se hizo la cuenta tampoco. Una
-- liquidacion (Bloque 4) tiene que poder explicar cada peso de cada linea sin recalcular con tasas que ya
-- cambiaron: "¿por que se liquido al 20%?" necesita la respuesta sellada, no reconstruida.
--
-- Adicion c) del plan: la linea sella tambien la TARIFA DE IVA aplicada y la MODALIDAD del Integrante.
--
-- Aditivo y nulo: las lineas de ventas anteriores no tienen reparto sellado; se reconstruye exacto con la
-- vigencia, como se hacia.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transaction_items"
  -- Las TASAS con que se hizo la cuenta, en fraccion.
  ADD COLUMN IF NOT EXISTS "vat_rate" numeric,
  ADD COLUMN IF NOT EXISTS "commission_rate" numeric,
  ADD COLUMN IF NOT EXISTS "supplier_share" numeric,
  -- comision | distribucion. Hoy solo existe comision: distribucion llega con el Bloque 5.
  ADD COLUMN IF NOT EXISTS "modality" text,
  -- Los MONTOS, en pesos, sobre la base sin IVA de la linea. Sellados y no recalculados: la suma de las lineas
  -- es lo que cuadra contra `professional_revenue` y `cnv_revenue` de la venta.
  ADD COLUMN IF NOT EXISTS "base_amount" numeric,
  ADD COLUMN IF NOT EXISTS "commission_amount" numeric,
  ADD COLUMN IF NOT EXISTS "supplier_amount" numeric,
  ADD COLUMN IF NOT EXISTS "cnv_amount" numeric,
  ADD COLUMN IF NOT EXISTS "sealed_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "transaction_items" DROP CONSTRAINT IF EXISTS "transaction_items_modality_valida";--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_modality_valida"
  CHECK ("modality" IS NULL OR "modality" IN ('comision', 'distribucion'));--> statement-breakpoint

-- Sellado es TODO o nada: una linea con la comision y sin la parte del proveedor no se puede liquidar.
ALTER TABLE "transaction_items" DROP CONSTRAINT IF EXISTS "transaction_items_reparto_completo";--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_reparto_completo"
  CHECK (
    ("sealed_at" IS NULL AND "base_amount" IS NULL AND "commission_amount" IS NULL
      AND "supplier_amount" IS NULL AND "cnv_amount" IS NULL)
    OR
    ("sealed_at" IS NOT NULL AND "vat_rate" IS NOT NULL AND "commission_rate" IS NOT NULL
      AND "supplier_share" IS NOT NULL AND "modality" IS NOT NULL AND "base_amount" IS NOT NULL
      AND "commission_amount" IS NOT NULL AND "supplier_amount" IS NOT NULL AND "cnv_amount" IS NOT NULL)
  );
