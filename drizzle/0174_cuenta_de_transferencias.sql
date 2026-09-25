-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA CUENTA PUENTE DE LAS TRANSFERENCIAS  ·  2026-09-25
--
-- El pago se registra en Alegra contra una cuenta PUENTE segun el canal (0131). Con la transferencia como
-- medio nuevo hace falta la suya, y NO se hereda la del efectivo: "Efectivo en poder de Integrantes" dice
-- que la plata esta en el bolsillo de alguien, y una transferencia ya llego a una cuenta. Apuntarla ahi
-- seria decir que un dinero que ya esta en el banco sigue por recoger.
--
-- NULA A PROPOSITO, y esto es lo que decide el comportamiento: mientras contabilidad no diga cual es, una
-- venta por transferencia SE REGISTRA BIEN (el medio queda escrito y el reporte la cuenta) pero su factura
-- ESPERA, con el motivo a la vista en el panel de facturacion. La alternativa seria facturarla contra la
-- cuenta del efectivo, que es exactamente la mentira que este medio viene a quitar.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "alegra_config"
  ADD COLUMN IF NOT EXISTS "bank_account_transferencia_id" text;--> statement-breakpoint

COMMENT ON COLUMN "alegra_config"."bank_account_transferencia_id" IS
  'Cuenta PUENTE de las transferencias. NULA = no configurada: la venta se registra, su factura espera y el panel dice por que. No se hereda la del efectivo: esa dice que la plata esta en el bolsillo del Integrante.';
