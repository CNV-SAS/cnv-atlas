-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL SALDO PASA A (UBICACION, PRODUCTO, LOTE)  ·  Bloque 1  ·  2026-09-11
--
-- ES LO QUE DESBLOQUEA LA BODEGA CENTRAL. Hoy el saldo se lleva por (profesional, producto), y un
-- movimiento de la central no tiene profesional: `professional_id` es NOT NULL, asi que las 1.284
-- unidades del primer lote no se pueden registrar aunque la ubicacion ya exista.
--
-- Y CIERRA EL PRINCIPIO 8: "todo movimiento de inventario se registra contra un lote, con su fecha de
-- vencimiento. Sin lote no hay trazabilidad hasta el paciente, y sin trazabilidad no hay retiro dirigido
-- posible." Hasta hoy `lote` era texto libre que no gobernaba nada.
--
-- ── EN LA NUBE ESTAN VACIAS; EN LOCAL NO, ASI QUE LA MIGRACION NO SE APOYA EN ESO ────────────────
--
-- La purga del 2026-09-11 dejo la NUBE en cero, y la primera version de esta migracion daba por hecho que
-- eso valia en todas partes: ponia `location_id` y `lot_id` en NOT NULL de golpe. En local, que tiene 28
-- movimientos sembrados, eso FALLA. Y fallaba en silencio: drizzle se paraba sin decir cual sentencia.
--
-- SE ARREGLA CON BACKFILL, y el arreglo es mejor que el original aunque la nube no lo necesite: una
-- migracion que solo funciona si la tabla esta vacia depende de un accidente, y ese accidente deja de ser
-- cierto en cuanto alguien siembra una base nueva.
--
-- QUE HACE EL BACKFILL con una fila que no sabe de donde salio: la ubicacion se deduce del profesional
-- (cada uno tiene la suya), y el lote se resuelve del texto libre que la fila ya traia, creandolo si hace
-- falta. Cuando ni eso hay, la fila cae en un lote llamado "SIN IDENTIFICAR", marcado como tal. NO SE
-- INVENTA UN LOTE PLAUSIBLE: un codigo verosimil en una fila historica es peor que uno que grita que no se
-- sabe, porque el dia del retiro alguien lo daria por bueno.
--
-- ── `professional_id` SE QUEDA, COMO CACHE VERIFICADO ────────────────────────────────────────────
--
-- La respuesta a "¿donde esta esto?" pasa a ser la UBICACION. Pero `professional_id` no se retira: se
-- vuelve NULLABLE y un trigger lo obliga a coincidir con el dueño de la ubicacion.
--
-- POR QUE Y NO DOS FUENTES: es el mismo patron que `nutraceutical_inventory.stock_quantity`, que ya es un
-- cache que solo escribe su trigger. Una copia que NADIE puede escribir a mano y que una garantia obliga a
-- coincidir no es una segunda fuente: es un indice. Lo que este proyecto ha pagado caro son las dos
-- fuentes que nadie compara, y esta se compara en cada escritura.
--
-- LO QUE COMPRA: los cinco servicios que hoy filtran por profesional (inventory, remesa, faltante, el
-- despacho del tratamiento y /mi-inventario) siguen funcionando, y la central entra igual porque en ella
-- la columna es NULL.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 0. PRODUCTO DE PRUEBA ────────────────────────────────────────────────────────────────────────
--
-- Santiago necesita poder probar ventas sin tocar la operacion real, y la condicion que puso es la que
-- manda: LO DE PRUEBA TIENE QUE PODER DISTINGUIRSE DE LO REAL CUANDO YA CONVIVAN. Ya paso con los cinco
-- pacientes de prueba entre 73 reales: lo que no se marca no se puede separar despues.
--
-- POR QUE UNA MARCA Y NO LAS OTRAS DOS OPCIONES:
--   · Habilitar uno de los seis `no_disponible` solo para Demo NO SE PUEDE: la bandera es del PRODUCTO,
--     no del profesional, asi que habilitarlo lo vuelve vendible para los siete Integrantes. Y hoy la
--     venta NO valida existencias, asi que cualquiera podria venderlo sin tener ni una unidad.
--   · Usar los cuatro reales y revertir es lo peor de las tres. Revertir el INVENTARIO si es limpio (los
--     movimientos son append-only, asi que un error se corrige con un movimiento inverso), pero una venta
--     de prueba ademas crea transaccion, comision, ingreso de CNV y, desde el Bloque 2, factura en Alegra.
--     El inventario se revierte; una factura emitida, no.
--
-- LA MARCA ES DATO, no memoria. Y sirve para lo que de verdad hace falta, que no es "distinguirlos a la
-- vista" sino que NO CONTAMINEN LAS CIFRAS: reportes, liquidaciones y la cola de facturacion los excluyen
-- por esta columna.
ALTER TABLE "nutraceuticals" ADD COLUMN IF NOT EXISTS "is_test" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- UN PRODUCTO DE PRUEBA NO PUEDE SER DE TERCERO: arrastraria obligaciones con un proveedor real
-- (liquidacion, faltantes, notas credito) por unidades que no existen.
ALTER TABLE "nutraceuticals"
  ADD CONSTRAINT "nutra_prueba_no_es_de_tercero"
  CHECK (NOT "is_test" OR "ownership" = 'propio');--> statement-breakpoint

