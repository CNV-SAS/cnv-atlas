-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL CARGO POR FALTANTE LLEGA A LA LIQUIDACION  ·  2026-09-28
--
-- EL HUECO, encontrado al revisar lo comercial: un faltante clasificado INJUSTIFICADO materializa su
-- `charge_status = pendiente_liquidacion`... y NADIE LO COBRA. Se comprobo: esa columna solo se LEE para
-- mostrarla en pantalla; la liquidacion no la mira. Asi que el cargo existia y el Integrante nunca se le
-- descontaba, aunque la Clausula 5.5 diga que entra en la liquidacion del periodo y se cruza contra la comision.
--
-- ── LO QUE FALTABA ES EL MISMO MECANISMO QUE YA IMPIDE PAGAR DOS VECES UNA COMISION ──
--
-- `professional_revenue.settlement_id` (0171) es lo que hace que una comision no se pague dos veces: nula =
-- pendiente, con valor = ya se fue en esa liquidacion. El cargo necesita exactamente eso, por la misma razon y
-- con mas peso: cobrar dos veces el mismo frasco es cobrarle a una persona una deuda que ya pago.
--
-- Y SIRVE EN LAS DOS DIRECCIONES, como en las comisiones: si el cargo se anula despues de liquidado, la fila
-- queda con su liquidacion y el ajuste entra en la siguiente, sin reescribir la que ya se giro.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "nutraceutical_faltante_cases"
  ADD COLUMN IF NOT EXISTS "settlement_id" uuid REFERENCES "commission_settlements"("id") ON DELETE SET NULL;--> statement-breakpoint

-- SOLO UN CARGO MATERIALIZADO PUEDE ENTRAR EN UNA LIQUIDACION. Un caso justificado no tiene nada que cobrar, y
-- meterlo seria descontarle al Integrante por algo que CNV le acepto.
ALTER TABLE "nutraceutical_faltante_cases"
  DROP CONSTRAINT IF EXISTS "faltante_liquidado_solo_con_cargo";--> statement-breakpoint
ALTER TABLE "nutraceutical_faltante_cases"
  ADD CONSTRAINT "faltante_liquidado_solo_con_cargo" CHECK (
    "settlement_id" IS NULL OR "charge_status" <> 'sin_cargo'
  );--> statement-breakpoint

-- Para encontrar lo pendiente de un integrante sin barrer la tabla.
CREATE INDEX IF NOT EXISTS "faltante_pendiente_de_liquidar_idx"
  ON "nutraceutical_faltante_cases" ("professional_id")
  WHERE "settlement_id" IS NULL AND "charge_status" <> 'sin_cargo';--> statement-breakpoint

COMMENT ON COLUMN "nutraceutical_faltante_cases"."settlement_id" IS
  'La liquidacion que se llevo este cargo. Nula = pendiente de cobrar. Es lo que impide cobrar dos veces el mismo frasco, igual que professional_revenue.settlement_id con la comision.';
