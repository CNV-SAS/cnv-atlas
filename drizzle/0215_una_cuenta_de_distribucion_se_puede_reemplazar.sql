-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UNA CUENTA DE DISTRIBUCION SE PUEDE REEMPLAZAR DE VERDAD  ·  2026-10-12
--
-- EL DEFECTO (segundo smoke, parte 10): Santiago emitio la cuenta del corte, registro otra venta y al
-- emitir otra vez salio "No se pudo emitir la cuenta" con `duplicate key` contra
-- `distribucion_statements_una_viva_por_corte`.
--
-- ── Y LA CAUSA DE FONDO NO ERA LA SEGUNDA VENTA ───────────────────────────────────────────────────
--
-- La 0188 diseño la re-emision y la dejo SIN CABLEAR: su comentario dice "un corte re-emitido tras una
-- objecion tiene dos filas, y solo una sigue viva", el indice unico es parcial sobre `replaced_by_id IS
-- NULL`, y NINGUNA ruta del codigo escribe esa columna. O sea que el corte no se podia re-emitir por
-- ningun camino, y eso incluye el que el modelo EXIGE: `resolverObjecion('corregida')` libera las ventas
-- "para que el corte se pueda volver a emitir" y la re-emision choca con la misma llave.
--
-- Asi que el paso 6 de la parte 10 del smoke (objetar y "darle la razon y rehacerla") iba a reventar
-- igual. No se corrio porque el smoke se topo antes con el paso 4.
--
-- ── POR QUE HACE FALTA UNA COLUMNA Y NO BASTA CABLEAR `replaced_by_id` ────────────────────────────
--
-- Por el orden de las operaciones. Para que la nueva fila quepa en el indice, la vieja tiene que dejar de
-- estar viva ANTES de insertarla; pero `replaced_by_id` apunta a la nueva, que todavia no existe, y su FK
-- no es diferida. Es un circulo que no se rompe con el esquema de la 0188.
--
-- La salida separa el HECHO del PUNTERO, que ademas son dos cosas distintas:
--
--   · `superseded_at` dice QUE dejo de estar viva, y es lo que el indice mira. Se escribe primero.
--   · `replaced_by_id` dice POR CUAL, y se escribe despues, cuando la nueva ya existe.
--
-- Y la separacion abre la otra puerta que hacia falta: una cuenta se puede ANULAR sin reemplazo
-- (`superseded_reason = 'anulada'`, `replaced_by_id` nulo). Hoy no habia ninguna forma de retirar una
-- cuenta emitida por error, que es lo que el arranque a produccion necesita para las de prueba.
--
-- MISMA FORMA QUE `evaluations.superseded_at`: el nombre se repite a proposito, porque es el mismo
-- concepto (un registro que no se edita, se reemplaza) y conviene que se lea igual en los dos sitios.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. EL HECHO: DEJO DE ESTAR VIVA ───
ALTER TABLE "distribucion_statements"
  ADD COLUMN IF NOT EXISTS "superseded_at" timestamptz;--> statement-breakpoint
ALTER TABLE "distribucion_statements"
  ADD COLUMN IF NOT EXISTS "superseded_reason" text;--> statement-breakpoint

COMMENT ON COLUMN "distribucion_statements"."superseded_at" IS
  'Cuando esta cuenta dejo de estar viva. Es lo que mira el indice de una sola cuenta por corte. Nula = es la cuenta vigente de su corte.';--> statement-breakpoint
COMMENT ON COLUMN "distribucion_statements"."superseded_reason" IS
  'reemplazada = se re-emitio el corte (replaced_by_id apunta a la nueva) | anulada = se retiro sin reemplazo.';--> statement-breakpoint

-- LAS DOS COLUMNAS VAN JUNTAS, y 'reemplazada' EXIGE el puntero: una cuenta que dice haber sido
-- reemplazada y no dice por cual deja al Integrante sin poder seguir el rastro de su propia factura.
ALTER TABLE "distribucion_statements"
  DROP CONSTRAINT IF EXISTS "distribucion_statements_retiro_coherente";--> statement-breakpoint
ALTER TABLE "distribucion_statements"
  ADD CONSTRAINT "distribucion_statements_retiro_coherente" CHECK (
    ("superseded_at" IS NULL) = ("superseded_reason" IS NULL)
    AND ("superseded_reason" IS NULL OR "superseded_reason" IN ('reemplazada', 'anulada'))
    AND ("replaced_by_id" IS NULL OR "superseded_reason" = 'reemplazada')
  );--> statement-breakpoint

-- ─── 2. BACKFILL ───
-- Hoy no hay ninguna fila con `replaced_by_id` (no la escribe nadie, que es el defecto), asi que esto no
-- toca nada. Va igual, porque un backfill que se omite por estar vacio hoy es el que falta el dia que la
-- migracion corre contra otra base.
UPDATE "distribucion_statements"
   SET "superseded_at" = "emitted_at", "superseded_reason" = 'reemplazada'
 WHERE "replaced_by_id" IS NOT NULL AND "superseded_at" IS NULL;--> statement-breakpoint

-- ─── 3. EL INDICE AHORA MIRA EL HECHO, NO EL PUNTERO ───
-- UNA CUENTA VIVA POR INTEGRANTE Y CORTE sigue siendo la regla. Lo que cambia es como se reconoce a la
-- que ya no esta viva: por `superseded_at`, que se puede escribir antes de que exista su reemplazo.
DROP INDEX IF EXISTS "distribucion_statements_una_viva_por_corte";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "distribucion_statements_una_viva_por_corte"
  ON "distribucion_statements" ("professional_id", "corte_hasta")
  WHERE "superseded_at" IS NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "distribucion_statements_pendientes_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "distribucion_statements_pendientes_idx"
  ON "distribucion_statements" ("professional_id")
  WHERE "paid_at" IS NULL AND "superseded_at" IS NULL;--> statement-breakpoint

-- ─── 4. UNA CUENTA RETIRADA NO VUELVE A LA VIDA, Y UNA PAGADA NO SE RETIRA ───
-- Lo primero porque el retiro es el hecho de que el Integrante recibio otra factura en su lugar; deshacerlo
-- dejaria dos cuentas vivas del mismo corte sin que el indice lo note (las dos pasarian a `superseded_at`
-- nulo en momentos distintos). Lo segundo porque retirar una cuenta ya pagada dejaria un pago registrado
-- contra un documento que dice no existir, y la plata ya se movio.
CREATE OR REPLACE FUNCTION "distribucion_statements_inmutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."professional_id" <> OLD."professional_id"
     OR NEW."corte_desde" <> OLD."corte_desde"
     OR NEW."corte_hasta" <> OLD."corte_hasta"
     OR NEW."emitted_at" <> OLD."emitted_at" THEN
    RAISE EXCEPTION 'Una cuenta emitida no se edita. Si esta mal, se objeta y se reemplaza por otra.';
  END IF;
  IF OLD."paid_at" IS NOT NULL AND NEW."paid_at" IS DISTINCT FROM OLD."paid_at" THEN
    RAISE EXCEPTION 'Esa cuenta ya estaba pagada el %; el pago no se reescribe.', OLD."paid_at";
  END IF;
  IF OLD."superseded_at" IS NOT NULL AND NEW."superseded_at" IS NULL THEN
    RAISE EXCEPTION 'Esa cuenta ya se retiro el %; no vuelve a estar viva.', OLD."superseded_at";
  END IF;
  IF OLD."paid_at" IS NOT NULL AND NEW."superseded_at" IS DISTINCT FROM OLD."superseded_at" THEN
    RAISE EXCEPTION 'Esa cuenta ya esta pagada: no se puede retirar, porque la plata ya se movio.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS "distribucion_statements_inmutable_trg" ON "distribucion_statements";--> statement-breakpoint
CREATE TRIGGER "distribucion_statements_inmutable_trg"
  BEFORE UPDATE ON "distribucion_statements"
  FOR EACH ROW EXECUTE FUNCTION "distribucion_statements_inmutable"();
