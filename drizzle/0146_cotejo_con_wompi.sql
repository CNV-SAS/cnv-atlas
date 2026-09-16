-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL COTEJO CON WOMPI  ·  Bloque 3b, sesion 3  ·  2026-09-16
--
-- POR QUE: Wompi reintenta su webhook 3 veces en 24 horas y despues no lo intenta mas. Una venta cobrada cuyo
-- webhook se perdio queda `pending` para siempre: sin sellar, sin factura, sin comision y sin que nadie se entere.
-- Paso el 2026-09-15, con la base saturada y plata de prueba. El cotejo le pregunta a Wompi por las aprobadas del
-- rango y sella las que a Atlas no le llegaron, por la MISMA ruta idempotente del webhook.
--
-- ESTA TABLA ES EL RASTRO DE CADA CORRIDA, y existe por dos razones que no son la misma:
--   1. Saber que el control CORRIO. Un cotejo que lleva tres dias sin correr es justo cuando hace falta.
--   2. Dejar escrito que se recupero y que quedo por revisar. Recuperar un pago es escribir plata: tiene que
--      poder auditarse quien lo hizo (la tarea o una persona) y con que resultado.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "payment_reconciliation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ran_at" timestamp with time zone DEFAULT now() NOT NULL,
  -- El rango consultado en Wompi.
  "from_date" timestamp with time zone NOT NULL,
  "until_date" timestamp with time zone NOT NULL,
  -- El ambiente de la llave con que se consulto: un cotejo de `test` nunca sella una venta de produccion.
  "wompi_env" text NOT NULL,
  "origin" text NOT NULL,
  -- Quien la disparo a mano; NULL cuando fue la tarea programada.
  "actor_id" uuid REFERENCES "profiles"("id") ON DELETE SET NULL,
  "checked" integer DEFAULT 0 NOT NULL,
  "recovered" integer DEFAULT 0 NOT NULL,
  "mismatched" integer DEFAULT 0 NOT NULL,
  -- Que se recupero y que quedo anotado, sin datos de pacientes: ids de venta, ids de Wompi y el motivo.
  "detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
  -- Por que no se pudo cotejar (Wompi caido, sin llave). NULL si corrio bien.
  "failed_reason" text,
  CONSTRAINT "payment_reconciliation_runs_origen_valido" CHECK ("origin" IN ('tarea', 'manual')),
  CONSTRAINT "payment_reconciliation_runs_ambiente_valido" CHECK ("wompi_env" IN ('test', 'produccion'))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payment_reconciliation_runs_ran_at_idx"
  ON "payment_reconciliation_runs" ("ran_at" DESC);--> statement-breakpoint

-- ── LECTURA ─────────────────────────────────────────────────────────────────────────────────────────
-- La ven quienes responden por el dinero. El servicio escribe con service role, como el resto de pagos.
ALTER TABLE "payment_reconciliation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "payment_reconciliation_runs_select" ON "payment_reconciliation_runs";--> statement-breakpoint
CREATE POLICY "payment_reconciliation_runs_select" ON "payment_reconciliation_runs"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion'));
