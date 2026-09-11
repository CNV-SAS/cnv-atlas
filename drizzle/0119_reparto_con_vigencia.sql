-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL REPARTO, CON VIGENCIA Y CON PISO  ·  Bloque 1  ·  2026-09-11
--
-- ── EL CRITERIO (Santiago, 2026-09-11) ───────────────────────────────────────────────────────────
--
-- La comision del Integrante es SUYA y aplica a todos los productos por igual: si algun dia hay uno al
-- 30%, le aplica a LUVIA y a la linea propia lo mismo. Asi que el reparto NO es una cifra por producto:
--
--   · la participacion del INTEGRANTE sale de su tasa (del profesional),
--   · la del PROVEEDOR sale del producto (solo en producto de tercero),
--   · y la de CNV es EL RESIDUO: 100% menos las dos anteriores.
--
-- EL MODELO COMERCIAL NO SOLO LO ADMITE, LO AFIRMA (§7.2): "El Integrante recibe la misma participacion
-- que en los productos propios, de modo que para el la operacion es indistinta. La diferencia la absorbe
-- CNV, que pasa de su margen habitual a un 10%." Y la §7.10 pide el reparto configurable "por producto y
-- por proveedor", no por Integrante.
--
-- LA CONSECUENCIA, dicha en voz alta: si el Integrante sube al 30%, CNV baja al 0% en LUVIA (70+30=100).
-- Por encima, CNV PAGA por vender. No es que se reparta distinto: es que el margen de CNV es lo que
-- sobra, y lo que sobra puede ser negativo.
--
-- ── POR QUE TODO ESTO NECESITA VIGENCIA ──────────────────────────────────────────────────────────
--
-- Contabilidad acepto el 10% de CNV en LUVIA SOLO PARA EL PILOTO: se renegocia antes de un segundo lote.
-- Asi que sabemos DE ANTEMANO que el reparto se va a mover, y una tabla sin vigencia obligaria a EDITAR
-- la fila el dia de la renegociacion. Editarla reescribiria lo que ya se liquido.
--
-- Y LA TASA DEL INTEGRANTE NECESITA LO MISMO, por la misma razon: dejo de ser un valor por defecto
-- cosmetico y paso a ser el termino del contrato que gobierna el dinero. Una liquidacion tiene que poder
-- explicarse, y "¿por que se liquido al 20%?" necesita una respuesta CON FECHA.
--
-- Cada venta sella su reparto, asi que el pasado ya estaba a salvo. Lo que faltaba era poder RESPONDER
-- por el, que es otra cosa.
--
-- ── EL PISO: DOS COSAS DISTINTAS QUE UN UMBRAL UNICO MEZCLA ──────────────────────────────────────
--
-- 1. BLOQUEAR EN NEGATIVO es una INVARIANTE DEL SISTEMA: CNV no puede pagar por vender. Va fija en el
--    trigger, no es configurable y no admite excepcion.
--
-- 2. AVISAR es POLITICA COMERCIAL, y es POR PRODUCTO. Un producto propio deja a CNV el 80% y LUVIA el
--    10%: no pueden compartir umbral. Con uno global del 10%, todo producto propio pasaria siempre y
--    LUVIA avisaria desde el primer dia. Por eso el umbral vive JUNTO AL REPARTO, con un valor global
--    por defecto para los que no declaren el suyo.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. CONFIGURACION COMERCIAL (fila unica, como ai_config) ──────────────────────────────────────
-- Existe para que el umbral por defecto NO viva en el codigo (principio 2 del modelo: nada de valores
-- fijos). Es tambien el sitio de las politicas que vengan.
CREATE TABLE IF NOT EXISTS "commercial_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Umbral de aviso por defecto, sobre el RESIDUO de CNV (fraccion 0..1). Cero = solo avisa si el
  -- residuo queda en cero; el negativo ya lo bloquea el trigger, que no es configurable.
  "margen_aviso_default" numeric NOT NULL DEFAULT 0,
  "updated_by" uuid REFERENCES "profiles"("id"),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "commercial_config_margen_rango" CHECK ("margen_aviso_default" >= 0 AND "margen_aviso_default" < 1)
);--> statement-breakpoint

INSERT INTO "commercial_config" ("margen_aviso_default")
SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM "commercial_config");--> statement-breakpoint

