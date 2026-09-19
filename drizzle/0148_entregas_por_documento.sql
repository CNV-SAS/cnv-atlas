-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA ENTREGA DICE QUE SE ENTREGO  ·  2026-09-18
--
-- POR QUE: Atlas pasa al modelo del archivo de Gildardo, donde cada pantalla se imprime o se envia, en vez de
-- un reporte global que su archivo no tiene. Eso deja una pregunta que hay que responder ANTES de retirar el
-- bloque de reportes: hoy la constancia legal de entrega vive en `hc_deliveries`, y por su nombre y su forma
-- solo sabe hablar de la historia clinica. Si cada hoja se entrega por su lado y solo una deja rastro, el
-- modelo nuevo PIERDE el registro en vez de ganarlo.
--
-- QUE HACE: la tabla gana `scope`, que dice QUE se entrego. Se queda con su nombre para no romper lo que ya
-- escribe y lee (renombrarla es cosmetico y costaria mas que lo que aporta hoy).
--
-- LOS VALORES son las hojas que existen: la historia clinica, el plan del paciente, el diagnostico funcional,
-- las rutas de atencion y el reporte. No se deja abierto: un `scope` libre acaba con tres nombres para lo
-- mismo y entonces no se puede contar nada.
--
-- LO YA REGISTRADO es historia clinica, y por eso ese es el valor por defecto: las filas viejas quedan bien
-- sin tocarlas.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "hc_deliveries" ADD COLUMN IF NOT EXISTS "scope" text DEFAULT 'hc' NOT NULL;--> statement-breakpoint

ALTER TABLE "hc_deliveries" DROP CONSTRAINT IF EXISTS "hc_deliveries_scope_valido";--> statement-breakpoint
ALTER TABLE "hc_deliveries" ADD CONSTRAINT "hc_deliveries_scope_valido"
  CHECK ("scope" IN ('hc', 'plan', 'diagnostico', 'rutas', 'reporte'));--> statement-breakpoint

COMMENT ON COLUMN "hc_deliveries"."scope" IS
  'Que documento se entrego. Cada hoja que sale hacia el paciente escribe aqui con su propio valor: asi el modelo por pantallas conserva la constancia de entrega en vez de perderla.';--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hc_deliveries_scope_idx"
  ON "hc_deliveries" ("evaluation_id", "scope", "delivered_at" DESC);
