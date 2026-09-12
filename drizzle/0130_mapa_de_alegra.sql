-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL MAPA DE ALEGRA, POR AMBIENTE  ·  Bloque 2a  ·  2026-09-12
--
-- Todo lo de aqui esta VERIFICADO leyendo el sandbox por API el 2026-09-12, no transcrito de un correo.
--
-- ── POR QUE UNA TABLA POR AMBIENTE Y NO VARIABLES DE ENTORNO ────────────────────────────────────
--
-- Hoy los identificadores viven en `ALEGRA_DEFAULT_CLIENT_ID`, `ALEGRA_DEFAULT_ITEM_ID` y
-- `ALEGRA_IVA_TAX_ID`. Eso funciona mientras haya UN item generico para todo. Con cinco productos, dos
-- centros de costo y dos numeraciones, serian diez variables por ambiente, y el paso a produccion seria
-- editarlas a mano una por una: exactamente la maniobra que el modelo llama la causa numero uno de
-- facturas mal emitidas.
--
-- Con esta tabla, 2b es INSERTAR UNA FILA con los ids de produccion. Ninguna variable cambia de valor y
-- los de sandbox siguen ahi, intactos y distinguibles.
--
-- ── LO QUE NO SE PUDO CERRAR, Y VA EN NULO A PROPOSITO ──────────────────────────────────────────
--
-- `credit_note_template_id`: la numeracion de nota credito del sandbox (id 2) tiene `isElectronic: false`,
-- y la factura que emitimos SI es electronica (plantilla 16, prefijo SETP). Una nota credito NO
-- electronica contra una factura electronica no es lo que la DIAN espera. Queda nulo hasta que Santiago
-- habilite una numeracion electronica de nota credito en el sandbox; asi el codigo puede decir "no esta
-- configurada" en vez de emitir con la que no sirve.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "alegra_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'sandbox' | 'produccion'. UNICA por ambiente: no puede haber dos mapas compitiendo.
  "env" text NOT NULL UNIQUE,
  -- Plantilla de numeracion de la FACTURA. Es quien asigna el consecutivo; Atlas no lo calcula nunca.
  "invoice_template_id" text NOT NULL,
  -- Y la de NOTA CREDITO. Nula mientras no exista una electronica; ver la cabecera.
  "credit_note_template_id" text,
  -- El impuesto por id. El modelo dice que el IVA se hereda de Alegra y no se calcula en Atlas, PERO hay
  -- que mandar el `tax` explicito en cada linea: sin el, Alegra factura con IVA en 0 aunque el item lo
  -- tenga configurado. Ya paso en el sandbox: hay una factura EMITIDA de 140.000 con IVA 0.
  "iva_tax_id" text NOT NULL,
  -- Centro de costo por propiedad del producto. Sin el no se puede medir rentabilidad por linea, que es
  -- justo la pregunta abierta del margen del 10%.
  "cost_center_propio_id" text NOT NULL,
  "cost_center_tercero_id" text NOT NULL,
  "note" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "alegra_config_env_valido" CHECK ("env" IN ('sandbox', 'produccion'))
);--> statement-breakpoint

ALTER TABLE "alegra_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Solo lectura, y solo para quien administra. No lleva secretos (las credenciales siguen en el entorno),
-- pero un mapa de facturacion no es dato de consulta general.
CREATE POLICY "alegra_config_select" ON "alegra_config"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion'));--> statement-breakpoint
CREATE POLICY "alegra_config_write" ON "alegra_config"
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));--> statement-breakpoint

-- ── EL MAPA DEL SANDBOX, leido de su API el 2026-09-12 ──────────────────────────────────────────
--
-- Plantilla 16: "Facturacion Electronica", prefijo SETP, isElectronic TRUE, rango autorizado
-- SETP990000000 a SETP995000000 con vigencia hasta 2030-01-19. Es la que corresponde a la numeracion de
-- pruebas SETP990214700-799.
--
-- Impuesto 4 = IVA 19%. Los otros tres del sandbox son IVA Exento (1), IVA Excluido (2) e IVA 5% (3), y
-- confundirlos saca la factura al 0% sin que nada falle.
INSERT INTO "alegra_config"
  ("env", "invoice_template_id", "credit_note_template_id", "iva_tax_id",
   "cost_center_propio_id", "cost_center_tercero_id", "note")
SELECT 'sandbox', '16', NULL, '4', '1', '2',
       'Leido del sandbox por API el 2026-09-12. Nota credito SIN configurar: la numeracion 2 del sandbox no es electronica y la factura si lo es.'
 WHERE NOT EXISTS (SELECT 1 FROM "alegra_config" WHERE "env" = 'sandbox');--> statement-breakpoint

-- ── LOS CINCO ITEMS ─────────────────────────────────────────────────────────────────────────────
--
-- Se emparejan POR NOMBRE porque es lo que coincide entre las dos puntas, y el bloque de verificacion de
-- mas abajo aborta si alguno no quedo. El id de Alegra es lo que viaja en la factura; la referencia
-- (NUT-00x / EXT-001) queda en el comentario porque es de lectura humana, no de maquina.
--
-- OJO: el item 3 es D3-K2 OSTEO (NUT-004) y el 4 es LUVIA (EXT-001). Van seguidos y son de lineas
-- distintas; cruzarlos facturaria un producto de tercero como propio.
UPDATE "nutraceuticals" SET "alegra_item_id" = v."item", "alegra_env" = 'sandbox'
  FROM (VALUES
    ('MULTICELL BASE',    '5'),  -- NUT-001, base 90.000
    ('OMEGA COMPLEX',     '6'),  -- NUT-002, base 90.000
    ('CURCUMIN BIOACTIV', '2'),  -- NUT-003, base 90.000
    ('D3-K2 OSTEO',       '3'),  -- NUT-004, base 140.000
    ('LUVIA',             '4')   -- EXT-001, base 75.630
  ) AS v("nombre", "item")
 WHERE "nutraceuticals"."name" = v."nombre";--> statement-breakpoint

-- ── VERIFICACION, porque un mapa a medias es peor que ninguno ───────────────────────────────────
--
-- Un producto sin item se facturaria con el generico si alguien deja el codigo viejo como respaldo, y esa
-- factura dice "PRUEBA" donde deberia decir el producto. Mejor abortar la migracion.
DO $$
DECLARE sin_mapear text;
BEGIN
  SELECT string_agg("name", ', ') INTO sin_mapear
    FROM "nutraceuticals"
   WHERE "alegra_item_id" IS NULL AND NOT "is_test";
  IF sin_mapear IS NOT NULL THEN
    RAISE NOTICE 'PRODUCTOS SIN ITEM EN ALEGRA (no se pueden facturar todavia): %', sin_mapear;
  END IF;

  -- Y el que si es un error: dos productos apuntando al MISMO item de Alegra. La factura saldria con el
  -- producto equivocado y cuadraria en total, que es la peor forma de estar mal.
  IF EXISTS (
    SELECT 1 FROM "nutraceuticals"
     WHERE "alegra_item_id" IS NOT NULL
     GROUP BY "alegra_item_id", "alegra_env" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'ABORTADO: dos productos comparten el mismo item de Alegra en el mismo ambiente.';
  END IF;
END $$;--> statement-breakpoint

-- Y el candado en la base, para que el defecto no dependa de que alguien corra esta comprobacion.
CREATE UNIQUE INDEX IF NOT EXISTS "nutraceuticals_alegra_item_unico_idx"
  ON "nutraceuticals" ("alegra_env", "alegra_item_id")
  WHERE "alegra_item_id" IS NOT NULL;