-- ── 2. LA TASA DEL INTEGRANTE, CON VIGENCIA ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "professional_commission_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "professional_id" uuid NOT NULL REFERENCES "professional_profiles"("id") ON DELETE cascade,
  -- Fraccion sobre la BASE SIN IVA (principio 1). 0,20 = 20%.
  "rate" numeric NOT NULL,
  "valid_from" date NOT NULL,
  -- NULL = vigente. Cerrar una vigencia es poner fecha aqui e insertar la nueva.
  "valid_to" date,
  "note" text,
  "created_by" uuid REFERENCES "profiles"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pcr_rate_rango" CHECK ("rate" >= 0 AND "rate" <= 1),
  CONSTRAINT "pcr_vigencia_coherente" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);--> statement-breakpoint

-- UNA SOLA VIGENTE POR PROFESIONAL. Indice unico parcial, el mismo mecanismo que
-- `model_versions_one_active_idx`: la garantia de "solo una activa" la da la base, no la aplicacion.
CREATE UNIQUE INDEX IF NOT EXISTS "pcr_una_vigente_por_profesional"
  ON "professional_commission_rates" ("professional_id") WHERE "valid_to" IS NULL;--> statement-breakpoint

-- BACKFILL: la tasa que cada profesional tiene hoy pasa a ser su vigencia desde el corte de arranque.
-- 2026-09-11 es la fecha de la purga, que es la que separa las pruebas de la operacion real.
INSERT INTO "professional_commission_rates" ("professional_id", "rate", "valid_from", "note")
SELECT pp."id", pp."commission_rate", DATE '2026-09-11',
       'Vigencia inicial: la tasa que tenía al corte de arranque'
  FROM "professional_profiles" pp
 WHERE NOT EXISTS (
   SELECT 1 FROM "professional_commission_rates" r WHERE r."professional_id" = pp."id"
 );--> statement-breakpoint

-- ── 3. LA PARTICIPACION DEL PROVEEDOR, CON VIGENCIA Y SU UMBRAL ──────────────────────────────────
--
-- SOLO LLEVA LA DEL PROVEEDOR. La del Integrante NO va aqui: es suya y vale para todos los productos.
-- La de CNV tampoco: es el residuo y guardarla seria una tercera cifra que puede contradecir a las otras
-- dos. Un producto propio simplemente no tiene fila, o la tiene con 0.
CREATE TABLE IF NOT EXISTS "revenue_splits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nutraceutical_id" uuid NOT NULL REFERENCES "nutraceuticals"("id") ON DELETE cascade,
  -- Fraccion sobre la BASE SIN IVA que se lleva el proveedor externo. LUVIA: 0,70.
  "supplier_share" numeric NOT NULL,
  -- UMBRAL DE AVISO DE ESTE PRODUCTO, sobre el residuo de CNV. NULL = usa el global de
  -- `commercial_config`. Existe porque un producto propio (CNV 80%) y uno de tercero (CNV 10%) no
  -- pueden compartir umbral.
  "margen_aviso" numeric,
  "valid_from" date NOT NULL,
  "valid_to" date,
  "note" text,
  "created_by" uuid REFERENCES "profiles"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "rs_share_rango" CHECK ("supplier_share" >= 0 AND "supplier_share" <= 1),
  CONSTRAINT "rs_aviso_rango" CHECK ("margen_aviso" IS NULL OR ("margen_aviso" >= 0 AND "margen_aviso" < 1)),
  CONSTRAINT "rs_vigencia_coherente" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "rs_una_vigente_por_producto"
  ON "revenue_splits" ("nutraceutical_id") WHERE "valid_to" IS NULL;--> statement-breakpoint

-- ── 4. EL GUARD: CNV NO PUEDE PAGAR POR VENDER ───────────────────────────────────────────────────
--
-- POR QUE EN LA BASE Y NO SOLO EN EL SERVICIO. Un CHECK no puede cruzar dos tablas, y la combinacion que
-- importa es exactamente eso: la tasa vive en una y la participacion del proveedor en otra. Cualquiera de
-- las dos escrituras puede cruzar el piso.
--
-- Y SOBRE TODO: el trigger es lo unico que un UPDATE a mano no puede saltarse, y estas tasas se van a
-- editar a mano alguna vez. Una regla que solo vive en el servicio es una regla que se salta el dia que
-- alguien entra por el editor de SQL, que es justo el dia en que nadie esta mirando.
--
-- LO QUE BLOQUEA es el NEGATIVO, que es invariante y no configurable. El umbral de aviso no bloquea
-- nada: se consulta con la vista `combinaciones_bajo_umbral`.
CREATE OR REPLACE FUNCTION public.reparto_residuo_cnv_valido() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
declare
  r record;
