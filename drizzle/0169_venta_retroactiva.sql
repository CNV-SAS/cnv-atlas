-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA VENTA RETROACTIVA  ·  Bloque R  ·  2026-09-23
--
-- Una integrante ya vendia con el HTML antes de que Atlas existiera para lo comercial, y esas ventas SE
-- FACTURARON A MANO, POR FUERA. Su saldo de inventario dice lo que RECIBIO, no lo que tiene.
--
-- REGISTRARLAS EN ATLAS TIENE UNA CONDICION QUE NO ES OPCIONAL: que Atlas NO vuelva a facturarlas. Esas
-- facturas ya existen en Alegra; si Atlas emite otra, el mismo hecho queda con dos documentos y eso es
-- justo lo que mira una auditoria. Hoy el flujo entero asume que la factura la crea Atlas.
--
-- ── LA FECHA VA EN `created_at`, NO EN UNA COLUMNA NUEVA ───────────────────────────────────────────
--
-- Toda la app fecha una venta por `created_at` (los paneles, el corte por dia de Bogota, la conciliacion).
-- Una segunda columna de fecha seria una segunda verdad sobre el mismo hecho, y las consultas viejas
-- seguirian leyendo la vieja: la venta diria una fecha en un panel y otra en el siguiente. Asi que una venta
-- retroactiva se inserta CON SU FECHA REAL en `created_at`, y todo lo demas sigue siendo cierto sin tocarlo.
--
-- ── Y UNA SOLA COLUMNA PARA EL HECHO, NO DOS ──────────────────────────────────────────────────────
--
-- "Se registro despues" y "su factura y su pago viven fuera de Atlas" son el MISMO hecho aqui: si Atlas la
-- hubiera facturado, no seria retroactiva. Dos banderas para un hecho se desincronizan; una sola, no.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "registered_retroactively_at" timestamptz;--> statement-breakpoint
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "registered_retroactively_by" uuid REFERENCES "profiles"("id");--> statement-breakpoint

COMMENT ON COLUMN "transactions"."registered_retroactively_at" IS
  'Cuando se REGISTRO en Atlas una venta que ya habia ocurrido (created_at = cuando ocurrio). No nula = su factura y su pago se gestionaron fuera de Atlas: no se emite ni se persigue.';--> statement-breakpoint

-- LO QUE LA BASE GARANTIZA, para que ninguna pantalla pueda registrar una venta retroactiva a medias:
-- si es retroactiva, viene PAGADA, con el NUMERO de la factura que ya existe, marcada como emitida, y con
-- quien la registro. Sin el numero no sirve para nada: el proposito entero es poder cotejarla con Alegra.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "tx_retroactiva_completa";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "tx_retroactiva_completa" CHECK (
    "registered_retroactively_at" IS NULL
    OR (
      "status" = 'paid'
      AND "alegra_invoice_number" IS NOT NULL
      AND length(trim("alegra_invoice_number")) > 0
      AND "alegra_invoice_state" = 'emitida'
      AND "registered_retroactively_by" IS NOT NULL
    )
  );--> statement-breakpoint

-- Y QUE NO TENGA ID INTERNO DE ALEGRA: ese id lo asigna Alegra cuando ATLAS crea el documento. Una venta
-- retroactiva no lo tiene, y ponerselo haria que la cola de facturacion creyera que puede releerla y
-- registrarle el pago, sobre un documento que Atlas nunca creo.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "tx_retroactiva_sin_id_de_alegra";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "tx_retroactiva_sin_id_de_alegra" CHECK (
    "registered_retroactively_at" IS NULL OR "alegra_invoice_id" IS NULL
  );--> statement-breakpoint

-- El numero de factura ya emitido no se repite: dos ventas con el mismo consecutivo serian el mismo hecho
-- contado dos veces, que es el error que este bloque existe para no cometer.
CREATE UNIQUE INDEX IF NOT EXISTS "tx_retroactiva_numero_unico"
  ON "transactions" ("alegra_invoice_number")
  WHERE "registered_retroactively_at" IS NOT NULL;
