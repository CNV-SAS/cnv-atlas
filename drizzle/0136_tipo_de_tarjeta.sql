-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL TIPO DE TARJETA  ·  medio de pago de la factura  ·  2026-09-13
--
-- Contabilidad dio la tabla del medio de pago, y DISTINGUE tarjeta credito de tarjeta debito. Pero Wompi,
-- en `payment_method_type`, manda solo "CARD" para las dos: la diferencia viaja aparte, en
-- `payment_method.extra.card_type`. Con solo el tipo guardado, toda venta con tarjeta quedaria sin poder
-- decidir su medio de pago.
--
-- SE GUARDA APARTE y no pegado al tipo ("CARD:CREDIT"): un campo que mezcla dos datos obliga a partirlo
-- cada vez que se lee, y el dia que alguien lo lea sin partirlo compara "CARD:CREDIT" contra "CARD" y falla
-- sin avisar.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "payment_card_type" text;--> statement-breakpoint

COMMENT ON COLUMN "transactions"."payment_card_type" IS
  'CREDIT | DEBIT, solo en pagos con tarjeta. Wompi lo manda en payment_method.extra.card_type, no en payment_method_type (que dice CARD para las dos).';