-- ── 1. LOS MOVIMIENTOS GANAN UBICACION Y LOTE ────────────────────────────────────────────────────
ALTER TABLE "nutraceutical_stock_movements"
  ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "inventory_locations"("id") ON DELETE restrict,
  ADD COLUMN IF NOT EXISTS "lot_id" uuid REFERENCES "lots"("id") ON DELETE restrict;--> statement-breakpoint

ALTER TABLE "nutraceutical_stock_movements" ALTER COLUMN "professional_id" DROP NOT NULL;--> statement-breakpoint

-- ── LOS TRES TRIGGERS SE LEVANTAN PARA EL BACKFILL ───────────────────────────────────────────────
--
-- Y NO ES UN TRAMITE: el primer intento de esta migracion fallo justo aqui. Los movimientos son
-- APPEND-ONLY por trigger, asi que el UPDATE que rellena `location_id` esta PROHIBIDO, y con razon: es la
-- garantia que impide editar un registro de custodia. Rellenar una columna nueva es la unica excepcion
-- legitima, y tiene que ser explicita.
--
-- Y LOS OTROS DOS TAMBIEN, por una razon distinta: en este punto del archivo `nutra_movement_apply` y
-- `nutra_inventory_coherence` todavia son los VIEJOS, que suman por (profesional, producto). Con el saldo
-- ya reconstruido por (ubicacion, producto, lote), el de coherencia rechazaria cada fila por no cuadrar
-- contra una llave que ya no es la suya.
--
-- SE DEVUELVEN LOS TRES al final de esta seccion. Toda la migracion corre en una transaccion, asi que un
-- fallo a mitad los restaura solo.
ALTER TABLE "nutraceutical_stock_movements" DISABLE TRIGGER "nutra_movement_append_only_trg";--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements" DISABLE TRIGGER "nutra_movement_apply_trg";--> statement-breakpoint
ALTER TABLE "nutraceutical_inventory" DISABLE TRIGGER "nutra_inventory_coherence_trg";--> statement-breakpoint

-- BACKFILL DE LOS MOVIMIENTOS EXISTENTES (ninguno en la nube; 28 en una base local sembrada).
UPDATE "nutraceutical_stock_movements" m
   SET "location_id" = l."id"
  FROM "inventory_locations" l
 WHERE l."professional_id" = m."professional_id" AND m."location_id" IS NULL;--> statement-breakpoint

-- El lote que la fila declaraba en texto, o uno marcado SIN IDENTIFICAR. Un vencimiento lejano y una nota
-- que dice lo que es: estas filas no sirven para un retiro dirigido y tienen que poder encontrarse.
INSERT INTO "lots" ("nutraceutical_id", "code", "expires_on", "notes")
SELECT DISTINCT m."nutraceutical_id", COALESCE(NULLIF(TRIM(m."lote"), ''), 'SIN IDENTIFICAR'),
       DATE '2099-12-31',
       'Creado por la migración 0121 al pasar el saldo a (ubicación, producto, lote). Si el código dice SIN IDENTIFICAR, esa fila es anterior al control por lote y no sirve para un retiro dirigido.'
  FROM "nutraceutical_stock_movements" m
 WHERE m."lot_id" IS NULL
ON CONFLICT ("nutraceutical_id", "code") DO NOTHING;--> statement-breakpoint

