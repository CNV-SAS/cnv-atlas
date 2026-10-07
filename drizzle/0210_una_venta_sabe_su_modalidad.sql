-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UNA VENTA SABE SU MODALIDAD, Y LO SABE EN UN SOLO SITIO
--
-- Sub-tarea 1 de `docs/entregas/PLAN_REGISTRO_DISTRIBUCION_2026-10-06.md`, aprobado por Santiago.
--
-- ═══ EL PROBLEMA: LA MODALIDAD ESTA SELLADA, PERO EN EL GRANO EQUIVOCADO ═══
--
-- `transaction_items.modality` se sella por LINEA en el momento de la venta, leyendo la vigencia del
-- Integrante EN LA FECHA DE LA VENTA (0178). Eso esta bien y no se toca.
--
-- PERO TODO LO QUE NECESITA FILTRAR POR MODALIDAD MIRA VENTAS, no lineas: la cola de facturacion de Alegra
-- (cinco consultas), los insights de direccion, el tablero, la bandeja de /pagos. Cada uno tendria que unirse
-- a `transaction_items` y agregar, y ahi nacen dos problemas:
--
--   1. CINCO CONSULTAS CON LA MISMA REGLA ESCRITA CINCO VECES es exactamente como se desincronizan. Ya pasó
--      con el filtro de prueba: nueve lectores filtrando por tres marcas distintas, que es lo que la 0203
--      vino a reducir a una columna.
--   2. Y UNA VENTA CON LINEAS DE DOS MODALIDADES es representable en la tabla aunque no pueda ocurrir, asi
--      que cada consulta tendria que decidir que hacer con ese caso imposible. Cinco decisiones, cinco
--      criterios.
--
-- ═══ LA RESPUESTA ES LA MISMA DE LA 0203: UNA COLUMNA DERIVADA ═══
--
-- DERIVADA Y NO ESCRITA POR LA APLICACION, y la razon es la que hizo correcta a la 0203: una columna que el
-- escritor pone puede divergir de lo sellado en las lineas; una derivada no puede, porque su UNICA fuente son
-- las lineas.
--
-- ── EL RIESGO CENTRAL QUE ESTA COLUMNA EXISTE PARA PODER CERRAR ──
--
-- La cola de facturacion recoge por `status = 'paid'`. Una venta bajo Distribucion nace pagada, porque ESTA
-- pagada: el paciente ya le pago al Integrante. O sea que entra SOLA en la cola, y CNV le emitiria al paciente
-- una factura por un producto que YA FACTURO LA INTEGRANTE: dos documentos fiscales por una venta, uno falso.
--
-- Eso no lo ve tsc, ni el lint, ni un test con la base mockeada. Con esta columna, excluirlo es un `and` por
-- consulta, y su candado corre contra base real.
--
-- ═══ LA TRAMPA QUE ESTA MIGRACION EVITA A PROPOSITO (condicion de Santiago) ═══
--
-- EL TRIGGER DERIVA DE `transaction_items.modality`, QUE ES EL VALOR SELLADO. NO de `professional_modalities`,
-- que parece el sitio natural porque es donde vive la modalidad.
--
-- Si colgara de ahi, CADA CAMBIO DE MODALIDAD REESCRIBIRIA LA HISTORIA: las ventas viejas pasarian al regimen
-- nuevo, una cuenta quincenal ya emitida cambiaria de contenido, y nadie lo notaria hasta cuadrar cifras. Es
-- exactamente el fallo que la 0178 evito al sellar por fecha, y el que esta columna podria reintroducir.
--
-- Santiago lo pidio verificado: un profesional puede ir y volver entre modalidades varias veces. Lo soporta,
-- porque `modalidadEnLaFecha` elige la vigencia que cubria el dia de la venta y la base garantiza una sola
-- vigencia abierta a la vez (indice unico parcial de la 0178). Su candado lo prueba: cambiar la modalidad del
-- Integrante NO mueve las ventas anteriores.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 'comision' POR DEFECTO, y no NULL: es lo que eran todas las ventas antes de que Distribucion existiera, y es
-- lo mismo que decide `MODALIDAD_POR_DEFECTO` en el modulo puro. Un NULL obligaria a cada consulta a decidir
-- que hacer con el, que es la clase de decision repartida que esta columna viene a quitar.
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "modalidad_de_la_venta" text NOT NULL DEFAULT 'comision';--> statement-breakpoint

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_modalidad_valida";--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_modalidad_valida"
  CHECK ("modalidad_de_la_venta" IN ('comision', 'distribucion'));--> statement-breakpoint

COMMENT ON COLUMN "transactions"."modalidad_de_la_venta" IS
  'DERIVADA por trigger desde transaction_items.modality (el valor SELLADO en la venta). No la escribe la aplicacion. Un cambio de modalidad del Integrante NO reescribe las ventas anteriores: la 0178 sella por la fecha de la venta.';--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.recomputar_modalidad_de_venta(p_tx uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE transactions t
     SET modalidad_de_la_venta = COALESCE(
           -- LA MODALIDAD DE SUS LINEAS SELLADAS. `min` y no `max` por una razon concreta: si por un defecto
           -- futuro una venta llegara a tener lineas de las dos, 'comision' gana alfabeticamente, y ese es el
           -- lado SEGURO de equivocarse. Una venta de Comision tratada como Distribucion no se facturaria al
           -- paciente y el dinero de CNV quedaria sin documento; al reves solo sobra una revision.
           (SELECT MIN(ti.modality) FROM transaction_items ti
             WHERE ti.transaction_id = t.id AND ti.modality IS NOT NULL),
           'comision'
         )
   WHERE t.id = p_tx;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.recomputar_modalidad_de_venta(uuid) FROM anon, authenticated;--> statement-breakpoint

-- ── EL DISPARADOR: la linea, que es la unica fuente ──
--
-- UNO SOLO, y eso es la diferencia con la 0203 (que tiene cuatro). La marca de prueba depende de tres cosas
-- que cambian por su cuenta (el profesional, el paciente, el producto); la modalidad depende SOLO de lo que se
-- sello en la linea. Agregar un disparador sobre `professional_modalities` seria justamente la trampa.
CREATE OR REPLACE FUNCTION public.trg_modalidad_por_linea()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM public.recomputar_modalidad_de_venta(OLD.transaction_id); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.recomputar_modalidad_de_venta(NEW.transaction_id); END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "lineas_recomputan_modalidad_de_venta" ON "transaction_items";--> statement-breakpoint
CREATE TRIGGER "lineas_recomputan_modalidad_de_venta"
  AFTER INSERT OR UPDATE OF "modality" OR DELETE ON "transaction_items"
  FOR EACH ROW EXECUTE FUNCTION public.trg_modalidad_por_linea();--> statement-breakpoint

-- ── EL RELLENO DE LO QUE YA EXISTE ──
--
-- Se recomputa cada venta que tenga lineas con modalidad sellada. Las que no la tengan se quedan en el
-- default 'comision', que es lo que eran.
UPDATE transactions t
   SET modalidad_de_la_venta = COALESCE(
         (SELECT MIN(ti.modality) FROM transaction_items ti
           WHERE ti.transaction_id = t.id AND ti.modality IS NOT NULL),
         'comision'
       );--> statement-breakpoint

-- EL INDICE va por modalidad + estado, que es la forma de la pregunta que hacen los lectores: "las ventas
-- pagadas de Comision" (la cola de facturacion) y "las de Distribucion del corte" (la cuenta quincenal).
CREATE INDEX IF NOT EXISTS "transactions_modalidad_status_idx"
  ON "transactions" ("modalidad_de_la_venta", "status");
