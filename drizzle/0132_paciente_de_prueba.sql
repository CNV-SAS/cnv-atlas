-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL PACIENTE DE PRUEBA SE DISTINGUE DEL REAL  ·  Bloque 2a  ·  2026-09-12
--
-- ── LA REGLA QUE ESTO CONVIERTE EN MECANISMO ────────────────────────────────────────────────────
--
-- Santiago la escribio hoy: "a sandbox no van datos de pacientes reales, aunque sean solo identificacion
-- y contacto". Es correcta y hasta ahora era una promesa.
--
-- POR QUE NO BASTA LA PROMESA, y es concreto, no hipotetico: el smoke del Bloque 2a corre contra el
-- PREVIEW, y el preview usa LA MISMA BASE que produccion, con 73 pacientes reales. Una venta de prueba
-- hecha con el paciente equivocado mandaria su nombre, su documento y su correo al sandbox de Alegra, y
-- nadie se enteraria: la venta saldria bien.
--
-- Y AL REVES TAMBIEN IMPORTA, que es lo que hace la regla simetrica: facturar a un paciente de prueba
-- desde produccion emitiria un documento fiscal REAL, con consecutivo real, a nombre de una persona que
-- no existe. Eso no se arregla borrando: se arregla con una nota credito.
--
-- Asi que la bandera no gatea "el ambiente de prueba": gatea que el PACIENTE y el AMBIENTE se
-- correspondan, en las dos direcciones.
--
-- ── POR QUE UNA COLUMNA Y NO DEDUCIRLO DEL PROFESIONAL ──────────────────────────────────────────
--
-- Se penso en gatear por "es paciente de una cuenta demo", y no sirve: las cuentas demo pueden atender a
-- alguien real (ha pasado), y un paciente puede reasignarse. Lo de prueba es una propiedad del paciente,
-- declarada, no deducida de con quien esta. Es la misma decision que se tomo para el catalogo con
-- `nutraceuticals.is_test`, aplicada donde de verdad hay PII.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "is_test" boolean NOT NULL DEFAULT false;--> statement-breakpoint

COMMENT ON COLUMN "patients"."is_test" IS
  'Paciente de PRUEBA. Gatea la facturacion en las dos direcciones: uno de prueba no se factura desde produccion (seria un documento fiscal real a nombre de nadie) y uno real no se factura contra sandbox (su identidad viajaria a un ambiente de pruebas).';--> statement-breakpoint

-- NO SE MARCA NADA AUTOMATICAMENTE. Marcar por heuristica (documento corto, nombre con "demo") acertaria
-- en casi todos y fallaria en alguno, y el que falle es justo el que no se quiere equivocar. Santiago
-- marca los que va a usar, y mientras tanto NINGUNO se puede facturar contra sandbox, que es el lado
-- seguro de estar equivocado.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "patients";
  RAISE NOTICE 'Pacientes en la base: %. Ninguno queda marcado como de prueba: hay que marcarlos a mano antes del smoke.', n;
END $$;