UPDATE "nutraceutical_stock_movements" m
   SET "lot_id" = lo."id"
  FROM "lots" lo
 WHERE lo."nutraceutical_id" = m."nutraceutical_id"
   AND lo."code" = COALESCE(NULLIF(TRIM(m."lote"), ''), 'SIN IDENTIFICAR')
   AND m."lot_id" IS NULL;--> statement-breakpoint

-- Obligatorios a partir de aqui.
ALTER TABLE "nutraceutical_stock_movements" ALTER COLUMN "location_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements" ALTER COLUMN "lot_id" SET NOT NULL;--> statement-breakpoint

-- EL LOTE TIENE QUE SER DEL PRODUCTO DEL MOVIMIENTO. Sin esto se podria descontar el lote de un producto
-- del saldo de otro, y el saldo cuadraria: el error solo aparece al rastrear un retiro, que es el unico
-- momento en que no se puede corregir.
CREATE OR REPLACE FUNCTION public.nutra_movement_lote_del_producto() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
declare v_nutra uuid; v_prof uuid; v_kind text;
begin
  select nutraceutical_id into v_nutra from public.lots where id = NEW.lot_id;
  if v_nutra is distinct from NEW.nutraceutical_id then
    raise exception 'El lote no pertenece a este producto.';
  end if;

  -- Y `professional_id` TIENE QUE COINCIDIR CON EL DUEÑO DE LA UBICACION. Es lo que vuelve la columna un
  -- cache verificado en vez de una segunda fuente: aqui no se puede escribir una cosa y en la ubicacion
  -- otra. En la bodega central la ubicacion no tiene dueño, asi que la columna va NULL.
  select professional_id, kind into v_prof, v_kind
    from public.inventory_locations where id = NEW.location_id;
  if NEW.professional_id is distinct from v_prof then
    raise exception 'El profesional del movimiento (%) no coincide con el dueño de la ubicación (%).',
      NEW.professional_id, v_prof;
  end if;
  return NEW;
end;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "nutra_movement_coherencia_trg" ON "nutraceutical_stock_movements";--> statement-breakpoint
CREATE TRIGGER "nutra_movement_coherencia_trg"
  BEFORE INSERT ON "nutraceutical_stock_movements"
  FOR EACH ROW EXECUTE FUNCTION public.nutra_movement_lote_del_producto();--> statement-breakpoint

-- ── 2. EL SALDO CAMBIA DE LLAVE ──────────────────────────────────────────────────────────────────
ALTER TABLE "nutraceutical_inventory"
  ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "inventory_locations"("id") ON DELETE restrict,
  ADD COLUMN IF NOT EXISTS "lot_id" uuid REFERENCES "lots"("id") ON DELETE restrict;--> statement-breakpoint

ALTER TABLE "nutraceutical_inventory" ALTER COLUMN "professional_id" DROP NOT NULL;--> statement-breakpoint

-- EL SALDO SE RECONSTRUYE, NO SE CONVIERTE. Una fila vieja de saldo es la suma por (profesional,
-- producto), que con la llave nueva puede repartirse entre varios lotes: no hay forma de partirla bien.
-- Asi que se borran las filas viejas y se recalculan desde los movimientos, que son la fuente de verdad.
-- El saldo siempre fue una proyeccion; esto solo lo vuelve a proyectar.
ALTER TABLE "nutraceutical_inventory" DROP CONSTRAINT IF EXISTS "nutra_inventory_prof_nutra_unique";--> statement-breakpoint

DELETE FROM "nutraceutical_inventory";--> statement-breakpoint

INSERT INTO "nutraceutical_inventory"
       ("location_id", "professional_id", "nutraceutical_id", "lot_id", "stock_quantity", "last_updated")
SELECT m."location_id", m."professional_id", m."nutraceutical_id", m."lot_id", SUM(m."delta"), now()
  FROM "nutraceutical_stock_movements" m
 WHERE m."type" <> 'remesa'
 GROUP BY m."location_id", m."professional_id", m."nutraceutical_id", m."lot_id";--> statement-breakpoint

ALTER TABLE "nutraceutical_inventory" ALTER COLUMN "location_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "nutraceutical_inventory" ALTER COLUMN "lot_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "nutraceutical_stock_movements" ENABLE TRIGGER "nutra_movement_append_only_trg";--> statement-breakpoint
ALTER TABLE "nutraceutical_stock_movements" ENABLE TRIGGER "nutra_movement_apply_trg";--> statement-breakpoint
ALTER TABLE "nutraceutical_inventory" ENABLE TRIGGER "nutra_inventory_coherence_trg";--> statement-breakpoint

