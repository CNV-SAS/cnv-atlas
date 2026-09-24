-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA LIQUIDACION DE COMISIONES  ·  Bloque 4 (la mitad indispensable)  ·  2026-09-24
--
-- La comision de cada venta ya se causa fila por fila en `professional_revenue` (con su tasa sellada y, si
-- se revierte, una fila NEGATIVA que apunta a la original). Lo que faltaba es el acto de PAGARLA: agrupar lo
-- causado, hacer la cuenta tributaria y dejar constancia de que eso ya se giro.
--
-- ── LA LIQUIDACION AGRUPA, NO RECALCULA ───────────────────────────────────────────────────────────
--
-- La fuente de verdad sigue siendo la fila de causacion. Una liquidacion dice QUE filas entraron y cuanto se
-- giro por ellas; no vuelve a calcular la comision de cada venta, que ya quedo sellada con la tasa de su dia.
-- Por eso la marca va en la fila (`settlement_id`) y no en una tabla de enlace: una fila se liquida UNA vez,
-- y que sea imposible liquidarla dos veces es el punto entero de este bloque.
--
-- ── Y POR ESO LAS REVERSIONES CUADRAN SOLAS ───────────────────────────────────────────────────────
--
-- D-3b-2 de contabilidad: "la comision ya liquidada se descuenta en la liquidacion siguiente". Aqui eso no
-- necesita nada especial: la fila negativa nace SIN liquidar, asi que entra en la proxima y netea. Si el
-- neteo deja el periodo en negativo, el neto es negativo, y eso tambien es correcto: es una deuda que
-- arrastra, no un giro.
--
-- ── EL PERFIL TRIBUTARIO SE SELLA ─────────────────────────────────────────────────────────────────
--
-- La tarifa de retencion, el IVA y el documento dependen del perfil del Integrante, y el perfil cambia. Una
-- liquidacion tiene que poder explicar su propia cuenta dentro de un año, asi que guarda con que perfil se
-- hizo, no un puntero al perfil de hoy. Es el mismo principio del reparto sellado en la linea de venta.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "commission_settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "professional_id" uuid NOT NULL REFERENCES "professional_profiles"("id"),
  -- Se liquida TODO lo causado sin liquidar hasta este dia (inclusive), en hora de Colombia.
  "period_to" date NOT NULL,
  "base_amount" numeric NOT NULL,
  "vat_amount" numeric NOT NULL,
  "withholding_rate" numeric NOT NULL,
  "withholding_amount" numeric NOT NULL,
  "net_amount" numeric NOT NULL,
  -- El acumulado del año DESPUES de este pago: es lo que decide la tarifa de la siguiente.
  "accumulated_year" numeric NOT NULL,
  "document_kind" text NOT NULL,
  -- El perfil con que se hizo la cuenta, sellado.
  "tax_person_type" text,
  "tax_vat_responsible" boolean,
  "tax_must_invoice" boolean,
  "created_by" uuid NOT NULL REFERENCES "profiles"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  -- Cuando se giro de verdad, y con que referencia. Nulo = calculada, todavia no pagada.
  "paid_at" timestamptz,
  "payment_reference" text,
  "notes" text,
  CONSTRAINT "settlement_documento_valido" CHECK ("document_kind" IN ('factura_del_integrante', 'documento_soporte')),
  -- Un giro sin referencia no se puede cotejar con el banco despues.
  CONSTRAINT "settlement_pago_con_referencia" CHECK (
    "paid_at" IS NULL OR ("payment_reference" IS NOT NULL AND length(trim("payment_reference")) > 0)
  )
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "settlements_professional_idx"
  ON "commission_settlements" ("professional_id", "period_to");--> statement-breakpoint

-- LA MARCA EN LA FILA CAUSADA: nula = pendiente de liquidar. Es lo que impide pagar dos veces lo mismo.
ALTER TABLE "professional_revenue"
  ADD COLUMN IF NOT EXISTS "settlement_id" uuid REFERENCES "commission_settlements"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "professional_revenue_settlement_idx"
  ON "professional_revenue" ("professional_id", "settlement_id");--> statement-breakpoint

-- UNA LIQUIDACION PAGADA NO SE BORRA: el dinero ya salio, y borrar la constancia dejaria sus filas causadas
-- libres para liquidarse otra vez, que es pagar dos veces. Una calculada y todavia no pagada si se puede
-- borrar (sus filas vuelven a quedar pendientes por el ON DELETE SET NULL de arriba).
CREATE OR REPLACE FUNCTION commission_settlement_paid_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.paid_at IS NOT NULL THEN
      RAISE EXCEPTION 'Una liquidacion ya pagada no se borra: sus comisiones quedarian pendientes y se pagarian dos veces.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.paid_at IS NOT NULL AND NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'El pago de una liquidacion, una vez registrado, no se cambia.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS commission_settlement_paid_immutable_trg ON "commission_settlements";--> statement-breakpoint
CREATE TRIGGER commission_settlement_paid_immutable_trg
  BEFORE UPDATE OR DELETE ON "commission_settlements"
  FOR EACH ROW EXECUTE FUNCTION commission_settlement_paid_immutable();
