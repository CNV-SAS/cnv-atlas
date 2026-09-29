-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA CUENTA QUINCENAL DE DISTRIBUCION, Y EL CUPO DE CREDITO  ·  2026-09-29
--
-- EL HUECO: la modalidad Distribucion esta construida como MECANISMO (el cambio manda, el sellado la
-- obedece) y le falta el lado del dinero. Bajo Distribucion el paciente le paga AL INTEGRANTE y CNV le
-- factura a EL cada quincena; hoy eso se anota por fuera de Atlas.
--
-- ── LO QUE ESTA TABLA NO GUARDA, Y ES LO MAS IMPORTANTE DE ELLA ──
--
-- NO guarda los totales. La decision ya estaba escrita en `payments-writer.ts` al sellar la venta, y se
-- respeta: "lo que CNV le va a facturar NO NECESITA TABLA NUEVA... una tabla aparte seria una segunda fuente
-- del mismo numero, capaz de contradecir a la linea".
--
-- Asi que la cuenta es un PERIODO CON ESTADO, y sus cifras se derivan siempre de las lineas que la componen,
-- que ya estan selladas desde la 0143 (`base_amount`, `commission_amount`). La factura de una venta vieja no
-- puede cambiar porque hoy cambie un precio o una tasa: eso es lo que el sellado existe para impedir.
--
-- ── LO QUE SI HACIA FALTA: QUE UNA VENTA NO SE FACTURE DOS VECES ──
--
-- `transactions.distribucion_statement_id`, exactamente como `professional_revenue.settlement_id` impide
-- pagar dos veces una comision y `nutraceutical_faltante_cases.settlement_id` impide cobrar dos veces un
-- faltante. Nula = todavia no se ha facturado; con valor = ya se fue en esa cuenta.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. EL CUPO DE CREDITO, POR INTEGRANTE ───
-- NULO significa "no se ha fijado", NO "cero". Tratarlo como cero suspenderia los despachos de todos los
-- Integrantes el dia del despliegue, que es peor que no tener el control (la regla vive en `distribucion.ts`
-- y tiene candado).
ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "credit_limit" numeric;--> statement-breakpoint

ALTER TABLE "professional_profiles"
  DROP CONSTRAINT IF EXISTS "prof_credit_limit_no_negativo";--> statement-breakpoint
ALTER TABLE "professional_profiles"
  ADD CONSTRAINT "prof_credit_limit_no_negativo" CHECK ("credit_limit" IS NULL OR "credit_limit" >= 0);--> statement-breakpoint

COMMENT ON COLUMN "professional_profiles"."credit_limit" IS
  'Cupo de credito bajo modalidad Distribucion (modelo §4). NULO = sin fijar, y no suspende nada. Al alcanzarlo se suspende el despacho de nuevo inventario.';--> statement-breakpoint

-- ─── 2. LA CUENTA DEL CORTE ───
CREATE TABLE IF NOT EXISTS "distribucion_statements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "professional_id" uuid NOT NULL REFERENCES "professional_profiles"("id"),
  "corte_desde" date NOT NULL,
  "corte_hasta" date NOT NULL,
  "emitted_at" timestamptz DEFAULT now() NOT NULL,
  "emitted_by" uuid REFERENCES "profiles"("id"),
  -- OBJECION (modelo §4): dos dias habiles para objetar de forma sustentada, CNV corrige en tres. La nota es
  -- obligatoria cuando se objeta: "de forma sustentada" no es una objecion en blanco.
  "objected_at" timestamptz,
  "objection_note" text,
  "objection_resolved_at" timestamptz,
  -- 'corregida' = CNV le dio la razon y esta cuenta se reemplaza; 'sostenida' = la cuenta queda como estaba.
  "objection_outcome" text,
  -- La cuenta que la reemplaza cuando una objecion prospera. Una cuenta emitida NO se edita: se reemplaza,
  -- igual que una evaluacion corregida (misma forma que `superseded_by`).
  "replaced_by_id" uuid REFERENCES "distribucion_statements"("id"),
  "paid_at" timestamptz,
  "paid_amount" numeric,
  "paid_note" text
);--> statement-breakpoint

-- UNA CUENTA VIVA POR INTEGRANTE Y CORTE. Las reemplazadas no cuentan: un corte re-emitido tras una objecion
-- tiene dos filas, y solo una sigue viva.
CREATE UNIQUE INDEX IF NOT EXISTS "distribucion_statements_una_viva_por_corte"
  ON "distribucion_statements" ("professional_id", "corte_hasta")
  WHERE "replaced_by_id" IS NULL;--> statement-breakpoint

