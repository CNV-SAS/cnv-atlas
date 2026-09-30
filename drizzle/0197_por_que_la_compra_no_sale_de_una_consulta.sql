-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- POR QUE UNA COMPRA NO SALE DE NINGUNA CONSULTA  ·  2026-09-29
--
-- EL HUECO, planteado por Santiago: una venta hecha en Tratamiento guarda su `treatment_id` y por el llega al
-- diagnostico y a la evaluacion. Una hecha en /pagos nacia SIN NADA, y /pagos existe justamente para el
-- paciente que vuelve solo a comprar: la compra que MAS dice sobre si el producto le sirvio era la unica que
-- no se podia cruzar con nada.
--
-- ── POR QUE NO BASTA CON EXIGIR EL TRATAMIENTO ──
--
-- Una compra sin consulta es un hecho LEGITIMO: alguien compra de mostrador, o le repone a un familiar.
-- Obligar a elegir una consulta para poder cobrar produce lo peor de los dos mundos: el profesional elige
-- cualquiera, y ese dato malo se ve IGUAL que uno bueno. Nadie lo va a poder distinguir despues.
--
-- Asi que lo obligatorio no es el tratamiento: es DECIR POR QUE NO HAY UNO. Con el motivo escrito, una venta
-- suelta sigue siendo analizable ("compra de mostrador" no es lo mismo que "no sabia que elegir"), y el dato
-- clinico no queda contaminado con vinculos inventados.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "sin_tratamiento_motivo" text;--> statement-breakpoint

-- O SALE DE UNA CONSULTA, O SE DICE POR QUE NO. Las dos a la vez no: un motivo junto a un tratamiento es un
-- texto que contradice al vinculo, y el dia que alguien los cruce no sabra a cual creerle.
ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_motivo_solo_sin_tratamiento";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_motivo_solo_sin_tratamiento" CHECK (
    "sin_tratamiento_motivo" IS NULL OR "treatment_id" IS NULL
  );--> statement-breakpoint

COMMENT ON COLUMN "transactions"."sin_tratamiento_motivo" IS
  'Por que esta compra no sale de ninguna consulta. Lo obligatorio no es el tratamiento (una compra de mostrador es legitima), es DECIR por que no hay uno: sin el motivo, una venta suelta y una mal atada se ven iguales. Nulo en las anteriores a la 0197.';
