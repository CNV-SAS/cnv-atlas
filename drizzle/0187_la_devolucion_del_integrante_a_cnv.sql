-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA DEVOLUCION DEL INTEGRANTE A CNV  ·  2026-09-29
--
-- EL HUECO: la devolucion del PACIENTE esta construida entera (cuarentena, reincorporacion o baja, con su
-- decision humana). La del INTEGRANTE devolviendo a CNV lo que no vendio NO EXISTE, y es parte del ciclo de
-- consignacion: el modelo comercial la lista entre lo que se compensa en la liquidacion, junto con los
-- vencidos, y recomienda devolver el producto de tercero "tres o cuatro meses antes del vencimiento".
--
-- Sin ella, un Integrante que se queda con producto que no rota solo tiene dos salidas: venderlo a la fuerza
-- o dejarlo vencer. Las dos son peores para todos.
--
-- ── POR QUE ES UNA TABLA Y NO SOLO UN MOVIMIENTO ──
--
-- Porque son DOS HECHOS separados en el tiempo, con un transporte en medio: el Integrante DECLARA lo que
-- despacha, y CNV CONFIRMA lo que recibe. Es la misma forma que la remesa (CNV declara, el Integrante
-- confirma), y por la misma razon: ninguna de las dos partes puede mover sola el saldo en la direccion que
-- le conviene.
--
-- ── Y LA DECISION QUE GOBIERNA EL RESTO: EL SALDO BAJA AL CONFIRMAR, NO AL DECLARAR ──
--
-- Si bajara al declarar, un Integrante podria vaciar su saldo por su propia palabra, y eso es exactamente lo
-- que el caso de faltante existe para impedir. Bajando al confirmar, lo que queda entre el despacho y la
-- recepcion es una diferencia VISIBLE, y el sistema ya sabe tratarla: la categoria de justificacion
-- `devolucion_guia` ("devolucion a CNV con guia de transporte") existe en el enum desde la 0042. O sea que
-- el modelo ya habia previsto que un conteo, durante el transito, muestre de menos.
--
-- ── LA ASIMETRIA AL CONFIRMAR, COPIADA DE LA REMESA ──
--
-- CNV recibe MENOS de lo declarado -> el saldo se mueve por lo RECIBIDO, y las unidades que no llegaron se
-- quedan en el saldo del Integrante. No se perdonan solas: apareceran en su proximo conteo como faltante,
-- con su plazo y su justificacion. CNV recibe MAS -> se mueve solo por lo declarado (capado), porque el
-- excedente no puede bajarle el saldo a alguien por debajo de lo que dijo que mandaba.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "nutraceutical_returns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "professional_id" uuid NOT NULL REFERENCES "professional_profiles"("id"),
  "location_id" uuid NOT NULL REFERENCES "inventory_locations"("id"),
  "nutraceutical_id" uuid NOT NULL REFERENCES "nutraceuticals"("id"),
  "lot_id" uuid NOT NULL REFERENCES "lots"("id"),
  "declared_quantity" integer NOT NULL,
  -- El motivo lo escribe el Integrante. Obligatorio: una devolucion sin motivo no se puede leer despues, y
  -- "no rota" y "esta por vencer" piden respuestas distintas de CNV.
  "reason" text NOT NULL,
  "declared_at" timestamptz DEFAULT now() NOT NULL,
  "declared_by" uuid REFERENCES "profiles"("id"),
  -- ── El cierre, que lo hace CNV ──
  -- `received_quantity` 0 es un cierre valido y significativo: "se declaro y NO llego nada". No es lo mismo
  -- que seguir abierta.
  "received_quantity" integer,
  "closed_at" timestamptz,
  "closed_by" uuid REFERENCES "profiles"("id"),
  "close_note" text,
  -- Los dos movimientos que el cierre genero (salida de su vitrina y entrada a la central), para que la fila
  -- pueda explicar su propio efecto en el saldo sin que haya que reconstruirlo.
  "movement_out_id" uuid REFERENCES "nutraceutical_stock_movements"("id"),
  "movement_in_id" uuid REFERENCES "nutraceutical_stock_movements"("id")
);--> statement-breakpoint

ALTER TABLE "nutraceutical_returns"
  DROP CONSTRAINT IF EXISTS "nutra_returns_cantidad_positiva";--> statement-breakpoint
ALTER TABLE "nutraceutical_returns"
  ADD CONSTRAINT "nutra_returns_cantidad_positiva" CHECK ("declared_quantity" > 0);--> statement-breakpoint

