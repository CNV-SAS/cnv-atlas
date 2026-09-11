-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- BLOQUE 2a · EL MODELO DE DATOS DE LA FACTURACION REAL  ·  2026-09-11
--
-- ── LO QUE HAY HOY, VERIFICADO EN EL CODIGO ANTES DE ESCRIBIR NADA ──────────────────────────────
--
-- `tryCreateAlegraInvoice` manda a Alegra, para TODA venta y de TODO producto:
--
--   · el MISMO cliente (`ALEGRA_DEFAULT_CLIENT_ID`), sea quien sea el paciente;
--   · UN item generico (`ALEGRA_DEFAULT_ITEM_ID`) con `quantity: 1` y el total de la venta como precio;
--   · y la deja en BORRADOR a proposito (no manda `status: 'open'`).
--
-- O sea: la factura no dice a quien se le vendio ni que se le vendio, y nunca recibe consecutivo. Y
-- `transaction_items` SI tiene las lineas de verdad (producto, cantidad, precio unitario): el dato existe
-- en Atlas y se descarta al facturar.
--
-- Y SI ALEGRA FALLA, NADA LO VUELVE A INTENTAR. El catch manda el error a Sentry y sigue. La fila queda
-- con `alegra_invoice_id` nulo para siempre: no hay cola, no hay job, y el webhook de Alegra
-- (`api/webhooks/alegra/`) es una carpeta VACIA, asi que tampoco llega nada de vuelta. Un pago cobrado sin
-- documento no lo detecta nadie salvo que alguien mire Sentry.
--
-- El comentario del servicio decia "se reintenta (Wompi reenvia) o queda para un job post-MVP". Lo
-- primero es falso: Wompi reenvia el webhook solo si NO le respondimos 200, y le respondemos 200 porque
-- el pago si se sello. Lo segundo nunca se construyo.
--
-- ── LO QUE ESTA MIGRACION AGREGA, Y POR QUE CADA COSA ───────────────────────────────────────────
--
-- NO construye la cola como TABLA. La cola es una CONSULTA sobre `transactions` (las pagadas sin factura
-- emitida), y una tabla aparte seria una segunda fuente del mismo hecho, capaz de desincronizarse de la
-- transaccion que dice representar. El indice parcial de abajo es lo que la hace barata.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. EL ESTADO DE LA FACTURA, QUE HOY SE INFIERE DE UN NULO ───────────────────────────────────
--
-- `alegra_invoice_id IS NULL` significa hoy TRES cosas distintas que hay que poder separar: nunca se
-- intento, se intento y fallo, o no aplica. Un nulo que responde tres preguntas no responde ninguna.
CREATE TYPE "public"."alegra_invoice_state" AS ENUM (
  'pendiente',   -- la venta esta pagada y la factura todavia no existe
  'borrador',    -- creada en Alegra, SIN consecutivo: no es un documento fiscal todavia
  'emitida',     -- abierta en Alegra, con su consecutivo asignado por ellos
  'fallida'      -- se intento y Alegra la rechazo; el motivo queda en `alegra_last_error`
);--> statement-breakpoint

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "alegra_invoice_state" "alegra_invoice_state",
  -- EL CONSECUTIVO, que es lo que hoy no se guarda. `alegra_invoice_id` es el id interno de Alegra; el
  -- NUMERO es el que la DIAN reconoce y el que el paciente ve. Son dos cosas y se guardaban como una.
  ADD COLUMN IF NOT EXISTS "alegra_invoice_number" text,
  ADD COLUMN IF NOT EXISTS "alegra_emitted_at" timestamptz,
  -- Para la cola: cuantas veces se intento y que dijo Alegra la ultima vez. Sin el contador, un reintento
  -- automatico contra un error permanente (un item que no existe) se vuelve un bucle silencioso.
  ADD COLUMN IF NOT EXISTS "alegra_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "alegra_last_attempt_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "alegra_last_error" text;--> statement-breakpoint

-- BACKFILL: lo que ya existe se clasifica por lo unico que se sabe de ello. Una pagada con id de Alegra
-- es un BORRADOR (nunca se mando `status:'open'`, asi que ninguna de las que hay puede ser 'emitida'), y
-- una pagada sin id esta PENDIENTE. Las no pagadas se quedan en nulo: la factura no les aplica todavia.
UPDATE "transactions"
   SET "alegra_invoice_state" = CASE
         WHEN "alegra_invoice_id" IS NOT NULL THEN 'borrador'::"alegra_invoice_state"
         ELSE 'pendiente'::"alegra_invoice_state"
       END
 WHERE "status" = 'paid';--> statement-breakpoint

-- LA COLA, como indice parcial y no como tabla. Barre solo lo que de verdad falta.
CREATE INDEX IF NOT EXISTS "transactions_factura_pendiente_idx"
  ON "transactions" ("created_at")
  WHERE "alegra_invoice_state" IN ('pendiente', 'fallida');--> statement-breakpoint

-- ── 2. EL CONTACTO DEL PACIENTE EN ALEGRA ───────────────────────────────────────────────────────
--
-- Hoy todas las facturas van al mismo cliente por defecto. El contacto se crea UNA vez por paciente y su
-- id se guarda aqui, para no volver a crearlo en cada venta (Alegra duplicaria contactos con el mismo
-- documento, y limpiar eso despues es manual).
--
-- VA EN `patients` Y NO EN LA TRANSACCION porque el contacto es de la PERSONA, no de la venta. Es la
-- misma razon por la que las contraindicaciones viven en el paciente.
--
-- Y SE GUARDA TAMBIEN EL AMBIENTE. Un id de sandbox no vale en produccion, y sin esta columna el paso a
-- produccion facturaria contra contactos que alli no existen. El modelo lo llama la causa numero uno de
-- facturas mal emitidas: cambiar de ambiente sobre identificadores del ambiente anterior.
ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "alegra_contact_id" text,
  ADD COLUMN IF NOT EXISTS "alegra_env" text;--> statement-breakpoint

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_alegra_env_check"
  CHECK ("alegra_env" IS NULL OR "alegra_env" IN ('sandbox', 'produccion'));--> statement-breakpoint

-- Y LO MISMO PARA EL ITEM DEL PRODUCTO, por identica razon: `alegra_item_id` (columna de la 0120) es de
-- un ambiente concreto.
ALTER TABLE "nutraceuticals"
  ADD COLUMN IF NOT EXISTS "alegra_env" text;--> statement-breakpoint

ALTER TABLE "nutraceuticals"
  ADD CONSTRAINT "nutraceuticals_alegra_env_check"
  CHECK ("alegra_env" IS NULL OR "alegra_env" IN ('sandbox', 'produccion'));--> statement-breakpoint

COMMENT ON COLUMN "transactions"."alegra_invoice_id" IS
  'Id INTERNO de Alegra. No es el consecutivo: ese va en alegra_invoice_number y lo asigna Alegra al emitir.';--> statement-breakpoint

COMMENT ON COLUMN "patients"."alegra_env" IS
  'Ambiente donde vive alegra_contact_id. Un id de sandbox NO vale en produccion; sin esta columna el paso a produccion facturaria contra contactos inexistentes.';
