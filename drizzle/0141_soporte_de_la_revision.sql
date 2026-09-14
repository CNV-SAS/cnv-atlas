-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL SOPORTE DE LA REVISION  ·  Bloque 3, sesion 2  ·  2026-09-14
--
-- Contabilidad (2026-09-14): un pago aprobado sobre un link anulado lo resuelve Direccion con el Integrante
-- aportando el hecho, porque el Integrante tiene incentivo (marcar "segunda compra" le da comision). El soporte
-- minimo: quien resolvio y cuando (ya estaban, 0140), QUE VERSION DIO EL INTEGRANTE y, si hubo devolucion, EL
-- COMPROBANTE. Y el plazo de 5 dias habiles necesita saber CUANDO entro en revision.
--
-- Aditivo, mas el marcado de las revisiones que ya estaban resueltas (abajo).
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  -- Lo que paso en la consulta, contado por el Integrante (o escrito por Direccion de lo que el Integrante le
  -- conto). Quien la escribio queda aparte: no es lo mismo que la escriba el Integrante que un administrador.
  ADD COLUMN IF NOT EXISTS "review_professional_version" text,
  ADD COLUMN IF NOT EXISTS "review_professional_version_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "review_professional_version_at" timestamp with time zone,
  -- La referencia de la devolucion en Wompi.
  ADD COLUMN IF NOT EXISTS "review_refund_reference" text,
  -- CUANDO ENTRO EN REVISION, para el plazo de 5 dias habiles de contabilidad. No sirve `created_at` (el link
  -- pudo crearse el dia anterior) ni `updated_at` (cambia con cualquier escritura). Nulo en las anteriores.
  ADD COLUMN IF NOT EXISTS "review_opened_at" timestamp with time zone;--> statement-breakpoint

-- LAS REVISIONES YA RESUELTAS SE MARCAN, NO SE ESCONDEN DE LA REGLA. Las que resolvio el smoke del 2026-09-14
-- son anteriores a estas columnas y no tienen version ni comprobante. Se descarto NOT VALID: Postgres hace
-- cumplir un CHECK NOT VALID en cada UPDATE de la fila, asi que la primera escritura sobre una de ellas (una
-- entrega, un reintento de factura) fallaria. Se les escribe un texto que dice lo que paso, y la regla vale
-- para todas.
-- Primero se quitan las restricciones si ya existian (una corrida anterior de esta misma migracion en local): con
-- ellas puestas, el propio marcado de abajo las violaria a medio camino.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_resolucion_con_version";--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_devuelto_con_comprobante";--> statement-breakpoint

UPDATE "transactions"
   SET "review_professional_version" = '(Resuelta antes de exigir la versión del Integrante, 2026-09-14.)'
 WHERE "review_resolution" IS NOT NULL AND "review_professional_version" IS NULL;--> statement-breakpoint
UPDATE "transactions"
   SET "review_refund_reference" = '(Resuelta antes de exigir el comprobante, 2026-09-14.)'
 WHERE "review_resolution" = 'devuelto' AND "review_refund_reference" IS NULL;--> statement-breakpoint

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_resolucion_con_version"
  CHECK ("review_resolution" IS NULL OR "review_professional_version" IS NOT NULL);--> statement-breakpoint

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_devuelto_con_comprobante"
  CHECK ("review_resolution" IS DISTINCT FROM 'devuelto' OR "review_refund_reference" IS NOT NULL);
