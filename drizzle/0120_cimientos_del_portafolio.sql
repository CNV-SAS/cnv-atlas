-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CIMIENTOS DEL PORTAFOLIO: PROVEEDOR, TITULARIDAD, UBICACIONES Y LOTES  ·  Bloque 1  ·  2026-09-11
--
-- QUE TRAE: las cuatro piezas que el modelo comercial exige para poder representar un producto que NO es
-- de CNV y un inventario que esta en mas de un sitio. Ninguna de las cuatro perturba el codigo vivo: son
-- tablas nuevas y columnas nuevas, todas opcionales para lo que hoy corre.
--
-- QUE NO TRAE, y es deliberado: la RE-LLAVE de `nutraceutical_inventory` a (ubicacion, producto, lote).
-- Eso cambia la proyeccion del saldo, sus dos triggers y cinco servicios que hoy leen por profesional, y
-- merece su propio paso. Ver la nota al final.
--
-- ── PRINCIPIO 3 DEL MODELO: propio y de tercero se distinguen EN TODO EL FLUJO ────────────────────
--
-- "No es una etiqueta de presentacion: cambia el tratamiento de inventario, de liquidacion, de faltantes
-- y de alertas. Modelar la distincion desde el primer dia, aunque hoy solo exista un producto de tercero."
-- Por eso `ownership` entra ahora y no cuando haya dos.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. EL PROVEEDOR EXTERNO COMO ENTIDAD ─────────────────────────────────────────────────────────
--
-- Hoy hay uno (Centro de Nutricion Integral Katherine Ruiz, que provee LUVIA) y la estructura tiene que
-- soportar varios aunque la operacion arranque con uno (§11.3).
--
-- LLEVA PERFIL TRIBUTARIO PROPIO porque CNV le RETIENE: por la ruta adoptada (§7.3), el proveedor factura
-- a CNV por las unidades vendidas y CNV practica retefuente del 2,5% sobre la base cuando supera la base
-- minima. Sin su perfil no se sabe si retener ni cuanto.
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "tax_id_type" text,
  "tax_id_number" text,
  "tax_id_dv" text,
  "tax_is_vat_responsible" boolean,
  "tax_is_withholding_agent" boolean,
  "alegra_contact_id" text,
  -- Ciclo de corte, alineado con el de Distribucion y el de consignacion de efectivo para operar un solo
  -- calendario (§7.10). Dias del mes en que se corta; quincenal = {15, 30}.
  "cut_days" integer[] NOT NULL DEFAULT '{15,30}',
  "is_active" boolean NOT NULL DEFAULT true,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

-- ── 2. TITULARIDAD EN EL CATALOGO ────────────────────────────────────────────────────────────────
--
-- `ownership` gobierna comportamiento, no presentacion: el producto de tercero no entra al balance de CNV
-- (§10.3, va en cuentas de orden), su faltante genera una obligacion con el proveedor, y su ficha, reporte
-- y factura deben identificarlo con su TITULAR DE MARCA.
--
-- POR QUE EL TITULAR DE MARCA ES UN CAMPO Y NO SE DEDUCE DEL PROVEEDOR: la doctrina del fabricante
-- aparente (§7.7) presume productor a quien pone su marca en el producto. Si LUVIA se presenta sin
-- distinguirlo de la linea propia, un juez podria tratar a CNV como su fabricante. El nombre que hay que
-- mostrar es el del titular, que no tiene por que ser el del proveedor que lo entrega.
DO $$ BEGIN
  CREATE TYPE "nutraceutical_ownership" AS ENUM ('propio', 'tercero');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

ALTER TABLE "nutraceuticals"
  ADD COLUMN IF NOT EXISTS "ownership" "nutraceutical_ownership" NOT NULL DEFAULT 'propio',
  ADD COLUMN IF NOT EXISTS "brand_owner" text,
  ADD COLUMN IF NOT EXISTS "supplier_id" uuid REFERENCES "suppliers"("id"),
  -- El codigo del producto en Alegra (NUT-001...). Necesario para que la factura identifique el producto
  -- y evite la observacion FAZ09 de la DIAN. Se usa en el Bloque 2.
  ADD COLUMN IF NOT EXISTS "alegra_item_id" text,
  -- Tarifa de IVA del producto. HOY Atlas la tiene como constante global (19%), que es justo lo que el
  -- principio 2 prohibe; y ademas el modelo dice que el IVA se HEREDA de Alegra (§10.1). Esta columna es
  -- el puente: la guarda por producto mientras el Bloque 2 la sincroniza desde Alegra.
  ADD COLUMN IF NOT EXISTS "vat_rate" numeric NOT NULL DEFAULT 0.19;--> statement-breakpoint

-- UN PRODUCTO DE TERCERO EXIGE SU PROVEEDOR Y SU TITULAR. Sin esto, `ownership='tercero'` seria una
-- etiqueta sin consecuencia, que es exactamente lo que el principio 3 prohibe.
ALTER TABLE "nutraceuticals"
  ADD CONSTRAINT "nutra_tercero_exige_proveedor_y_titular"
  CHECK ("ownership" = 'propio' OR ("supplier_id" IS NOT NULL AND "brand_owner" IS NOT NULL));--> statement-breakpoint

