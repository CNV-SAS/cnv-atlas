-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA ENTREGA, LA ANULACION DEL LINK Y LA REVISION  ·  Bloque 3, sesion 2  ·  2026-09-14
--
-- Todo ADITIVO y en `transactions`, no en tablas nuevas: cada una de estas cosas es una por venta, y la venta
-- es la fila de `transactions` (decision 1 de Santiago). El plan original decia una tabla `sale_fulfillment`;
-- con una fila por venta, una tabla aparte seria una segunda fuente del mismo hecho.
--
-- LAS TRES REGLAS QUE ESTO SOSTIENE:
--   · No existe camino para entregar sin venta: la entrega es un estado de la venta, y solo de una pagada.
--   · Un link ANULADO se distingue de uno que Wompi rechazo. Los dos quedan `failed`, pero si llega un pago
--     aprobado sobre el anulado es casi seguro un cobro doble, y no se factura solo.
--   · Un pago sobre link anulado queda EN REVISION: sellado (el dinero entro), sin descontar ni facturar,
--     hasta que alguien decida si fue una segunda compra o si se devuelve (Santiago, 2026-09-14).
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  -- ── LA ENTREGA ──
  -- Nulo = venta anterior a la sesion 2, que no tiene estado de entrega.
  ADD COLUMN IF NOT EXISTS "fulfillment_state" text,
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "delivered_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  -- ── LA ANULACION DEL LINK ──
  -- `cancelled_by` admite nulo: el cierre masivo por script (`cerrar-checkouts-pendientes.sql`) no tiene actor.
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "cancelled_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  -- ── LA REVISION ──
  ADD COLUMN IF NOT EXISTS "review_reason" text,
  ADD COLUMN IF NOT EXISTS "review_resolution" text,
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "reviewed_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_fulfillment_state_valido";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fulfillment_state_valido"
  CHECK ("fulfillment_state" IS NULL OR "fulfillment_state" IN ('pendiente', 'entregado'));--> statement-breakpoint

-- Una entrega sin fecha no es una entrega: es un estado que alguien escribio a mano.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_entrega_con_fecha";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_entrega_con_fecha"
  CHECK ("fulfillment_state" IS DISTINCT FROM 'entregado' OR "delivered_at" IS NOT NULL);--> statement-breakpoint

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_review_reason_valido";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_review_reason_valido"
  CHECK ("review_reason" IS NULL OR "review_reason" IN ('pago_sobre_link_anulado'));--> statement-breakpoint

-- Una resolucion sin motivo, o sin quien y cuando, no se puede auditar.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_review_resolution_valida";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_review_resolution_valida"
  CHECK ("review_resolution" IS NULL OR (
    "review_resolution" IN ('segunda_compra', 'devuelto')
    AND "review_reason" IS NOT NULL
    AND "reviewed_at" IS NOT NULL
  ));--> statement-breakpoint

COMMENT ON COLUMN "transactions"."fulfillment_state" IS
  'Entrega de la venta. NULL = anterior a la sesion 2 del Bloque 3. pendiente -> entregado, solo sobre una venta pagada. El inventario NO se mueve al entregar: se movio al sellar (D2).';--> statement-breakpoint
COMMENT ON COLUMN "transactions"."review_reason" IS
  'Venta que no se descuenta ni se factura sola hasta que alguien la revise. pago_sobre_link_anulado: llego un pago aprobado sobre un link que Atlas ya habia anulado (probable cobro doble).';--> statement-breakpoint

-- La lista "Revisar": pocas filas, y se consulta en cada carga de /pagos.
CREATE INDEX IF NOT EXISTS "transactions_por_revisar_idx"
  ON "transactions" ("created_at")
  WHERE "review_reason" IS NOT NULL AND "review_resolution" IS NULL;--> statement-breakpoint

-- Las entregas pendientes de un profesional (lo pagado que el paciente aun no se llevo).
CREATE INDEX IF NOT EXISTS "transactions_entrega_pendiente_idx"
  ON "transactions" ("professional_id")
  WHERE "fulfillment_state" = 'pendiente';
