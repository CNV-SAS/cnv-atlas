-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL PAGO REGISTRADO ES UN HECHO PROPIO, NO SE DEDUCE DE LA FACTURA  ·  Bloque 2a  ·  2026-09-13
--
-- ── LO QUE ENSEÑO EL SMOKE ──────────────────────────────────────────────────────────────────────
--
-- SEIS VENTAS con la factura bien emitida (consecutivo, CUFE, lineas correctas) y el pago FALLIDO en
-- todas, con el mismo motivo:
--
--     {"message":"La cuenta de banco asociada al pago es obligatoria","code":4002}
--
-- El motivo SI quedo escrito en la transaccion, que es lo que permitio diagnosticarlo. Pero NO SALIO EN
-- EL PANEL DE REINTENTO, y ese es el defecto de esta migracion: el panel y la cola filtraban por
-- `alegra_invoice_state <> 'emitida'`, y las seis estaban `emitida`. Asi que despues de pulsar el boton,
-- el panel quedo con UNA sola venta pendiente (la del paciente real) y dijo, en la practica, "todo lo
-- demas esta bien", mientras seis pacientes figuraban "por cobrar" en Alegra habiendo pagado.
--
-- Un panel que muestra la mitad de los problemas es peor que ninguno, porque se le cree.
--
-- ── POR QUE UNA COLUMNA Y NO LEER EL MOTIVO ─────────────────────────────────────────────────────
--
-- Se podia filtrar por `alegra_last_error LIKE 'Factura OK, PAGO NO REGISTRADO%'`, y seria un parche:
-- el texto de un mensaje no es un estado, y el dia que alguien lo redacte distinto la cola deja de ver
-- esas ventas SIN QUE NADA AVISE. El id del pago en Alegra es un hecho: existe o no existe.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "alegra_payment_id" text;--> statement-breakpoint

COMMENT ON COLUMN "transactions"."alegra_payment_id" IS
  'Id del pago en Alegra. Nulo en una venta ya facturada significa que el pago NO se registro y el paciente figura "por cobrar" habiendo pagado.';--> statement-breakpoint

-- LA COLA PASA A CUBRIR LOS DOS HUECOS: sin documento, o con documento y sin pago. Es un indice por la
-- misma razon que el anterior: lo que barre tiene que ser barato de encontrar.
DROP INDEX IF EXISTS "transactions_factura_pendiente_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_factura_pendiente_idx"
  ON "transactions" ("created_at")
  WHERE "status" = 'paid'
    AND ("alegra_invoice_state" IS DISTINCT FROM 'emitida' OR "alegra_payment_id" IS NULL);