-- ── 3. UBICACIONES DE INVENTARIO ─────────────────────────────────────────────────────────────────
--
-- Bodega CENTRAL (de CNV) y una por Integrante. La central es la que hoy no existe y por la que las 1.284
-- unidades que quedan del primer lote no tienen donde vivir.
--
-- `professional_id` NULO = la central. Es la unica ubicacion sin dueño, y la restriccion de abajo lo
-- expresa: una ubicacion es central o es de alguien, nunca las dos ni ninguna.
CREATE TABLE IF NOT EXISTS "inventory_locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "kind" text NOT NULL, -- 'central' | 'integrante'
  "professional_id" uuid REFERENCES "professional_profiles"("id") ON DELETE restrict,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "loc_kind_valido" CHECK ("kind" IN ('central', 'integrante')),
  CONSTRAINT "loc_central_sin_dueño" CHECK (
    ("kind" = 'central' AND "professional_id" IS NULL)
    OR ("kind" = 'integrante' AND "professional_id" IS NOT NULL)
  )
);--> statement-breakpoint

-- UNA SOLA CENTRAL, y una sola ubicacion por Integrante. Indices unicos parciales, el mismo mecanismo de
-- "una sola activa" que ya usan model_versions y el reparto.
CREATE UNIQUE INDEX IF NOT EXISTS "loc_una_central" ON "inventory_locations" ("kind") WHERE "kind" = 'central';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loc_una_por_integrante" ON "inventory_locations" ("professional_id") WHERE "professional_id" IS NOT NULL;--> statement-breakpoint

-- La central y la de cada profesional que ya existe. Idempotente.
INSERT INTO "inventory_locations" ("name", "kind", "professional_id")
SELECT 'Bodega central CNV', 'central', NULL
 WHERE NOT EXISTS (SELECT 1 FROM "inventory_locations" WHERE "kind" = 'central');--> statement-breakpoint

INSERT INTO "inventory_locations" ("name", "kind", "professional_id")
SELECT COALESCE(pr."full_name", 'Integrante'), 'integrante', pp."id"
  FROM "professional_profiles" pp
  LEFT JOIN "profiles" pr ON pr."id" = pp."profile_id"
 WHERE NOT EXISTS (SELECT 1 FROM "inventory_locations" l WHERE l."professional_id" = pp."id");--> statement-breakpoint

-- ── 4. LOTES ─────────────────────────────────────────────────────────────────────────────────────
--
-- PRINCIPIO 8: "Todo movimiento de inventario se registra contra un lote, con su fecha de vencimiento.
-- Sin lote no hay trazabilidad hasta el paciente, y sin trazabilidad no hay retiro dirigido posible."
--
-- Y NO ES TEORICO: hay producto de tercero con avena en la calle y una obligacion contractual de trazar y
-- notificar a los pacientes de un lote afectado. Hoy `lote` era texto libre en el movimiento y no
-- gobernaba nada; esto lo vuelve una entidad con vencimiento.
CREATE TABLE IF NOT EXISTS "lots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nutraceutical_id" uuid NOT NULL REFERENCES "nutraceuticals"("id") ON DELETE restrict,
  "code" text NOT NULL,
  "expires_on" date NOT NULL,
  "received_on" date,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "lots_codigo_por_producto" UNIQUE ("nutraceutical_id", "code")
);--> statement-breakpoint

-- ── 5. RLS ───────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "suppliers_select" ON "suppliers"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion') OR public.has_role('soporte'));--> statement-breakpoint
CREATE POLICY "suppliers_write" ON "suppliers"
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));--> statement-breakpoint

-- LAS UBICACIONES Y LOS LOTES LOS LEE CUALQUIER AUTENTICADO: el profesional necesita saber de que lote
-- entrega, y el lote no es dato sensible. Escribirlos es de admin y soporte.
CREATE POLICY "locations_select" ON "inventory_locations" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "locations_write" ON "inventory_locations"
  FOR ALL TO authenticated USING (public.has_role('admin') OR public.has_role('soporte'))
  WITH CHECK (public.has_role('admin') OR public.has_role('soporte'));--> statement-breakpoint

CREATE POLICY "lots_select" ON "lots" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "lots_write" ON "lots"
  FOR ALL TO authenticated USING (public.has_role('admin') OR public.has_role('soporte'))
  WITH CHECK (public.has_role('admin') OR public.has_role('soporte'));

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LO QUE FALTA PARA QUE LA CARGA INICIAL PUEDA CARGARLO TODO
--
-- LA RE-LLAVE DEL SALDO a (ubicacion, producto, lote). Es lo unico que queda y no es una tabla mas:
--
--   · `nutraceutical_stock_movements` gana `location_id` y `lot_id`, y su `professional_id` deja de ser
--     la respuesta a "donde esta": lo es la ubicacion. Hoy es NOT NULL, y un movimiento de la BODEGA
--     CENTRAL no tiene profesional, asi que sin este cambio las 1.284 unidades no se pueden registrar.
--   · `nutraceutical_inventory` cambia su llave unica de (profesional, producto) a
--     (ubicacion, producto, lote).
--   · SUS DOS TRIGGERS se reescriben: `nutra_movement_apply` (que proyecta el saldo) y
--     `nutra_inventory_coherence` (que impide que el saldo diga algo distinto de la suma). Y los dos
--     tienen que CONSERVAR la exclusion de `type = 'remesa'`, que la migracion 0052 introdujo: una remesa
--     declarada no mueve el saldo del Integrante hasta que la confirma.
--   · Y cinco servicios leen hoy por profesional: inventory-service, remesa-service, faltante-service, el
--     despacho del tratamiento y /mi-inventario.
--
-- SE DEJA PARA SU PROPIO PASO a proposito: tocar la proyeccion del saldo y sus dos garantias en la misma
-- migracion que crea cuatro tablas mezcla lo que no puede fallar con lo que solo se añade.
--
-- MIENTRAS TANTO SE PUEDE CARGAR LO DE LOS INTEGRANTES (456 unidades), que es lo que hace a Atlas usable
-- para vender. La bodega central espera a este paso.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════