begin
  -- Se recalculan TODAS las combinaciones vigentes afectadas por esta escritura, no solo la fila nueva:
  -- subir la tasa de un profesional puede romper el residuo de varios productos a la vez.
  for r in
    select n.name as producto,
           pr.full_name as integrante,
           rs.supplier_share,
           pcr.rate,
           1 - rs.supplier_share - pcr.rate as residuo
      from public.revenue_splits rs
      join public.nutraceuticals n on n.id = rs.nutraceutical_id
      cross join public.professional_commission_rates pcr
      join public.professional_profiles pp on pp.id = pcr.professional_id
      join public.profiles pr on pr.id = pp.profile_id
     where rs.valid_to is null
       and pcr.valid_to is null
       and (1 - rs.supplier_share - pcr.rate) < 0
     limit 1
  loop
    raise exception
      'CNV no puede pagar por vender: con "%" al % %% y % al % %%, a CNV le queda % %%. El residuo de CNV no puede ser negativo.',
      r.producto, round(r.supplier_share * 100, 2), r.integrante, round(r.rate * 100, 2),
      round(r.residuo * 100, 2);
  end loop;
  return NEW;
end;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "pcr_residuo_valido_trg" ON "professional_commission_rates";--> statement-breakpoint
CREATE TRIGGER "pcr_residuo_valido_trg"
  AFTER INSERT OR UPDATE ON "professional_commission_rates"
  FOR EACH ROW EXECUTE FUNCTION public.reparto_residuo_cnv_valido();--> statement-breakpoint

DROP TRIGGER IF EXISTS "rs_residuo_valido_trg" ON "revenue_splits";--> statement-breakpoint
CREATE TRIGGER "rs_residuo_valido_trg"
  AFTER INSERT OR UPDATE ON "revenue_splits"
  FOR EACH ROW EXECUTE FUNCTION public.reparto_residuo_cnv_valido();--> statement-breakpoint

-- ── 5. EL REPORTE DE COMBINACIONES BAJO EL UMBRAL ────────────────────────────────────────────────
--
-- El trigger impide el negativo; esto muestra lo que esta POR ENCIMA DE CERO pero por debajo de lo que
-- la politica comercial considera aceptable. Es el tercer sitio del guard: las dos rutas de escritura, el
-- trigger, y esto, que atrapa lo que se cuele por donde no estemos mirando.
CREATE OR REPLACE VIEW public.combinaciones_bajo_umbral AS
SELECT n."name"                                   AS producto,
       pr."full_name"                             AS integrante,
       rs."supplier_share"                        AS participacion_proveedor,
       pcr."rate"                                 AS tasa_integrante,
       1 - rs."supplier_share" - pcr."rate"       AS residuo_cnv,
       COALESCE(rs."margen_aviso", cc."margen_aviso_default") AS umbral_aplicado
  FROM "revenue_splits" rs
  JOIN "nutraceuticals" n ON n."id" = rs."nutraceutical_id"
  CROSS JOIN "professional_commission_rates" pcr
  JOIN "professional_profiles" pp ON pp."id" = pcr."professional_id"
  JOIN "profiles" pr ON pr."id" = pp."profile_id"
  CROSS JOIN (SELECT "margen_aviso_default" FROM "commercial_config" LIMIT 1) cc
 WHERE rs."valid_to" IS NULL
   AND pcr."valid_to" IS NULL
   AND (1 - rs."supplier_share" - pcr."rate") <= COALESCE(rs."margen_aviso", cc."margen_aviso_default");--> statement-breakpoint

-- ── 6. RLS ───────────────────────────────────────────────────────────────────────────────────────
-- Las tres son configuracion comercial: las lee quien ve dinero, las escribe el admin. Ningun
-- profesional puede tocar su propia tasa, que es la mitad del sentido de tenerla con vigencia.
ALTER TABLE "commercial_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "professional_commission_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "revenue_splits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "commercial_config_select" ON "commercial_config"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion'));--> statement-breakpoint
CREATE POLICY "commercial_config_write" ON "commercial_config"
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));--> statement-breakpoint

-- El profesional SI puede leer SU tasa (la va a necesitar la pantalla de comisiones del Bloque 4), pero
-- no la de los demas y no puede escribir ninguna.
CREATE POLICY "pcr_select" ON "professional_commission_rates"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('direccion')
    OR public.is_own_professional_profile("professional_id")
  );--> statement-breakpoint
CREATE POLICY "pcr_write" ON "professional_commission_rates"
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));--> statement-breakpoint

CREATE POLICY "rs_select" ON "revenue_splits"
  FOR SELECT TO authenticated USING (public.has_role('admin') OR public.has_role('direccion'));--> statement-breakpoint
CREATE POLICY "rs_write" ON "revenue_splits"
  FOR ALL TO authenticated USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