ALTER TABLE "distribucion_statements"
  DROP CONSTRAINT IF EXISTS "distribucion_statements_corte_coherente";--> statement-breakpoint
ALTER TABLE "distribucion_statements"
  ADD CONSTRAINT "distribucion_statements_corte_coherente" CHECK ("corte_desde" <= "corte_hasta");--> statement-breakpoint

-- Objetar exige motivo. `IS NULL` nunca devuelve NULL, asi que este CHECK si evalua (la leccion de la 0181:
-- un CHECK que evalua a NULL se CUMPLE).
ALTER TABLE "distribucion_statements"
  DROP CONSTRAINT IF EXISTS "distribucion_statements_objecion_sustentada";--> statement-breakpoint
ALTER TABLE "distribucion_statements"
  ADD CONSTRAINT "distribucion_statements_objecion_sustentada" CHECK (
    ("objected_at" IS NULL) = ("objection_note" IS NULL)
    AND ("objected_at" IS NOT NULL OR "objection_resolved_at" IS NULL)
    AND ("objection_resolved_at" IS NULL) = ("objection_outcome" IS NULL)
    AND ("objection_outcome" IS NULL OR "objection_outcome" IN ('corregida', 'sostenida'))
  );--> statement-breakpoint

-- Pagar exige monto. Es la cifra que contabilidad concilia contra el extracto.
ALTER TABLE "distribucion_statements"
  DROP CONSTRAINT IF EXISTS "distribucion_statements_pago_con_monto";--> statement-breakpoint
ALTER TABLE "distribucion_statements"
  ADD CONSTRAINT "distribucion_statements_pago_con_monto" CHECK (
    ("paid_at" IS NULL) = ("paid_amount" IS NULL)
  );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "distribucion_statements_pendientes_idx"
  ON "distribucion_statements" ("professional_id")
  WHERE "paid_at" IS NULL AND "replaced_by_id" IS NULL;--> statement-breakpoint

COMMENT ON TABLE "distribucion_statements" IS
  'La cuenta quincenal que CNV le factura al Integrante bajo Distribucion. NO guarda totales a proposito: las cifras se derivan de las lineas selladas que la componen (transactions.distribucion_statement_id), para que no haya una segunda fuente del mismo numero.';--> statement-breakpoint

-- ─── 3. LA VENTA SE FACTURA UNA SOLA VEZ ───
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "distribucion_statement_id" uuid REFERENCES "distribucion_statements"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transactions_por_facturar_distribucion_idx"
  ON "transactions" ("professional_id", "operated_at")
  WHERE "distribucion_statement_id" IS NULL;--> statement-breakpoint

COMMENT ON COLUMN "transactions"."distribucion_statement_id" IS
  'La cuenta quincenal que se llevo esta venta. Nula = pendiente de facturar. Mismo mecanismo que professional_revenue.settlement_id con la comision: es lo que impide facturar dos veces la misma venta.';--> statement-breakpoint

-- ─── 4. UNA CUENTA EMITIDA NO SE EDITA ───
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS "distribucion_statements_inmutable_trg" ON "distribucion_statements";--> statement-breakpoint
CREATE TRIGGER "distribucion_statements_inmutable_trg"
  BEFORE UPDATE ON "distribucion_statements"
  FOR EACH ROW EXECUTE FUNCTION "distribucion_statements_inmutable"();--> statement-breakpoint

-- ─── 5. RLS ───
ALTER TABLE "distribucion_statements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- EL INTEGRANTE VE LAS SUYAS, y tiene que verlas: sin ver el detalle no puede objetar, y objetar es un
-- derecho que el modelo le da con plazo.
DROP POLICY IF EXISTS "distribucion_statements_select" ON "distribucion_statements";--> statement-breakpoint
CREATE POLICY "distribucion_statements_select" ON "distribucion_statements"
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR public.is_own_professional_profile("professional_id")
  );--> statement-breakpoint

-- Emitir y cerrar es de CNV; objetar lo hace el Integrante sobre la suya. Las dos caras van por la aplicacion
-- (servicio con su policy), y esta politica es la defensa de fondo.
DROP POLICY IF EXISTS "distribucion_statements_update" ON "distribucion_statements";--> statement-breakpoint
CREATE POLICY "distribucion_statements_update" ON "distribucion_statements"
  FOR UPDATE TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('soporte')
    OR public.is_own_professional_profile("professional_id")
  )
  WITH CHECK (
    public.has_role('admin') OR public.has_role('soporte')
    OR public.is_own_professional_profile("professional_id")
  );
