-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CADA VENTA SABE DE QUE AMBIENTE ES  ·  gate de 2b  ·  2026-09-13 (sale a produccion el 2026-09-14)
--
-- ── LOS DOS CASOS QUE ESTO CIERRA ───────────────────────────────────────────────────────────────
--
-- El guard de `is_test` cubre QUE PACIENTE, no QUE PAGO. Y la base de produccion ya tiene ventas del smoke:
--
--   1. UN PAGO DE PRUEBA A UN PACIENTE REAL (107.100). En sandbox el guard la rechaza. Al pasar Alegra a
--      produccion, "paciente real contra produccion" queda PERMITIDO, y la cola la reclamaria y emitiria
--      una factura electronica REAL por un pago que nunca movio dinero.
--
--   2. UNA FACTURA DE SANDBOX RELEIDA EN PRODUCCION. `alegra_invoice_id` es el id interno de Alegra, y es
--      de un ambiente concreto. Una venta con la factura 7 del sandbox, reintentada en produccion, leeria la
--      factura 7 DE PRODUCCION, que es otro documento de otra persona, y podria registrarle un pago.
--
-- ── LA CAUSA ────────────────────────────────────────────────────────────────────────────────────
--
-- `patients` y `nutraceuticals` tienen `alegra_env` justo para que un id de un ambiente no se use en otro.
-- `transactions`, que es la tabla que guarda el id de la FACTURA, se quedo sin la suya. Una regla que vive
-- en tres sitios, aplicada en dos.
--
-- ── LAS DOS COLUMNAS, Y POR QUE SON DOS ─────────────────────────────────────────────────────────
--
-- `wompi_env` es el MODO DEL PAGO: con que llaves de Wompi estaba el sistema cuando se creo la venta. Se
-- escribe al CREARLA y no cambia nunca. Tambien en las ventas en efectivo, donde registra el modo en que
-- estaba el sistema: una venta en efectivo tecleada durante el smoke es tan de prueba como una por Wompi.
--
-- `alegra_env` es de donde es la FACTURA. Se escribe al emitirla.
--
-- La regla que las une: un pago de PRUEBA solo se factura en SANDBOX, y uno de PRODUCCION solo en
-- PRODUCCION. Con eso el caso 1 queda cerrado por el pago, sin depender de que alguien marque al paciente.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "wompi_env" text,
  ADD COLUMN IF NOT EXISTS "alegra_env" text,
  -- EL INSTRUMENTO con el que pago el paciente (CARD, PSE, NEQUI, BANCOLOMBIA_TRANSFER...). Wompi lo manda
  -- en cada evento y se estaba TIRANDO: el esquema del webhook declaraba cinco campos y Zod elimina el
  -- resto. Hace falta para el medio de pago de la factura (codigos DIAN 48, 49, 42) y para la comision,
  -- que no es la misma por instrumento.
  ADD COLUMN IF NOT EXISTS "payment_method_type" text;--> statement-breakpoint

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_wompi_env_check"
  CHECK ("wompi_env" IS NULL OR "wompi_env" IN ('test', 'produccion'));--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_alegra_env_check"
  CHECK ("alegra_env" IS NULL OR "alegra_env" IN ('sandbox', 'produccion'));--> statement-breakpoint

-- BACKFILL, y es CIERTO, no una suposicion: hasta hoy no existe ninguna fila de produccion en
-- `alegra_config` (verificado en la nube el 2026-09-12), asi que ninguna venta pudo emitirse fuera del
-- sandbox; y las llaves de Wompi del entorno son de prueba (verificado en Vercel por Santiago). Toda venta
-- existente es de prueba.
UPDATE "transactions" SET "wompi_env" = 'test' WHERE "wompi_env" IS NULL;--> statement-breakpoint
UPDATE "transactions" SET "alegra_env" = 'sandbox'
 WHERE "alegra_env" IS NULL AND "alegra_invoice_id" IS NOT NULL;--> statement-breakpoint

-- Y A PARTIR DE AQUI NINGUNA VENTA NACE SIN MODO. Sin esto, una venta creada por un camino que olvide
-- escribirlo quedaria sin modo, y la regla de ambiente no sabria que hacer con ella.
ALTER TABLE "transactions" ALTER COLUMN "wompi_env" SET NOT NULL;--> statement-breakpoint

-- EL GUARD ES UNA DECISION, NO UN FALLO. Un paciente real contra sandbox da siempre el mismo resultado:
-- reintentarlo gasta intentos sin poder cambiar nada, y al agotarlos el panel dice "agotados", que se lee
-- como que algo se rindio. `rechazada` no se reintenta y no consume intentos.
ALTER TYPE "public"."alegra_invoice_state" ADD VALUE IF NOT EXISTS 'rechazada';
