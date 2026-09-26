-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL PACIENTE DE PRUEBA, CON QUIEN LO MARCO Y POR QUE  ·  2026-09-25
--
-- Santiago: los profesionales crean pacientes para probar, a veces ellos mismos, y Atlas va a ser el centro de
-- la data clinica, asi que hay que poder limpiarlos. Decision: PRIMERO MARCAR (carril 1), y el borrado
-- despues, porque el caso mas comun (el profesional que se creo a si mismo y corrio un diagnostico completo)
-- cae justo en lo que la base NO deja borrar: un diagnostico confirmado es una firma clinica inmutable.
--
-- ── `is_test` YA EXISTIA, Y AHI ESTABA EL PROBLEMA ──
--
-- Se respetaba en UN SOLO SITIO (gatea la facturacion: que un paciente de prueba no se facture desde
-- produccion y uno real no se facture contra sandbox). En todo lo demas contaba igual que un paciente real.
-- MARCAR SOLO EXCLUYE DONDE ALGUIEN ESCRIBIO QUE EXCLUYA, asi que el trabajo no era la casilla: era el
-- barrido. Esta migracion pone lo que faltaba para poder hacerlo con rastro.
--
-- ── QUIEN MARCA: EL PROFESIONAL PROPONE, ADMIN CONFIRMA ──
--
-- Y no es burocracia: marcar a alguien como de prueba lo SACA DE LAS CIFRAS. Si un profesional pudiera
-- marcar solo, podria esconder pacientes reales (los suyos que no cuadran, los que no quiere que se vean en su
-- conteo). Es la misma asimetria que Santiago pidio para el borrado, y por la misma razon.
--
-- La propuesta lleva MOTIVO obligatorio por la misma razon que lo lleva un permiso de auditoria: "es de
-- prueba" sin decir por que no se puede evaluar, y quien confirma tendria que adivinar.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "patients"
  -- LA PROPUESTA DEL PROFESIONAL. Nula = nadie ha propuesto nada.
  ADD COLUMN IF NOT EXISTS "test_proposed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "test_proposed_by" uuid REFERENCES "profiles"("id"),
  ADD COLUMN IF NOT EXISTS "test_proposed_reason" text,
  -- Y QUIEN LO CONFIRMO. Separado de `is_test` a proposito: el booleano dice el estado y estas dicen el acto.
  -- Sin ellas, un paciente marcado no se distingue de uno que nacio de prueba (los importados, las semillas).
  ADD COLUMN IF NOT EXISTS "test_marked_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "test_marked_by" uuid REFERENCES "profiles"("id");--> statement-breakpoint

-- UNA PROPUESTA ESTA COMPLETA O NO EXISTE. Media propuesta (fecha sin motivo) obligaria a quien confirma a
-- adivinar, y es el caso que aparece si alguien agrega la columna y olvida el campo en el formulario.
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_propuesta_de_prueba_completa";--> statement-breakpoint
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_propuesta_de_prueba_completa" CHECK (
    ("test_proposed_at" IS NULL AND "test_proposed_by" IS NULL AND "test_proposed_reason" IS NULL)
    OR ("test_proposed_at" IS NOT NULL AND "test_proposed_by" IS NOT NULL
        AND length(btrim("test_proposed_reason")) >= 5)
  );--> statement-breakpoint

ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_marca_de_prueba_completa";--> statement-breakpoint
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_marca_de_prueba_completa"
  CHECK (("test_marked_at" IS NULL) = ("test_marked_by" IS NULL));--> statement-breakpoint

-- Para listar lo que espera confirmacion sin barrer la tabla.
CREATE INDEX IF NOT EXISTS "patients_propuesta_de_prueba_idx"
  ON "patients" ("test_proposed_at")
  WHERE "test_proposed_at" IS NOT NULL AND "is_test" = false;--> statement-breakpoint

COMMENT ON COLUMN "patients"."is_test" IS
  'Paciente de prueba: SALE DE LAS CIFRAS y de lo que se exporta, pero SIGUE VISIBLE donde se trabaja (marcado), porque si no el profesional no podria usarlo para probar. Lo confirma admin; el profesional propone con motivo.';
