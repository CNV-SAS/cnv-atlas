-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA ALERTA DE VENCIMIENTO, Y SU REGISTRO  ·  2026-09-28
--
-- EL HUECO: los lotes tienen `expires_on` desde la 0121 y el despacho ya toma el que primero vence (FEFO),
-- pero NADA AVISA. Un frasco vencido en la vitrina es producto de CNV que ya no se puede vender, y el modelo
-- comercial no lo deja como perdida sin dueño: define quien lo asume, y lo hace depender de un registro que
-- hasta hoy no existia.
--
-- ── LAS DOS FRASES QUE ESTA MIGRACION CONVIERTE EN MECANISMO ──
--
--   "El producto no vendido que se vence lo asume CNV, por conservar la propiedad, SALVO que Atlas haya
--    generado la alerta de vencimiento y el Integrante no haya actuado, caso en el cual lo asume el al
--    precio de facturacion, con el mismo tratamiento del faltante."
--
--   "El sistema alerta con sesenta dias de anticipacion sobre el vencimiento de cada lote en poder de un
--    Integrante, y registra si la alerta fue vista y atendida. ESE REGISTRO ES LO QUE DETERMINA QUIEN
--    ASUME EL VENCIDO."
--
-- Asi que la alerta NO ES UN CORREO: es una FILA. El correo es como se entrega; lo que sostiene un cargo
-- seis meses despues es el registro de cuando se genero, con cuantos dias de anticipacion, cuantas unidades
-- habia y si la vio. Un aviso que solo existe como correo enviado no se puede oponer a nadie.
--
-- ── Y "ATENDIDA" NO ES UNA COLUMNA, A PROPOSITO ──
--
-- Se deriva: el lote se atendio si sus unidades en esa ubicacion llegaron a CERO antes de vencer (se vendio
-- o se devolvio a CNV). Una columna "atendida" seria una declaracion que puede contradecir al saldo, y esa
-- contradiccion es justo la familia de defectos que mas ha costado en este proyecto (dos partes de la
-- pantalla que leen fuentes distintas). Lo que el sistema NO puede deducir, y por eso si se guarda, es si
-- la VIO.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. LA VENTANA, EN CONFIGURACION ───
-- Principio 2 del modelo comercial, textual: "Nada de valores fijos en el codigo... dias de alerta de
-- vencimiento". 60 es el defecto que el modelo fija, no una preferencia nuestra.
ALTER TABLE "commercial_config"
  ADD COLUMN IF NOT EXISTS "dias_alerta_vencimiento" integer NOT NULL DEFAULT 60;--> statement-breakpoint

ALTER TABLE "commercial_config"
  DROP CONSTRAINT IF EXISTS "commercial_config_dias_alerta_positivo";--> statement-breakpoint
-- Cero o negativo apagaria la alerta en silencio, y apagarla es cambiar quien asume los vencidos.
ALTER TABLE "commercial_config"
  ADD CONSTRAINT "commercial_config_dias_alerta_positivo" CHECK ("dias_alerta_vencimiento" > 0);--> statement-breakpoint

COMMENT ON COLUMN "commercial_config"."dias_alerta_vencimiento" IS
  'Dias de anticipacion de la alerta de vencimiento (modelo comercial: 60). Cambiarlo cambia quien asume los vencidos futuros, no los pasados: cada alerta sella el valor con el que se genero.';--> statement-breakpoint

-- ─── 2. EL REGISTRO DE LA ALERTA ───
CREATE TABLE IF NOT EXISTS "lot_expiry_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL REFERENCES "lots"("id"),
  "location_id" uuid NOT NULL REFERENCES "inventory_locations"("id"),
  "nutraceutical_id" uuid NOT NULL REFERENCES "nutraceuticals"("id"),
  -- Dueño de la ubicacion. NULL = bodega central (sin dueño): esa alerta AVISA pero nunca desplaza el
  -- vencido a nadie, porque el modelo solo lo hace con lotes "en poder de un Integrante".
  "professional_id" uuid REFERENCES "professional_profiles"("id"),
  -- COPIA SELLADA del vencimiento del lote y de las unidades que habia al alertar. El lote no cambia de
  -- fecha, pero el saldo si: sin esta copia, la fila de dentro de un año no podria decir de que aviso.
  "expires_on" date NOT NULL,
  "units_at_alert" integer NOT NULL,
  -- Los dias de anticipacion VIGENTES al generarla. Sellados por la misma razon que `sealed_unit_price` en
  -- el faltante: si mañana CNV cambia la ventana a 30, esta alerta sigue explicando los 60 que dio.
  "days_ahead" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  -- VISTA: lo unico que se guarda por declaracion, porque es lo unico que el sistema no puede deducir.
  "seen_at" timestamptz,
  "seen_by" uuid REFERENCES "profiles"("id")
);--> statement-breakpoint