ALTER TABLE "nutraceutical_inventory"
  ADD CONSTRAINT "nutra_inventory_loc_nutra_lote_unique"
  UNIQUE ("location_id", "nutraceutical_id", "lot_id");--> statement-breakpoint

-- ── 3. LOS DOS TRIGGERS DEL SALDO, REESCRITOS ────────────────────────────────────────────────────
--
-- ⚠ LOS DOS CONSERVAN `type <> 'remesa'`, Y ESTO NO ES UN DETALLE. Lo introdujo la migracion 0052: una
-- remesa DECLARADA por CNV no mueve el saldo del Integrante hasta que el la CONFIRMA con lo que de verdad
-- llego, que puede diferir. Perder esa exclusion al reescribir sumaria al saldo mercancia que quiza nunca
-- llego, y el error seria SILENCIOSO: el saldo cuadraria consigo mismo y no con la vitrina.
CREATE OR REPLACE FUNCTION public.nutra_movement_apply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
declare v_sum integer;
begin
  select coalesce(sum(delta), 0) into v_sum
    from public.nutraceutical_stock_movements
   where location_id = NEW.location_id
     and nutraceutical_id = NEW.nutraceutical_id
     and lot_id = NEW.lot_id
     and type <> 'remesa';
  insert into public.nutraceutical_inventory
      (location_id, professional_id, nutraceutical_id, lot_id, stock_quantity, last_updated)
    values (NEW.location_id, NEW.professional_id, NEW.nutraceutical_id, NEW.lot_id, v_sum, now())
    on conflict (location_id, nutraceutical_id, lot_id)
    do update set stock_quantity = v_sum, professional_id = excluded.professional_id, last_updated = now();
  return null;
end;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.nutra_inventory_coherence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
declare v_sum integer;
begin
  select coalesce(sum(delta), 0) into v_sum
    from public.nutraceutical_stock_movements
   where location_id = NEW.location_id
     and nutraceutical_id = NEW.nutraceutical_id
     and lot_id = NEW.lot_id
     and type <> 'remesa';
  if NEW.stock_quantity is distinct from v_sum then
    raise exception 'El saldo solo puede ser la suma de los movimientos (esperado %, recibido %).',
      v_sum, NEW.stock_quantity;
  end if;
  return NEW;
end;
$$;--> statement-breakpoint

-- ── 4. RLS: EL ALCANCE SE RESUELVE POR LA UBICACION ──────────────────────────────────────────────
--
-- Antes la politica miraba `professional_id` de la propia fila. Ahora va por la ubicacion, que es la
-- fuente: asi una fila de la bodega central (sin profesional) no queda fuera de toda politica por
-- accidente, que es lo que pasaria con `is_own_professional_profile(NULL)`.
DROP POLICY IF EXISTS "nutra_movements_select" ON "nutraceutical_stock_movements";--> statement-breakpoint
CREATE POLICY "nutra_movements_select" ON "nutraceutical_stock_movements"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = "nutraceutical_stock_movements".location_id
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    )
  );--> statement-breakpoint

DROP POLICY IF EXISTS "nutra_movements_insert" ON "nutraceutical_stock_movements";--> statement-breakpoint
CREATE POLICY "nutra_movements_insert" ON "nutraceutical_stock_movements"
  FOR INSERT TO authenticated WITH CHECK (
    (type = 'remesa' AND (public.has_role('admin') OR public.has_role('soporte')))
    OR (type <> 'remesa' AND EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = location_id
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    ))
    -- La bodega CENTRAL la mueve CNV, no un Integrante.
    OR (public.has_role('admin') OR public.has_role('soporte'))
  );--> statement-breakpoint

DROP POLICY IF EXISTS "nutra_inventory_select" ON "nutraceutical_inventory";--> statement-breakpoint
CREATE POLICY "nutra_inventory_select" ON "nutraceutical_inventory"
  FOR SELECT TO authenticated USING (
    public.has_role('admin') OR public.has_role('soporte') OR public.has_role('direccion')
    OR EXISTS (
      SELECT 1 FROM public.inventory_locations l
       WHERE l.id = "nutraceutical_inventory".location_id
         AND l.professional_id IS NOT NULL
         AND public.is_own_professional_profile(l.professional_id)
    )
  );
