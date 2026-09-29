-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL DOMICILIO: SU FLETE, SU COBERTURA Y SU RETRACTO  ·  2026-09-29
--
-- EL HUECO: `transactions.delivery_mode` admite 'domicilio' desde el Bloque 3 y NADA LO ESCRIBE. Los tres
-- sitios que crean una venta ponen 'en_consulta' a mano. Asi que no hay direccion, ni flete, ni cobertura, ni
-- el derecho de retracto que el modelo activa justamente por ser venta a distancia.
--
-- ── LO QUE NO HABIA QUE CONSTRUIR, porque ya estaba ──
--
-- El descuento de inventario contra la BODEGA CENTRAL (§5.1: "cuando la venta se despacha a domicilio, el
-- descuento se hace contra la bodega central") ya existe: es `desdeLaBodega` del checkout, construido el 26,
-- con su rama en el correo de pendientes ("ventas pagadas cuyo producto sale de la bodega y falta
-- despachar"). El domicilio se monta sobre eso, no lo reemplaza.
--
-- ── TRES COSAS, Y LAS TRES SALEN DEL MODELO §5 ──
--
--   1. LA TARIFA VIVE EN ATLAS, NO EN LOS DOCUMENTOS (§5.4, textual): el Anexo 2 y el Manual remiten a "la
--      tarifa vigente publicada en Atlas", para poder ajustarla cuando cambie la transportadora sin tocar
--      documentos firmados. Es FIJA POR ENVIO, independiente del numero de unidades.
--
--   2. LA COBERTURA ES UNA LISTA DE CIUDADES (§5.5). Y el criterio, textual: "es preferible NO ofrecer el
--      domicilio a un destino que ofrecerlo y perder dinero en cada envio". Por eso la lista vacia y la
--      tarifa nula significan lo mismo, y es lo correcto: no se ofrece domicilio.
--
--   3. EL MUNICIPIO DE DESTINO SE REGISTRA EN CADA VENTA, y no es un dato de contacto: §5.5 lo pide para el
--      analisis de ICA territorial ("las ventas despachadas a otros municipios pueden generar obligacion de
--      industria y comercio en la jurisdiccion de destino"). Por eso se sella en la venta y no se lee del
--      paciente, que puede mudarse.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. LA TARIFA, EN CONFIGURACION ───
-- NULA = no se ofrece domicilio. Es el defecto deliberado: mejor no ofrecerlo que ofrecerlo y perder dinero.
ALTER TABLE "commercial_config"
  ADD COLUMN IF NOT EXISTS "flete_tarifa" numeric;--> statement-breakpoint

ALTER TABLE "commercial_config"
  DROP CONSTRAINT IF EXISTS "commercial_config_flete_positivo";--> statement-breakpoint
ALTER TABLE "commercial_config"
  ADD CONSTRAINT "commercial_config_flete_positivo" CHECK ("flete_tarifa" IS NULL OR "flete_tarifa" > 0);--> statement-breakpoint

COMMENT ON COLUMN "commercial_config"."flete_tarifa" IS
  'Tarifa FIJA por envio a domicilio, independiente del numero de unidades (modelo §5.4). Vive aqui y no en los documentos contractuales, que remiten a "la tarifa vigente publicada en Atlas". NULA = no se ofrece domicilio.';--> statement-breakpoint

-- ─── 2. LA COBERTURA ───
CREATE TABLE IF NOT EXISTS "delivery_cities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "city" text NOT NULL,
  "department" text NOT NULL,
  -- Codigo DANE del municipio. Es lo que vuelve util el registro para el analisis de ICA: dos municipios se
  -- pueden llamar igual en departamentos distintos, y el nombre escrito a mano no identifica jurisdiccion.
  "dane_code" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_cities_unica"
  ON "delivery_cities" (lower("city"), lower("department"));--> statement-breakpoint

COMMENT ON TABLE "delivery_cities" IS
  'Ciudades habilitadas para domicilio (modelo §5.5). Vacia = no se ofrece domicilio a ningun destino, que es el defecto correcto: es preferible no ofrecerlo a perder dinero en cada envio.';--> statement-breakpoint

ALTER TABLE "delivery_cities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- La lee cualquiera con sesion (el profesional la necesita para cobrar) y solo CNV la edita.
DROP POLICY IF EXISTS "delivery_cities_select" ON "delivery_cities";--> statement-breakpoint
CREATE POLICY "delivery_cities_select" ON "delivery_cities"
  FOR SELECT TO authenticated USING (true);--> statement-breakpoint

DROP POLICY IF EXISTS "delivery_cities_write" ON "delivery_cities";--> statement-breakpoint
CREATE POLICY "delivery_cities_write" ON "delivery_cities"
  FOR ALL TO authenticated
  USING (public.has_role('admin') OR public.has_role('soporte'))
  WITH CHECK (public.has_role('admin') OR public.has_role('soporte'));--> statement-breakpoint

-- ─── 3. EL DESTINO Y EL FLETE, SELLADOS EN LA VENTA ───
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "shipping_address" text,
  ADD COLUMN IF NOT EXISTS "shipping_city" text,
  ADD COLUMN IF NOT EXISTS "shipping_department" text,
  ADD COLUMN IF NOT EXISTS "shipping_dane_code" text,
  -- El flete SELLADO al crear la venta, no leido de la configuracion despues: si la tarifa sube, la venta
  -- vieja tiene que seguir explicando lo que se le cobro. Misma disciplina que `unit_price`.
  ADD COLUMN IF NOT EXISTS "shipping_fee" numeric;--> statement-breakpoint

-- UN DOMICILIO SIN DIRECCION NO SE PUEDE DESPACHAR, y una venta en consulta con flete cobrado es un cobro
-- sin causa. Las dos direcciones del error se cierran en el mismo CHECK.
ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_domicilio_completo";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_domicilio_completo" CHECK (
    "delivery_mode" IS DISTINCT FROM 'domicilio'
    OR ("shipping_address" IS NOT NULL AND "shipping_city" IS NOT NULL)
  );--> statement-breakpoint

ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_flete_solo_en_domicilio";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_flete_solo_en_domicilio" CHECK (
    "shipping_fee" IS NULL OR "delivery_mode" = 'domicilio'
  );--> statement-breakpoint

COMMENT ON COLUMN "transactions"."shipping_city" IS
  'Municipio de DESTINO, sellado en la venta. No se lee del paciente (que puede mudarse): el modelo §5.5 lo pide para el analisis de ICA territorial, y eso necesita saber donde se entrego ESTA venta.';--> statement-breakpoint

-- ─── 4. EL RETRACTO ───
-- Ley 1480 de 2011, articulo 47: cinco dias habiles desde la entrega, y solo bajo modalidad Comision (bajo
-- Distribucion el expendedor frente al paciente es el Integrante, §5.7).
--
-- LA FECHA NO SE GUARDA: se deduce de `delivered_at` mas cinco dias habiles, con el calendario colombiano que
-- Atlas ya tiene. Una columna habria que mantenerla al dia y podria contradecir a la entrega.
--
-- LO QUE SI HACE FALTA GUARDAR ES EL EJERCICIO: quien se retracto, cuando, y si el producto llego sellado,
-- porque el sello es la EVIDENCIA que acredita la excepcion del numeral 7 y "no basta afirmarla" (doctrina de
-- la Superintendencia, citada en el modelo).
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "retracto_ejercido_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "retracto_sello_intacto" boolean,
  ADD COLUMN IF NOT EXISTS "retracto_nota" text;--> statement-breakpoint

ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_retracto_completo";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_retracto_completo" CHECK (
    ("retracto_ejercido_at" IS NULL) = ("retracto_sello_intacto" IS NULL)
  );--> statement-breakpoint

COMMENT ON COLUMN "transactions"."retracto_sello_intacto" IS
  'Si el producto volvio sellado. Es la EVIDENCIA de la excepcion del numeral 7 del articulo 47: con el sello roto el retracto no procede por bien de uso personal, y la doctrina exige acreditarlo, no afirmarlo.';