-- UNA ALERTA POR LOTE Y UBICACION. Es lo que vuelve idempotente la tarea diaria: correrla dos veces no
-- genera dos avisos, y sobre todo no reinicia el reloj de la anticipacion (una alerta que se regenerara
-- cada dia diria "te avise ayer" para siempre, y eso destruiria el registro que decide quien paga).
CREATE UNIQUE INDEX IF NOT EXISTS "lot_expiry_alerts_una_por_lote_y_ubicacion"
  ON "lot_expiry_alerts" ("lot_id", "location_id");--> statement-breakpoint

-- Las dos mitades de "vista" viajan juntas. `IS NULL` nunca devuelve NULL, asi que este CHECK si evalua
-- (a diferencia del de la 0181, que con la columna nula daba NULL y PASABA: en Postgres un CHECK que
-- evalua a NULL se cumple).
ALTER TABLE "lot_expiry_alerts"
  DROP CONSTRAINT IF EXISTS "lot_expiry_alerts_vista_completa";--> statement-breakpoint
ALTER TABLE "lot_expiry_alerts"
  ADD CONSTRAINT "lot_expiry_alerts_vista_completa" CHECK (
    ("seen_at" IS NULL) = ("seen_by" IS NULL)
  );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "lot_expiry_alerts_prof_idx"
  ON "lot_expiry_alerts" ("professional_id", "expires_on");--> statement-breakpoint

COMMENT ON TABLE "lot_expiry_alerts" IS
  'El REGISTRO de la alerta de vencimiento, que es lo que determina quien asume un lote vencido (modelo comercial, seccion de vencidos). No es el correo: es el hecho. "Atendida" no es columna, se deriva de que el saldo del lote llegue a cero antes de vencer.';--> statement-breakpoint

-- ─── 3. RLS: EL INTEGRANTE VE LAS SUYAS, CNV LAS DE TODOS ───
ALTER TABLE "lot_expiry_alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- EL ALCANCE SE RESUELVE POR LA UBICACION, no por `professional_id` de la fila. Es la leccion escrita en la
-- 0121: una fila de la bodega central (sin dueño) quedaria fuera de toda politica por accidente, porque
-- `is_own_professional_profile(NULL)` no es verdadero para nadie.
DROP POLICY IF EXISTS "lot_expiry_alerts_select_propias" ON "lot_expiry_alerts";--> statement-breakpoint
CREATE POLICY "lot_expiry_alerts_select_propias" ON "lot_expiry_alerts"
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = "lot_expiry_alerts"."location_id"
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    )
  );--> statement-breakpoint

-- MARCARLA VISTA ES LO UNICO QUE EL INTEGRANTE PUEDE ESCRIBIR, y solo sobre las suyas. La generacion es de
-- la tarea programada (service role); el resto de las columnas no se editan nunca.
DROP POLICY IF EXISTS "lot_expiry_alerts_update_vista_propia" ON "lot_expiry_alerts";--> statement-breakpoint
CREATE POLICY "lot_expiry_alerts_update_vista_propia" ON "lot_expiry_alerts"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = "lot_expiry_alerts"."location_id"
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = "lot_expiry_alerts"."location_id"
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    )
  );--> statement-breakpoint

-- Y LA FILA ES INMUTABLE SALVO LA MARCA DE VISTA. Sin esto, la politica de arriba dejaria mover
-- `days_ahead` o `expires_on`, que es exactamente lo que no puede cambiar: son la prueba.
CREATE OR REPLACE FUNCTION "lot_expiry_alerts_solo_vista"() RETURNS trigger AS $$
BEGIN
  IF NEW."lot_id" <> OLD."lot_id"
     OR NEW."location_id" <> OLD."location_id"
     OR NEW."nutraceutical_id" <> OLD."nutraceutical_id"
     OR NEW."professional_id" IS DISTINCT FROM OLD."professional_id"
     OR NEW."expires_on" <> OLD."expires_on"
     OR NEW."units_at_alert" <> OLD."units_at_alert"
     OR NEW."days_ahead" <> OLD."days_ahead"
     OR NEW."created_at" <> OLD."created_at" THEN
    RAISE EXCEPTION 'Una alerta de vencimiento no se edita: es la prueba de que se aviso. Solo se puede marcar vista.';
  END IF;
  -- Y VISTA SE MARCA UNA VEZ: la primera vez es la que cuenta. Volver a escribirla movería la fecha del
  -- aviso hacia adelante, que es justo lo que le conviene a quien quiera discutir el cargo.
  IF OLD."seen_at" IS NOT NULL AND NEW."seen_at" IS DISTINCT FROM OLD."seen_at" THEN
    RAISE EXCEPTION 'La alerta ya estaba marcada vista el %; esa fecha no se mueve.', OLD."seen_at";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS "lot_expiry_alerts_solo_vista_trg" ON "lot_expiry_alerts";--> statement-breakpoint
CREATE TRIGGER "lot_expiry_alerts_solo_vista_trg"
  BEFORE UPDATE ON "lot_expiry_alerts"
  FOR EACH ROW EXECUTE FUNCTION "lot_expiry_alerts_solo_vista"();
