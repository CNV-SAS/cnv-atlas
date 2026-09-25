-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UNA FILA SE REVIERTE UNA VEZ POR CASO, NO UNA VEZ EN LA VIDA  ·  2026-09-25
--
-- LO QUE SE ENCONTRO AL CONSTRUIR LA DEVOLUCION CON SU DINERO: la 0142 puso "una fila se revierte una sola
-- vez" (indice unico sobre `reversal_of`), y era cierto mientras la unica reversion fuera TOTAL: un efectivo
-- que no entro o un contracargo perdido se llevan la venta entera, y dos veces seria robarle al integrante.
--
-- UNA DEVOLUCION NO ES TOTAL NI ES UNICA. El paciente compra dos y devuelve una hoy; la semana entrante
-- devuelve la otra. Son dos reversiones PARCIALES sobre la misma fila de ingreso, y con el indice viejo la
-- segunda choca: "duplicate key value violates unique constraint".
--
-- ── LA FORMA QUE LO RESUELVE SIN AFLOJAR NADA ─────────────────────────────────────────────────────
--
-- El negativo pasa a decir DE QUE CASO sale (`sale_reversal_id`), y la unicidad se vuelve por caso:
--
--   · una reversion sin caso (las de antes) sigue siendo UNA por fila. La regla de la 0142 intacta.
--   · una reversion CON caso es una por (fila, caso): el mismo caso no puede revertir dos veces la misma
--     fila, y dos devoluciones distintas si pueden tocarla, cada una por su parte.
--
-- Y ADEMAS SE GANA TRAZA: hasta hoy un negativo decia QUE revertia pero no POR QUE. Con el caso al lado, la
-- pregunta "de donde salio este menos treinta mil" se responde leyendo la fila.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "professional_revenue"
  ADD COLUMN IF NOT EXISTS "sale_reversal_id" uuid REFERENCES "sale_reversals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "cnv_revenue"
  ADD COLUMN IF NOT EXISTS "sale_reversal_id" uuid REFERENCES "sale_reversals"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- Solo un negativo lleva caso: una fila de ingreso original no sale de ninguna reversion.
ALTER TABLE "professional_revenue" DROP CONSTRAINT IF EXISTS "prof_revenue_caso_solo_en_reversion";--> statement-breakpoint
ALTER TABLE "professional_revenue"
  ADD CONSTRAINT "prof_revenue_caso_solo_en_reversion"
  CHECK ("sale_reversal_id" IS NULL OR "reversal_of" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "cnv_revenue" DROP CONSTRAINT IF EXISTS "cnv_revenue_caso_solo_en_reversion";--> statement-breakpoint
ALTER TABLE "cnv_revenue"
  ADD CONSTRAINT "cnv_revenue_caso_solo_en_reversion"
  CHECK ("sale_reversal_id" IS NULL OR "reversal_of" IS NOT NULL);--> statement-breakpoint

DROP INDEX IF EXISTS "professional_revenue_reversal_unica";--> statement-breakpoint
DROP INDEX IF EXISTS "cnv_revenue_reversal_unica";--> statement-breakpoint

-- SIN CASO: una por fila, como en la 0142.
CREATE UNIQUE INDEX IF NOT EXISTS "professional_revenue_reversal_unica_sin_caso"
  ON "professional_revenue" ("reversal_of")
  WHERE "reversal_of" IS NOT NULL AND "sale_reversal_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cnv_revenue_reversal_unica_sin_caso"
  ON "cnv_revenue" ("reversal_of")
  WHERE "reversal_of" IS NOT NULL AND "sale_reversal_id" IS NULL;--> statement-breakpoint

-- CON CASO: una por (fila, caso). El mismo caso no revierte dos veces lo mismo.
CREATE UNIQUE INDEX IF NOT EXISTS "professional_revenue_reversal_unica_por_caso"
  ON "professional_revenue" ("reversal_of", "sale_reversal_id")
  WHERE "sale_reversal_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cnv_revenue_reversal_unica_por_caso"
  ON "cnv_revenue" ("reversal_of", "sale_reversal_id")
  WHERE "sale_reversal_id" IS NOT NULL;
