-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL EFECTIVO QUE NO SE RECIBIO  ·  Bloque 3, sesion 2  ·  2026-09-14
--
-- Contabilidad (2026-09-14): un pago en revision puede revelar el caso al reves, que es mas grave. El efectivo
-- que anulo el link NO se recibio: el paciente pago solo con tarjeta. Queda una factura por un pago que no
-- entro, una comision sellada al Integrante por esa venta, y un pago real de Wompi sin factura. Y "efectivo
-- registrado que no se recibio" es exactamente la forma de un fraude: tiene que alertar distinto y escalar si
-- se repite con el mismo Integrante. Diseno aprobado por Santiago el mismo dia (plan 3.6).
--
-- Aditivo: columnas, dos CHECK que se amplian y la reversion de ingreso como fila negativa.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LA VENTA ────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "transactions"
  -- EN EL LINK: la venta en efectivo que lo anulo. Sin este vinculo, Direccion tendria que adivinar cual venta
  -- es la del efectivo que no entro.
  ADD COLUMN IF NOT EXISTS "cancelled_by_sale_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
  -- EN LA VENTA EN EFECTIVO: Direccion determino que el efectivo no se recibio.
  ADD COLUMN IF NOT EXISTS "cash_not_received_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "cash_not_received_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  -- El numero de la nota credito que contabilidad emite A MANO en Alegra sobre la factura del efectivo, hasta
  -- que el 3b la emita desde Atlas. Nulo = pendiente, y el panel lo sigue mostrando.
  ADD COLUMN IF NOT EXISTS "credit_note_manual_number" text,
  -- EN LA VENTA DE WOMPI: su producto salio con la venta en efectivo, asi que no se descuenta otra vez.
  ADD COLUMN IF NOT EXISTS "stock_covered_by_sale_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL;--> statement-breakpoint

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_stock_state_valido";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_stock_state_valido"
  CHECK ("stock_state" IS NULL OR "stock_state" IN
    ('reservado', 'pendiente', 'descontado', 'sin_saldo', 'fallido', 'liberado',
     'en_otra_venta'));  --> statement-breakpoint

-- `en_otra_venta` siempre dice cual.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_en_otra_venta_con_venta";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_en_otra_venta_con_venta"
  CHECK ("stock_state" IS DISTINCT FROM 'en_otra_venta' OR "stock_covered_by_sale_id" IS NOT NULL);--> statement-breakpoint

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_review_resolution_valida";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_review_resolution_valida"
  CHECK ("review_resolution" IS NULL OR (
    "review_resolution" IN ('segunda_compra', 'devuelto', 'efectivo_no_recibido')
    AND "review_reason" IS NOT NULL
    AND "reviewed_at" IS NOT NULL
  ));--> statement-breakpoint

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_efectivo_no_recibido_es_efectivo";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_efectivo_no_recibido_es_efectivo"
  CHECK ("cash_not_received_at" IS NULL OR ("payment_method" = 'efectivo' AND "cash_not_received_by" IS NOT NULL));--> statement-breakpoint

-- El conteo por Integrante de la escalada (casos en 90 dias).
CREATE INDEX IF NOT EXISTS "transactions_efectivo_no_recibido_idx"
  ON "transactions" ("professional_id", "cash_not_received_at")
  WHERE "cash_not_received_at" IS NOT NULL;--> statement-breakpoint

-- ── 2. LA REVERSION DEL INGRESO, COMO FILA NEGATIVA ─────────────────────────────────────────────────
--
-- No se borra la comision ni el ingreso de la venta en efectivo: se escribe su contrapartida negativa, que
-- apunta a la fila que revierte. El rastro de que existio y se revirtio es parte del control (Santiago,
-- 2026-09-14), y es la forma que ya describe el 3b: si ya se liquido, se descuenta en la siguiente.
ALTER TABLE "professional_revenue"
  ADD COLUMN IF NOT EXISTS "reversal_of" uuid REFERENCES "professional_revenue"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "cnv_revenue"
  ADD COLUMN IF NOT EXISTS "reversal_of" uuid REFERENCES "cnv_revenue"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- Una fila se revierte una sola vez.
CREATE UNIQUE INDEX IF NOT EXISTS "professional_revenue_reversal_unica"
  ON "professional_revenue" ("reversal_of") WHERE "reversal_of" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cnv_revenue_reversal_unica"
  ON "cnv_revenue" ("reversal_of") WHERE "reversal_of" IS NOT NULL;
