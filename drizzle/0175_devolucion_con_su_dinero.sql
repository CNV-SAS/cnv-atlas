-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA DEVOLUCION TAMBIEN MUEVE EL DINERO  ·  2026-09-25
--
-- LO QUE EL SMOKE DESTAPO: Santiago devolvio un producto, lo reincorporo al inventario, y la liquidacion
-- seguia con la comision entera y el historial seguia diciendo "Pagado". El producto volvia y el ingreso se
-- quedaba, asi que la devolucion estaba a medias.
--
-- Se habia diferido al bloque 6 porque el RETRACTO se activa por venta a distancia (§5.7) y el domicilio no
-- existe. Pero una devolucion por otra causa (garantia, producto defectuoso, o simplemente porque CNV la
-- acepta) puede pasar hoy, y el smoke lo demostro registrando una.
--
-- ── NO SE ESCRIBE UNA MAQUINA NUEVA ───────────────────────────────────────────────────────────────
--
-- La reversa de la sesion 1 ya revierte ingreso y comision con filas NEGATIVAS que apuntan a las originales,
-- y ya lleva su nota credito manual. Lo que faltaba era admitir esta clase de caso.
--
-- ── Y TRES DIFERENCIAS CON UN CONTRACARGO, QUE SON LAS QUE DECIDEN EL DISEÑO ───────────────────────
--
--   1. NO ES UNA DISPUTA: no hay banco al que responderle ni resultado que esperar. Nace y se resuelve en el
--      mismo acto (el producto ya volvio), asi que su estado es 'devuelta' y no pasa por 'abierta'.
--   2. ES PROPORCIONAL: se devuelven UNIDADES de una LINEA, no la venta entera. Si el paciente compro dos y
--      devuelve una, se revierte la mitad de esa linea. Por eso la reversa guarda contra que linea y cuantas
--      unidades, y por eso el monto NO se recalcula: sale del reparto ya SELLADO en la linea.
--   3. PUEDE HABER VARIAS sobre la misma venta (una unidad hoy, otra la semana entrante), asi que no cabe
--      bajo el indice de "una sola abierta por venta". No estorba: ese indice solo mira las abiertas.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "sale_reversals" DROP CONSTRAINT IF EXISTS "sale_reversals_kind_valido";--> statement-breakpoint
ALTER TABLE "sale_reversals"
  ADD CONSTRAINT "sale_reversals_kind_valido"
  CHECK ("kind" IN ('contracargo', 'anulacion_wompi', 'devolucion'));--> statement-breakpoint

ALTER TABLE "sale_reversals" DROP CONSTRAINT IF EXISTS "sale_reversals_estado_valido";--> statement-breakpoint
ALTER TABLE "sale_reversals"
  ADD CONSTRAINT "sale_reversals_estado_valido"
  CHECK ("state" IN ('abierta', 'ganada', 'perdida', 'devuelta'));--> statement-breakpoint

-- CONTRA QUE LINEA Y CUANTAS UNIDADES. Es lo que hace la reversion proporcional y verificable: con la linea
-- se puede rehacer la cuenta desde su reparto sellado, y con las unidades se sabe que parte se devolvio.
ALTER TABLE "sale_reversals"
  ADD COLUMN IF NOT EXISTS "transaction_item_id" uuid REFERENCES "transaction_items"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "returned_quantity" integer;--> statement-breakpoint

-- UNA DEVOLUCION SIN SU LINEA Y SU CANTIDAD NO SE PUEDE CUADRAR, y una de otra clase no las lleva: son de
-- esta. El estado 'devuelta' es solo de esta clase, y esta clase no pasa por 'abierta' (no hay nada que
-- esperar: el producto ya volvio).
ALTER TABLE "sale_reversals" DROP CONSTRAINT IF EXISTS "sale_reversals_devolucion_completa";--> statement-breakpoint
ALTER TABLE "sale_reversals"
  ADD CONSTRAINT "sale_reversals_devolucion_completa" CHECK (
    ("kind" = 'devolucion' AND "state" = 'devuelta' AND "transaction_item_id" IS NOT NULL
      AND "returned_quantity" IS NOT NULL AND "returned_quantity" > 0)
    OR ("kind" <> 'devolucion' AND "state" <> 'devuelta' AND "transaction_item_id" IS NULL
      AND "returned_quantity" IS NULL)
  );--> statement-breakpoint

-- LA NOTA CREDITO TAMBIEN APLICA A UNA DEVOLUCION: la factura ya se emitio y hay que corregirla. Antes la
-- regla decia "solo si perdida", que era cierto cuando la unica reversion economica era un contracargo.
ALTER TABLE "sale_reversals" DROP CONSTRAINT IF EXISTS "sale_reversals_nota_credito_solo_si_perdida";--> statement-breakpoint
ALTER TABLE "sale_reversals"
  ADD CONSTRAINT "sale_reversals_nota_credito_con_reversion" CHECK (
    "credit_note_manual_number" IS NULL OR "state" IN ('perdida', 'devuelta')
  );
