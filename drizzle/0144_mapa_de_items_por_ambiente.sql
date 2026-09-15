-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL MAPA DE ITEMS DE ALEGRA, POR PRODUCTO Y AMBIENTE  ·  Bloque 3, paso 8 del 3.4  ·  2026-09-14
--
-- EL HALLAZGO DEL 2b: `nutraceuticals.alegra_item_id` guardaba UN item con su ambiente. Pasar a produccion
-- SOBRESCRIBIA los ids del sandbox, desde ese momento una venta de prueba fallaba con "Items de otro
-- ambiente", y volver al sandbox exigia un script aparte (`vuelta-atras-alegra-sandbox.sql`) que reescribia
-- los cinco productos. Un mapa que hay que reescribir para cambiar de ambiente es un mapa que se puede dejar a
-- medias.
--
-- AHORA CADA AMBIENTE TIENE SU FILA. La factura lee el item del ambiente con que se esta facturando
-- (`alegra_config.env`), y los dos mapas conviven: configurar produccion no toca el sandbox.
--
-- LAS COLUMNAS VIEJAS SE QUEDAN, SIN LEERSE: las migraciones son forward-only y hay scripts de operacion que
-- las nombraban. Se retiran en una migracion posterior, cuando nada las nombre.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "alegra_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nutraceutical_id" uuid NOT NULL REFERENCES "nutraceuticals"("id") ON DELETE CASCADE,
  "env" text NOT NULL,
  "item_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "alegra_items_env_valido" CHECK ("env" IN ('sandbox', 'produccion')),
  -- Un item por producto EN CADA ambiente.
  CONSTRAINT "alegra_items_uno_por_producto_y_ambiente" UNIQUE ("nutraceutical_id", "env")
);--> statement-breakpoint

-- Y un item de Alegra no puede ser de dos productos en el mismo ambiente: la factura saldria con el producto
-- equivocado y cuadraria en total. Es la garantia que tenia `nutraceuticals_alegra_item_unico_idx`.
CREATE UNIQUE INDEX IF NOT EXISTS "alegra_items_item_unico_por_ambiente" ON "alegra_items" ("env", "item_id");--> statement-breakpoint

-- Lectura solo para quien administra; las escrituras las hacen la aplicacion (conexion de sistema) y los
-- scripts de configuracion.
ALTER TABLE "alegra_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "alegra_items_select" ON "alegra_items";--> statement-breakpoint
CREATE POLICY "alegra_items_select" ON "alegra_items"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
  );--> statement-breakpoint

-- EL MAPA DE HOY, COPIADO: cada producto con item, en el ambiente que tenia.
INSERT INTO "alegra_items" ("nutraceutical_id", "env", "item_id")
SELECT "id", "alegra_env", "alegra_item_id"
  FROM "nutraceuticals"
 WHERE "alegra_item_id" IS NOT NULL AND "alegra_env" IN ('sandbox', 'produccion')
ON CONFLICT ("nutraceutical_id", "env") DO NOTHING;--> statement-breakpoint

COMMENT ON COLUMN "nutraceuticals"."alegra_item_id" IS
  'OBSOLETA desde la 0144: el item vive en alegra_items, por ambiente. No se lee.';--> statement-breakpoint
COMMENT ON COLUMN "nutraceuticals"."alegra_env" IS
  'OBSOLETA desde la 0144: el ambiente del item vive en alegra_items. No se lee.';
