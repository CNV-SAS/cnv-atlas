-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- QUIEN VERIFICO EL EXTRACTO, Y CUANDO
--
-- EL CRITERIO (Santiago, 2026-10-01): "la unica forma de verificar una transferencia es que alguien se meta
-- a ver la cuenta bancaria y compruebe el pago". Tiene razon, y la consecuencia es la regla:
--
--   LA AUTOMATIZACION NO AFIRMA EL PAGO. LO AFIRMA QUIEN LO VIO.
--
-- El efectivo lo tiene el Integrante en la mano y Wompi lo confirma la pasarela, asi que esos dos se
-- registran solos. Una transferencia solo la confirma el extracto, y registrarla automaticamente seria
-- afirmar un pago que nadie comprobo. Por eso la cuenta de transferencias NO se mapea para la cola: el pago
-- lo registra una persona, aqui, y queda escrito que fue ella.
--
-- ── POR QUE DOS COLUMNAS Y NO UNA BANDERA ──
--
-- "Verificado = true" no se le puede preguntar nada. Esto mueve dinero en un documento fiscal (registra el
-- pago de una factura emitida), asi que tiene que poder responder "¿quien dijo que entro, y cuando?" seis
-- meses despues. Es la misma forma que ya tienen `cash_not_received_by`, `reviewed_by` y `resolved_by`.
--
-- Y NO LLEVA TRIGGER DE INMUTABILIDAD: la columna la escribe un solo camino (el servicio de confirmacion) y
-- lo que de verdad cierra el asunto es `alegra_payment_id`, que no se puede escribir dos veces porque Alegra
-- lo rechaza. Un trigger aqui protegeria el apunte y no el hecho.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "transferencia_verificada_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "transferencia_verificada_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- LAS DOS O NINGUNA: una fecha sin responsable no responde la pregunta por la que existen.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_transferencia_verificada_completa";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_transferencia_verificada_completa" CHECK (
    ("transferencia_verificada_at" IS NULL AND "transferencia_verificada_by" IS NULL)
    OR ("transferencia_verificada_at" IS NOT NULL AND "transferencia_verificada_by" IS NOT NULL)
  );--> statement-breakpoint

COMMENT ON COLUMN "transactions"."transferencia_verificada_at" IS
  'Cuando una persona comprobo en el extracto que la transferencia entro. La automatizacion no afirma este pago.';
