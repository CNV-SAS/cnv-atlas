-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA NOTA CREDITO ELECTRONICA Y LAS DOS CUENTAS PUENTE  ·  Bloque 2a  ·  2026-09-12
--
-- Leido del sandbox por API el 2026-09-12, igual que el resto del mapa.
--
-- ── LA NOTA CREDITO ─────────────────────────────────────────────────────────────────────────────
--
-- Plantilla 17, "NOTA CREDITO ELECTRONICA", prefijo NTC, `isElectronic: true`, preferida. Sustituye a la
-- 2, que NO es electronica y que por eso se habia dejado en nulo: una nota credito no electronica contra
-- una factura electronica no es lo que la DIAN espera.
--
-- Y VA SIEMPRE CON REFERENCIA A LA FACTURA ORIGINAL. Es regla de contabilidad y tambien un detector: en
-- este flujo una nota credito SIN referencia significaria que algo se rompio, no que se emitio suelta.
-- Por eso el identificador de la factura original no es opcional en el payload.
--
-- ── LAS CUENTAS PUENTE, Y POR QUE NO ES BANCOLOMBIA ─────────────────────────────────────────────
--
-- Cuando Atlas registra el pago, LA PLATA TODAVIA NO ESTA EN EL BANCO: esta en el bolsillo del Integrante
-- o retenida en Wompi. Registrarla contra Bancolombia diria que llego cuando no ha llegado, y el banco
-- dejaria de cuadrar contra el extracto.
--
--   Efectivo               -> "Efectivo en poder de Integrantes" (cuenta 5)
--   Pasarela (Wompi)       -> "Wompi por liquidar"               (cuenta 6)
--   Quincenal al Integrante (modalidad Distribucion) -> NINGUNA: queda por cobrar de verdad
--
-- SIEMPRE POR EL VALOR BRUTO. La comision de la pasarela es un gasto de CNV y no se descuenta de la
-- factura al paciente: restarla aqui haria que la factura dijera que el paciente pago menos de lo que
-- pago.
--
-- EL ALCANCE DE ATLAS TERMINA AHI. El traslado a Bancolombia (cuando el Integrante consigna o Wompi
-- desembolsa) lo registra contabilidad en Alegra. Atlas no lo hace y no debe hacerlo.
--
-- Y ESO HABILITA DOS CONCILIACIONES que valen porque cruzan fuentes INDEPENDIENTES:
--   · saldo de "Efectivo en poder de Integrantes" en Alegra  vs  pendiente de consignar segun Atlas
--   · saldo de "Wompi por liquidar" en Alegra                vs  cobrado sin desembolsar segun Atlas
-- Dos sistemas que no se copian entre si y que tienen que dar lo mismo. Anotadas en el Bloque 4.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "alegra_config"
  -- Cuenta destino del pago segun el CANAL. Las dos son cuentas PUENTE, nunca el banco.
  ADD COLUMN IF NOT EXISTS "bank_account_efectivo_id" text,
  ADD COLUMN IF NOT EXISTS "bank_account_pasarela_id" text;--> statement-breakpoint

UPDATE "alegra_config"
   SET "credit_note_template_id" = '17',
       "bank_account_efectivo_id" = '5',   -- "Efectivo en poder de Integrantes" (tipo cash)
       "bank_account_pasarela_id" = '6',   -- "Wompi por liquidar"               (tipo cash)
       "note" = 'Leido del sandbox por API el 2026-09-12. Nota credito: plantilla 17 (NTC, electronica), siempre con referencia a la factura original. Pago contra cuentas PUENTE por el valor BRUTO, nunca contra el banco: cuando Atlas registra, la plata no ha llegado. El traslado a Bancolombia lo hace contabilidad.',
       "updated_at" = now()
 WHERE "env" = 'sandbox';--> statement-breakpoint

-- A partir de aqui las dos cuentas son obligatorias en cualquier ambiente que se configure: sin ellas no
-- se puede registrar el pago, y una factura emitida sin pago registrado es la cuenta por cobrar falsa que
-- todo esto viene a evitar.
ALTER TABLE "alegra_config"
  ALTER COLUMN "bank_account_efectivo_id" SET NOT NULL,
  ALTER COLUMN "bank_account_pasarela_id" SET NOT NULL;--> statement-breakpoint

COMMENT ON COLUMN "alegra_config"."bank_account_efectivo_id" IS
  'Cuenta PUENTE "Efectivo en poder de Integrantes". No es el banco: la plata esta en el bolsillo del Integrante hasta que consigne.';--> statement-breakpoint

COMMENT ON COLUMN "alegra_config"."bank_account_pasarela_id" IS
  'Cuenta PUENTE "Wompi por liquidar". Se abona el BRUTO; la comision de la pasarela es gasto de CNV y no se descuenta de la factura al paciente.';
