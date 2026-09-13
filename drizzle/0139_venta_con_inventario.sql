-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA VENTA MUEVE INVENTARIO  ·  Bloque 3, sesion 1  ·  2026-09-13
--
-- `transactions` NO SE REEMPLAZA, SE EXTIENDE (decision 1 de Santiago, 2026-09-13): de las tres cosas que
-- funde (venta, pago, documento), la que es una por fila es la venta. Todo aqui es ADITIVO y admite nulo:
-- las ventas anteriores quedan como estan, sin descuento hacia atras (se restaria dos veces con los
-- despachos que se registraron aparte).
--
-- LAS TRES REGLAS QUE ESTO SOSTIENE:
--   · D2: el inventario se descuenta AL SELLAR la venta, no al facturar.
--   · D3: el checkout pendiente RESERVA; al caducar, libera.
--   · Decision 4 de Santiago: una venta PAGADA sin saldo se sella igual y avisa. Por eso el descuento es un
--     estado propio de la venta y no parte del sellado del pago: si fallara dentro del sellado, desharia
--     el pago.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LA VENTA ────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "transactions"
  -- Nulo permitido: `/pagos` sin evaluacion en curso (el paciente que vuelve solo a comprar) es legitimo.
  ADD COLUMN IF NOT EXISTS "treatment_id" uuid REFERENCES "treatments"("id") ON DELETE SET NULL,
  -- De donde sale el producto. Se sella al crear la venta: si el Integrante cambia de ubicacion despues, la
  -- venta sigue saliendo de donde salio.
  ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "inventory_locations"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "delivery_mode" text,
  -- Fecha de OPERACION, distinta de la de facturacion (una factura puede salir al dia siguiente).
  ADD COLUMN IF NOT EXISTS "operated_at" timestamp with time zone,
  -- EL ESTADO DEL INVENTARIO DE LA VENTA. Nulo = venta anterior al Bloque 3, que no mueve inventario.
  ADD COLUMN IF NOT EXISTS "stock_state" text,
  ADD COLUMN IF NOT EXISTS "stock_last_error" text;--> statement-breakpoint

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_delivery_mode_valido";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_delivery_mode_valido"
  CHECK ("delivery_mode" IS NULL OR "delivery_mode" IN ('en_consulta', 'domicilio'));--> statement-breakpoint

-- Texto con CHECK y no enum: un enum nuevo tampoco se podria usar en esta misma corrida de migraciones.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_stock_state_valido";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_stock_state_valido"
  CHECK ("stock_state" IS NULL OR "stock_state" IN
    ('reservado',   -- checkout pendiente con sus unidades reservadas
     'pendiente',   -- pagada, el descuento todavia no corrio
     'descontado',  -- pagada y descontada completa
     'sin_saldo',   -- pagada; se desconto lo que habia y faltaron unidades (AVISO, no error)
     'fallido',     -- pagada; el descuento fallo y la cola lo reintenta
     'liberado'));  --> statement-breakpoint

COMMENT ON COLUMN "transactions"."stock_state" IS
  'Inventario de la venta. NULL = anterior al Bloque 3 (no mueve inventario). reservado -> pendiente -> descontado | sin_saldo | fallido; reservado -> liberado si el pago falla.';--> statement-breakpoint

-- La cola de descuento: ventas pagadas a las que les falta el inventario.
CREATE INDEX IF NOT EXISTS "transactions_descuento_pendiente_idx"
  ON "transactions" ("created_at")
  WHERE "status" = 'paid' AND "stock_state" IN ('reservado', 'pendiente', 'fallido');--> statement-breakpoint

-- ── 2. EL MOVIMIENTO SABE DE QUE LINEA SALIO ───────────────────────────────────────────────────────
--
-- Del movimiento a la linea, y no al reves: una linea puede salir de VARIOS lotes (dos unidades de un lote
-- que vence antes y una del siguiente), y cada lote es un movimiento.
--
-- ON DELETE RESTRICT: una venta que movio inventario no se borra. El movimiento es inmutable y es la
-- evidencia de custodia; borrar su venta lo dejaria sin explicacion.
ALTER TABLE "nutraceutical_stock_movements"
  ADD COLUMN IF NOT EXISTS "transaction_item_id" uuid REFERENCES "transaction_items"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- `type::text` y no el literal del enum: 'venta' se crea en la 0138, y si las dos corren en la misma
-- transaccion, nombrarlo como enum daria 55P04.
ALTER TABLE "nutraceutical_stock_movements" DROP CONSTRAINT IF EXISTS "nutra_movement_venta_exige_linea";--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements" ADD CONSTRAINT "nutra_movement_venta_exige_linea"
  CHECK ("type"::text <> 'venta' OR "transaction_item_id" IS NOT NULL);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "nutra_movements_linea_idx"
  ON "nutraceutical_stock_movements" ("transaction_item_id")
  WHERE "transaction_item_id" IS NOT NULL;--> statement-breakpoint

-- ── 3. LAS RESERVAS ────────────────────────────────────────────────────────────────────────────────
--
-- Una reserva NO MUEVE EL SALDO: el saldo es la suma de movimientos y sigue siendolo. Lo que cambia es lo
-- DISPONIBLE para una venta nueva: saldo menos reservas vivas. Asi el conteo fisico sigue comparando contra
-- lo que de verdad hay en la vitrina, que es donde siguen las unidades reservadas.
--
-- VENCE CON EL LINK DE PAGO (24 horas): un link que ya no se puede pagar no tiene por que retener nada. Una
-- reserva vencida no se borra ni necesita un proceso que la limpie: simplemente deja de contar.
CREATE TABLE IF NOT EXISTS "inventory_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_item_id" uuid NOT NULL REFERENCES "transaction_items"("id") ON DELETE CASCADE,
  "location_id" uuid NOT NULL REFERENCES "inventory_locations"("id") ON DELETE RESTRICT,
  "lot_id" uuid NOT NULL REFERENCES "lots"("id") ON DELETE RESTRICT,
  "nutraceutical_id" uuid NOT NULL REFERENCES "nutraceuticals"("id") ON DELETE RESTRICT,
  "quantity" integer NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  -- El pago fallo (o la reserva vencio y la venta tomo otras unidades).
  "released_at" timestamp with time zone,
  -- Se convirtio en un movimiento de venta.
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "reserva_cantidad_positiva" CHECK ("quantity" > 0),
  CONSTRAINT "reserva_un_solo_desenlace" CHECK ("released_at" IS NULL OR "consumed_at" IS NULL)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "reservas_vivas_idx"
  ON "inventory_reservations" ("location_id", "nutraceutical_id", "lot_id")
  WHERE "released_at" IS NULL AND "consumed_at" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "reservas_por_linea_idx"
  ON "inventory_reservations" ("transaction_item_id");--> statement-breakpoint

-- Solo lectura por RLS, con el mismo alcance que los movimientos (por la ubicacion). Las escrituras las
-- hace el servidor con la conexion de sistema, igual que el sellado del pago: el webhook no tiene sesion.
ALTER TABLE "inventory_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "inventory_reservations_select" ON "inventory_reservations";--> statement-breakpoint
CREATE POLICY "inventory_reservations_select" ON "inventory_reservations"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = "inventory_reservations".location_id
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    )
  );
