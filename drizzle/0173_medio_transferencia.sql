-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA TRANSFERENCIA COMO MEDIO DE PAGO  ·  2026-09-25
--
-- ATLAS NACIO CON DOS: la pasarela (Wompi) y el efectivo. Pero antes de Atlas se cobraba por TRANSFERENCIA o
-- en efectivo, y hoy tambien se puede: el paciente consigna y el Integrante lo registra. Hasta ahora eso solo
-- se podia anotar como "efectivo", y registrar una transferencia como efectivo es justo la pequeña mentira
-- que el bloque de ventas retroactivas existe para evitar.
--
-- NO ES COSMETICO, es fiscal: el medio de pago viaja a la factura electronica (la DIAN separa efectivo de
-- transferencia debito) y decide contra que cuenta se registra el pago en Alegra. Una factura que declara
-- efectivo cuando hubo transferencia dice algo falso, y el dinero queda apuntado a la cuenta equivocada.
--
-- VA SOLO EN SU MIGRACION porque `ALTER TYPE ... ADD VALUE` no corre dentro de una transaccion, ni se puede
-- USAR el valor recien creado en ella. Lo que lo usa va en la siguiente.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'transferencia';
