-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- QUIEN REGISTRO LA VENTA  ·  2026-09-29
--
-- LO PIDIO SANTIAGO EN EL SMOKE: una venta hecha desde admin no se distingue de una del profesional.
--
-- POR QUE NO SE PODIA SABER: `transactions.professional_id` es de QUIEN LE CORRESPONDE LA COMISION, no de
-- quien tecleo. Cuando un administrador cobra por un paciente, el sellado le pone el profesional ASIGNADO al
-- paciente, que es lo correcto para el dinero y deja el registro sin decir quien la hizo.
--
-- Y ESO IMPORTA MAS DE LO QUE PARECE: si una venta sale mal, la pregunta es a quien se le pregunta. Con la
-- columna vacia hay que adivinar; con ella, la pantalla lo dice. Es el mismo criterio que ya rige para la
-- venta retroactiva, que si guarda `registered_retroactively_by`.
--
-- NULO = las de antes de esta migracion. No se inventa un autor: no se sabe, y eso es lo que dice.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint

COMMENT ON COLUMN "transactions"."created_by" IS
  'Quien REGISTRO la venta, que no siempre es el profesional que se lleva la comision: un administrador puede cobrar por el paciente de otro. Nulo en las anteriores a la 0193.';