-- LAS TRES MITADES DEL CIERRE VIAJAN JUNTAS. `IS NULL` nunca devuelve NULL, asi que este CHECK si evalua
-- (a diferencia del de la 0181: en Postgres un CHECK que evalua a NULL se CUMPLE, y ese fue el defecto).
ALTER TABLE "nutraceutical_returns"
  DROP CONSTRAINT IF EXISTS "nutra_returns_cierre_completo";--> statement-breakpoint
ALTER TABLE "nutraceutical_returns"
  ADD CONSTRAINT "nutra_returns_cierre_completo" CHECK (
    ("closed_at" IS NULL) = ("closed_by" IS NULL)
    AND ("closed_at" IS NULL) = ("received_quantity" IS NULL)
  );--> statement-breakpoint

-- Lo recibido no puede ser negativo ni pasarse de lo declarado (el capado de la remesa, en el otro sentido).
ALTER TABLE "nutraceutical_returns"
  DROP CONSTRAINT IF EXISTS "nutra_returns_recibido_en_rango";--> statement-breakpoint
ALTER TABLE "nutraceutical_returns"
  ADD CONSTRAINT "nutra_returns_recibido_en_rango" CHECK (
    "received_quantity" IS NULL
    OR ("received_quantity" >= 0 AND "received_quantity" <= "declared_quantity")
  );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "nutra_returns_abiertas_idx"
  ON "nutraceutical_returns" ("professional_id", "declared_at")
  WHERE "closed_at" IS NULL;--> statement-breakpoint

COMMENT ON TABLE "nutraceutical_returns" IS
  'Devolucion del Integrante a CNV: el declara lo que despacha, CNV confirma lo que recibe. El saldo baja al CONFIRMAR, nunca al declarar, para que nadie pueda vaciar su saldo por su propia palabra.';--> statement-breakpoint

-- ─── INMUTABLE SALVO EL CIERRE, Y EL CIERRE UNA SOLA VEZ ───
CREATE OR REPLACE FUNCTION "nutra_returns_solo_cierre"() RETURNS trigger AS $$
BEGIN
  IF NEW."professional_id" <> OLD."professional_id"
     OR NEW."location_id" <> OLD."location_id"
     OR NEW."nutraceutical_id" <> OLD."nutraceutical_id"
     OR NEW."lot_id" <> OLD."lot_id"
     OR NEW."declared_quantity" <> OLD."declared_quantity"
     OR NEW."reason" IS DISTINCT FROM OLD."reason"
     OR NEW."declared_at" <> OLD."declared_at"
     OR NEW."declared_by" IS DISTINCT FROM OLD."declared_by" THEN
    RAISE EXCEPTION 'Una devolucion declarada no se edita. Si se declaro mal, CNV la cierra con lo que de verdad recibio.';
  END IF;
  IF OLD."closed_at" IS NOT NULL THEN
    RAISE EXCEPTION 'Esa devolucion ya se cerro el %; el cierre no se repite ni se corrige aqui (un error se corrige con un movimiento de inventario en sentido contrario).', OLD."closed_at";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS "nutra_returns_solo_cierre_trg" ON "nutraceutical_returns";--> statement-breakpoint
CREATE TRIGGER "nutra_returns_solo_cierre_trg"
  BEFORE UPDATE ON "nutraceutical_returns"
  FOR EACH ROW EXECUTE FUNCTION "nutra_returns_solo_cierre"();--> statement-breakpoint

-- ─── RLS ───
ALTER TABLE "nutraceutical_returns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- El alcance se resuelve por la UBICACION, como en la 0121: asi ninguna fila queda fuera de toda politica.
DROP POLICY IF EXISTS "nutra_returns_select" ON "nutraceutical_returns";--> statement-breakpoint
CREATE POLICY "nutra_returns_select" ON "nutraceutical_returns"
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = "nutraceutical_returns"."location_id"
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    )
  );--> statement-breakpoint

-- DECLARAR ES SUYO, y solo sobre su propia ubicacion: CNV no declara devoluciones por el (no sabe que
-- despacho), y el no puede declarar desde la vitrina de otro.
DROP POLICY IF EXISTS "nutra_returns_insert" ON "nutraceutical_returns";--> statement-breakpoint
CREATE POLICY "nutra_returns_insert" ON "nutraceutical_returns"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = "location_id"
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    )
  );--> statement-breakpoint

-- CERRAR ES DE CNV. El Integrante no cierra su propia devolucion: seria declarar y confirmar solo, que es
-- justo la unica persona que no puede hacerlo.
DROP POLICY IF EXISTS "nutra_returns_update" ON "nutraceutical_returns";--> statement-breakpoint
CREATE POLICY "nutra_returns_update" ON "nutraceutical_returns"
  FOR UPDATE TO authenticated
  USING (public.has_role('admin') OR public.has_role('soporte'))
  WITH CHECK (public.has_role('admin') OR public.has_role('soporte'));
