-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- "NO PRESCRIBO NUTRACEUTICOS" ES UN HECHO DISTINTO DE "EL PACIENTE NO LOS ADQUIERE"  ·  2026-10-10
--
-- ═══ DE DONDE SALE (Santiago, reunion con la integrante que mas vende) ═══
--
-- Textual suyo: *"una cosa es prescribir un producto, que basicamente eso lo hacen los integrantes, y otra
-- cosa es que el paciente quiera comprar o no quiera comprar algun producto."*
--
-- Y la segunda mitad del argumento, que es la que decide: *"no me parece correcto registrar por que un
-- paciente no se lleva un producto cuando puede ser por precio y muchas razones"*, y ademas puede comprarlo
-- despues.
--
-- ═══ POR QUE EL CAMPO VIEJO MEDIA LO QUE NO SERVIA ═══
--
-- `nutraceutical_decision = 'no'` pregunta si el PACIENTE adquiere, y eso Atlas YA LO SABE POR UN HECHO: la
-- pantalla de Direccion mide "comprado en N consultas" desde las VENTAS. Un campo que pregunta lo mismo y lo
-- responde de memoria solo puede contradecir a la venta, y ya paso: el aviso "despues, el dia X, si compro"
-- existe porque la nota y la venta se contradecian.
--
-- LO QUE NO TENEMOS POR NINGUN LADO es el criterio clinico: que el profesional evaluo y decidio NO
-- prescribir. Eso no deja rastro en ninguna otra parte, y es lo que de verdad alimenta la investigacion (que
-- el modelo recomiende algo y el profesional no lo prescriba ES el dato).
--
-- ═══ POR QUE UN CAMPO NUEVO Y NO REUSAR EL VIEJO (decision de Santiago: la opcion (a)) ═══
--
-- Hay consultas cerradas con el motivo viejo. Reusar el campo haria que ese historico PASARA A LEERSE como
-- criterio clinico cuando era otra cosa, y lo que se registra aqui entra en la investigacion: reinterpretarlo
-- ensucia justo lo que el campo existe para medir.
--
-- Su razon, textual: *"lo que se registra aqui entra en la investigacion, asi que reinterpretar el historico
-- ensucia justo lo que el campo existe para medir."*
--
-- ASI QUE EL VIEJO SE CONGELA, NO SE BORRA: sigue diciendo lo que decia, y su comentario lo deja escrito para
-- que nadie lo confunda con el nuevo. Es el mismo criterio que con los consentimientos del HTML.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "treatments"
  ADD COLUMN IF NOT EXISTS "sin_prescripcion_motivo" text;--> statement-breakpoint
ALTER TABLE "treatments"
  ADD COLUMN IF NOT EXISTS "sin_prescripcion_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "treatments"
  ADD COLUMN IF NOT EXISTS "sin_prescripcion_by" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- LOS TRES VAN JUNTOS O NO VA NINGUNO: un motivo sin autor no dice quien decidio, y una fecha sin motivo no
-- dice nada. Es la misma forma que el retiro de una consulta (0212), por la misma razon.
ALTER TABLE "treatments"
  DROP CONSTRAINT IF EXISTS "treatments_sin_prescripcion_completa";--> statement-breakpoint
ALTER TABLE "treatments"
  ADD CONSTRAINT "treatments_sin_prescripcion_completa" CHECK (
    ("sin_prescripcion_motivo" IS NULL AND "sin_prescripcion_at" IS NULL AND "sin_prescripcion_by" IS NULL)
    OR ("sin_prescripcion_motivo" IS NOT NULL AND "sin_prescripcion_at" IS NOT NULL
        AND "sin_prescripcion_by" IS NOT NULL AND length(btrim("sin_prescripcion_motivo")) >= 5)
  );--> statement-breakpoint

COMMENT ON COLUMN "treatments"."sin_prescripcion_motivo" IS
  'EL CRITERIO CLINICO: el profesional evaluo y decidio NO prescribir nutraceuticos, con su razon. Es un hecho del PROFESIONAL, distinto de si el paciente compro o no (eso lo dicen las ventas). Desde 2026-10-10.';--> statement-breakpoint

COMMENT ON COLUMN "treatments"."nutraceutical_decision" IS
  'CONGELADO el 2026-10-10. Registraba si el PACIENTE adquiria los nutraceuticos, que es un hecho que las VENTAS ya responden y que ademas puede cambiar despues (puede comprarlos la semana siguiente). Lo reemplaza `sin_prescripcion_motivo`, que registra otra cosa: el criterio clinico de no prescribir. Lo escrito antes NO se reinterpreta: sigue significando lo que significaba cuando se escribio.';
