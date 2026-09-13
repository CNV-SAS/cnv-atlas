-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL SELLADO ANTE LA DIAN ES UN TERCER ESTADO, Y EL CUFE SE GUARDA  ·  Bloque 2a  ·  2026-09-12
--
-- ── LO QUE ENSEÑO LA FACTURA 7 ──────────────────────────────────────────────────────────────────
--
-- Salio bien casi todo: `status: open`, consecutivo SETP990214706, dos lineas de MULTI-CELL a 90.000 de
-- base con IVA al 19% (34.200), centro de costo Vitacellebis, total 214.200. Y Atlas la guardo como
-- `emitida`, que es cierto.
--
-- PERO `stamp` VINO NULO: la factura tiene consecutivo y NO esta sellada ante la DIAN. En la pantalla de
-- Alegra eso se ve como un boton "Emitir" pendiente, y de ahi salio el reporte de que "quedo en borrador".
-- No quedo en borrador; le falta la otra mitad.
--
-- ── POR QUE HACE FALTA UN ESTADO NUEVO Y NO BASTA CON `emitida` ─────────────────────────────────
--
-- Porque `emitida` ya no distingue dos situaciones que se tratan distinto:
--
--   · con consecutivo y CON CUFE  -> el documento esta completo y no hay nada que hacer;
--   · con consecutivo y SIN CUFE  -> hay que volver, y HOY NADIE VOLVIA. La cola solo mira `pendiente` y
--     `fallida`, asi que una `emitida` sin sellar se quedaba quieta para siempre, pareciendo terminada.
--
-- Ese es el defecto de fondo: un estado que dice "listo" sobre algo a medias es peor que uno que dice
-- "fallida", porque nadie lo va a mirar.
--
-- ── Y EL CUFE NO SE ESTABA GUARDANDO EN NINGUNA PARTE ───────────────────────────────────────────
--
-- El servicio lo leia de la respuesta y lo pasaba a `registrarIntentoDeFactura`, y esa funcion NO lo
-- escribia: no habia columna. Se recibia y se tiraba, que es el mismo defecto de visibilidad de esta
-- semana, esta vez con el dato que la DIAN reconoce.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TYPE "public"."alegra_invoice_state" ADD VALUE IF NOT EXISTS 'emitida_sin_sellar';--> statement-breakpoint

ALTER TABLE "transactions"
  -- El CUFE: el identificador unico que la DIAN reconoce y el que va en el QR de la factura. Distinto del
  -- consecutivo (que lo asigna Alegra) y del id interno. Son TRES cosas y ahora cada una tiene su sitio.
  ADD COLUMN IF NOT EXISTS "alegra_cufe" text,
  -- El estado legal que devuelve la DIAN. Interesa porque no es binario: la factura de prueba del sandbox
  -- volvio como STAMPED_AND_ACCEPTED_WITH_OBSERVATIONS, o sea aceptada CON una observacion, y esa
  -- observacion se acumula factura a factura si nadie la mira.
  ADD COLUMN IF NOT EXISTS "alegra_legal_status" text;--> statement-breakpoint

COMMENT ON COLUMN "transactions"."alegra_cufe" IS
  'CUFE: lo que la DIAN reconoce. Su ausencia con `alegra_invoice_state = emitida_sin_sellar` significa que la factura tiene consecutivo y le falta el sellado.';--> statement-breakpoint

-- LA COLA PASA A SER "TODO LO QUE NO ESTA TERMINADO", y el predicado cambio por dos razones.
--
-- LA PRIMERA ES TECNICA Y LA ENSEÑO Postgres al aplicar esto: un valor de enum NO SE PUEDE USAR en la
-- misma transaccion que lo crea (55P04, "new enum values must be committed before they can be used").
-- Nombrar `emitida_sin_sellar' aqui obligaba a partir la migracion en dos.
--
-- LA SEGUNDA ES MEJOR, y es la que decide: enumerar los estados pendientes obliga a acordarse de este
-- indice cada vez que se agregue uno, y el dia que alguien lo olvide esas filas salen del barrido SIN QUE
-- NADA AVISE, que es justo lo que acaba de pasar con `emitida_sin_sellar`. Decir "todo lo que no esta
-- emitida" no hay que mantenerlo: un estado nuevo entra solo.
DROP INDEX IF EXISTS "transactions_factura_pendiente_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_factura_pendiente_idx"
  ON "transactions" ("created_at")
  WHERE "alegra_invoice_state" IS NOT NULL AND "alegra_invoice_state" <> 'emitida';
