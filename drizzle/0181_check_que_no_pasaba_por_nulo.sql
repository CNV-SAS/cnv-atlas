-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UN CHECK QUE NO COMPROBABA NADA, POR UN NULO  ·  2026-09-25
--
-- LO ENCONTRO SU PROPIO CANDADO, antes de que llegara a la nube. La 0180 escribio esto para que una propuesta
-- de "paciente de prueba" estuviera completa o no existiera:
--
--   CHECK ( (at IS NULL AND by IS NULL AND reason IS NULL)
--        OR (at IS NOT NULL AND by IS NOT NULL AND length(btrim(reason)) >= 5) )
--
-- Y CON `reason` NULO NO RECHAZA. La cuenta en logica de tres valores:
--
--   · primera rama: false (at no es nulo);
--   · segunda rama: `length(btrim(NULL))` es NULL, asi que el AND entero es NULL;
--   · false OR NULL = NULL, y UN CHECK QUE EVALUA A NULL PASA. Postgres solo rechaza el false.
--
-- Asi que "media propuesta" (fecha y autor, sin motivo) entraba sin quejarse, y quien tuviera que confirmarla
-- se quedaria sin el unico dato con el que puede decidir.
--
-- ── LA LECCION, QUE VALE PARA TODO CHECK QUE USE UNA FUNCION ──
--
-- Casi toda funcion devuelve NULL si su argumento es NULL, asi que un CHECK que compare el resultado de una
-- funcion NECESITA su propio `IS NOT NULL` antes. No basta con que la otra rama lo cubra: las ramas se combinan
-- con OR, y un NULL en una se lleva el resultado entero.
--
-- SE ARREGLA CON UNA MIGRACION NUEVA Y NO EDITANDO LA 0180, aunque todavia no este en la nube: ya esta aplicada
-- en local, y editarla dejaria el archivo diciendo una cosa y la base local otra, sin que drizzle vuelva a
-- correrla. Es exactamente el silencio que la regla forward-only evita.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_propuesta_de_prueba_completa";--> statement-breakpoint
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_propuesta_de_prueba_completa" CHECK (
    ("test_proposed_at" IS NULL AND "test_proposed_by" IS NULL AND "test_proposed_reason" IS NULL)
    OR ("test_proposed_at" IS NOT NULL AND "test_proposed_by" IS NOT NULL
        AND "test_proposed_reason" IS NOT NULL
        AND length(btrim("test_proposed_reason")) >= 5)
  );
