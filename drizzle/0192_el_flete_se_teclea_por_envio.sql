-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL FLETE SE TECLEA POR ENVIO, Y ATLAS CALCULA EL RESTO  ·  2026-09-29
--
-- DECISION DE SANTIAGO, y su razon: 14.000 es fijo en Medellin, pero hay Integrantes en Pereira, Cali y otras
-- zonas, y ahi varia. Una tarifa unica no aplica, y una por ciudad seria adivinar.
--
-- ASI QUE: el profesional teclea EL COSTO DEL DOMICILIARIO al crear el envio, y Atlas calcula la base con su
-- margen y el IVA. Nadie hace la cuenta a mano.
--
-- ── EL MARGEN, Y POR QUE EXISTE ──
--
-- Fuga que encontro contabilidad: la pasarela cobra su comision TAMBIEN sobre el flete. Si se le cobran 11.900
-- al paciente, Wompi se queda con ~2,5% de esos 11.900 mientras al domiciliario se le pagan 10.000 completos.
-- Con un margen del 3% sobre el costo, antes del IVA, el envio queda realmente neutro.
--
-- VA EN CONFIGURACION Y NO EN EL CODIGO (principio 2 del modelo comercial, el mismo que ya rige para los dias
-- de alerta de vencimiento): la comision de la pasarela cambia, y el margen que la compensa tambien.
--
-- ── Y EL COSTO SE GUARDA EN LA VENTA, no solo lo cobrado ──
--
-- Es lo que permite el consolidado que soporta el pago quincenal al domiciliario. Sin el, Atlas sabria cuanto
-- cobro y no cuanto hay que pagar, que es justo el papel que contabilidad pidio.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. EL MARGEN, EN CONFIGURACION ───
ALTER TABLE "commercial_config"
  ADD COLUMN IF NOT EXISTS "flete_margen" numeric DEFAULT 0.03 NOT NULL;--> statement-breakpoint

ALTER TABLE "commercial_config"
  DROP CONSTRAINT IF EXISTS "commercial_config_flete_margen_en_rango";--> statement-breakpoint
-- Entre 0 y 1: un margen negativo cobraria menos de lo que cuesta, y uno mayor que 1 duplicaria el flete.
ALTER TABLE "commercial_config"
  ADD CONSTRAINT "commercial_config_flete_margen_en_rango" CHECK (
    "flete_margen" >= 0 AND "flete_margen" < 1
  );--> statement-breakpoint

COMMENT ON COLUMN "commercial_config"."flete_margen" IS
  'Margen sobre el costo del domiciliario, antes del IVA (3% por defecto). Compensa la comision que la pasarela cobra tambien sobre el flete, para que el envio quede neutro.';--> statement-breakpoint

-- ─── 2. `flete_tarifa` CAMBIA DE SIGNIFICADO ───
-- Era la tarifa unica al paciente. Ahora es el COSTO SUGERIDO por defecto, el que se precarga cuando la ciudad
-- no tiene uno propio. Se conserva la columna en vez de crear otra: es el mismo dato con otro papel, y una
-- columna nueva dejaria la vieja como una segunda fuente que alguien acabaria leyendo.
COMMENT ON COLUMN "commercial_config"."flete_tarifa" IS
  'Costo sugerido por defecto del domiciliario (NO la tarifa al paciente, que se calcula por envio). Se precarga en el formulario cuando la ciudad de destino no tiene un costo propio. NULA = no hay sugerencia y el profesional lo teclea.';--> statement-breakpoint

-- ─── 3. EL COSTO SUGERIDO POR CIUDAD ───
-- Se precarga y SE PUEDE CAMBIAR: es una sugerencia, no un tope. El que manda es lo que el profesional teclea,
-- porque es quien contrata el envio y sabe lo que le cobraron.
ALTER TABLE "delivery_cities"
  ADD COLUMN IF NOT EXISTS "costo_sugerido" numeric;--> statement-breakpoint

ALTER TABLE "delivery_cities"
  DROP CONSTRAINT IF EXISTS "delivery_cities_costo_positivo";--> statement-breakpoint
ALTER TABLE "delivery_cities"
  ADD CONSTRAINT "delivery_cities_costo_positivo" CHECK ("costo_sugerido" IS NULL OR "costo_sugerido" > 0);--> statement-breakpoint

COMMENT ON COLUMN "delivery_cities"."costo_sugerido" IS
  'Lo que suele cobrar el domiciliario a esa ciudad. Se precarga en el formulario y se puede cambiar: manda lo que el profesional teclea, que es quien contrata el envio.';--> statement-breakpoint

-- ─── 4. EL COSTO, SELLADO EN LA VENTA ───
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "shipping_cost" numeric;--> statement-breakpoint

ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_costo_solo_en_domicilio";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_costo_solo_en_domicilio" CHECK (
    "shipping_cost" IS NULL OR "delivery_mode" = 'domicilio'
  );--> statement-breakpoint

-- LO COBRADO NUNCA PUEDE SER MENOR QUE EL COSTO. Si lo fuera, CNV estaria pagando por despachar, que es el
-- caso que el margen existe para impedir. Es la misma clase de guarda que el trigger que impide que el reparto
-- deje a CNV en negativo.
ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_flete_cubre_el_costo";--> statement-breakpoint
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_flete_cubre_el_costo" CHECK (
    "shipping_cost" IS NULL OR "shipping_fee" IS NULL OR "shipping_fee" >= "shipping_cost"
  );--> statement-breakpoint

COMMENT ON COLUMN "transactions"."shipping_cost" IS
  'Lo que se le paga al domiciliario por ESTE envio, sellado al cobrar. Es lo que permite el consolidado que soporta su pago quincenal: sin el, Atlas sabria cuanto cobro y no cuanto hay que pagar.';--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transactions_despachos_del_periodo_idx"
  ON "transactions" ("operated_at")
  WHERE "delivery_mode" = 'domicilio';
