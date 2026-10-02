-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UNA VENTA SABE SI ES DE PRUEBA, Y LO SABE EN UN SOLO SITIO
--
-- ═══ POR QUE ESTA MIGRACION EXISTE: SEIS DEFECTOS CON LA MISMA FORMA ═══
--
-- En dos semanas, seis veces el mismo defecto: dos pantallas de la misma cifra, el filtro en una y no en la
-- otra. El inventario (1.903 contra 1.820), la RLS, el dinero del paciente marcado, el producto de prueba en
-- las ventas, el tablero de admin, y los dos historicos del profesional (244.700 contra 154.700).
--
-- Y LA SEXTA ENSEÑO LO QUE FALTABA ENTENDER: los dos lectores aplicaban EL MISMO FILTRO y daban distinto,
-- porque el INSUMO del filtro era distinto (uno pedia los pacientes marcados bajo la RLS del profesional y no
-- los veia todos). O sea que ni compartir la regla ni compartir la aritmetica alcanza: mientras cada lector
-- arme su propio universo, pueden divergir.
--
-- ASI QUE LA RESPUESTA NO ES OTRO FILTRO BIEN ESCRITO: es que la pregunta "¿esta venta cuenta?" tenga UNA
-- respuesta, guardada, que todos lean igual. Nueve lectores filtran hoy por tres marcas distintas; esto
-- las reduce a una columna.
--
-- ── LA REGLA, con las tres marcas que ya existen ──
--
-- Una venta NO cuenta como operacion si:
--   · su PROFESIONAL es una cuenta de demostracion (manda sobre las otras dos: si la cuenta es de prueba,
--     nada de lo que pasa por sus manos cuenta), o
--   · su PACIENTE cuenta como de prueba (marcado o derivado, ver 0202), o
--   · alguna de sus LINEAS es de un producto de prueba (y no pueden mezclarse: lo impide el servicio).
--
-- ── LO QUE ESTA COLUMNA NO RESUELVE, y hay que seguir distinguiendo ──
--
-- La bandeja de "ventas por revisar" NO usa esta columna para el caso de SIN SALDO, a proposito: si el
-- producto era REAL, el descuento de inventario tambien fue real, y la vitrina esta descuadrada de verdad
-- aunque el paciente sea de prueba. Esconderlo esconderia un problema fisico. Esa bandeja mira el PRODUCTO.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "transactions"
  -- DERIVADA: la escribe el trigger, nunca la aplicacion.
  ADD COLUMN IF NOT EXISTS "cuenta_como_de_prueba" boolean NOT NULL DEFAULT false;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.recomputar_venta_de_prueba(p_tx uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE transactions t
     SET cuenta_como_de_prueba = (
           EXISTS (
             SELECT 1 FROM professional_profiles pp
              WHERE pp.id = t.professional_id AND COALESCE(pp.is_test, false)
           )
           OR EXISTS (
             SELECT 1 FROM patients pa
              WHERE pa.id = t.patient_id AND COALESCE(pa.cuenta_como_de_prueba, false)
           )
           OR EXISTS (
             SELECT 1 FROM transaction_items ti
               JOIN nutraceuticals n ON n.id = ti.nutraceutical_id
              WHERE ti.transaction_id = t.id AND COALESCE(n.is_test, false)
           )
         )
   WHERE t.id = p_tx;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.recomputar_venta_de_prueba(uuid) FROM anon, authenticated;--> statement-breakpoint

-- ── LOS DISPARADORES: uno por cada cosa que puede cambiar la respuesta ──

CREATE OR REPLACE FUNCTION public.trg_venta_de_prueba_propia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.recomputar_venta_de_prueba(NEW.id);
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "transactions_recomputa_marca" ON "transactions";--> statement-breakpoint
CREATE TRIGGER "transactions_recomputa_marca"
  AFTER INSERT OR UPDATE OF "professional_id", "patient_id" ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION public.trg_venta_de_prueba_propia();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.trg_venta_de_prueba_por_linea()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM public.recomputar_venta_de_prueba(OLD.transaction_id); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.recomputar_venta_de_prueba(NEW.transaction_id); END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "lineas_recomputan_marca_de_venta" ON "transaction_items";--> statement-breakpoint
CREATE TRIGGER "lineas_recomputan_marca_de_venta"
  AFTER INSERT OR UPDATE OR DELETE ON "transaction_items"
  FOR EACH ROW EXECUTE FUNCTION public.trg_venta_de_prueba_por_linea();--> statement-breakpoint

-- Marcar un PACIENTE arrastra sus ventas. Es el caso que Santiago usa para limpiar.
CREATE OR REPLACE FUNCTION public.trg_venta_de_prueba_por_paciente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_tx uuid;
BEGIN
  FOR v_tx IN SELECT id FROM transactions WHERE patient_id = NEW.id LOOP
    PERFORM public.recomputar_venta_de_prueba(v_tx);
  END LOOP;
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "paciente_recomputa_marca_de_sus_ventas" ON "patients";--> statement-breakpoint
CREATE TRIGGER "paciente_recomputa_marca_de_sus_ventas"
  AFTER UPDATE OF "cuenta_como_de_prueba" ON "patients"
  FOR EACH ROW EXECUTE FUNCTION public.trg_venta_de_prueba_por_paciente();--> statement-breakpoint

-- Marcar un PROFESIONAL arrastra las suyas.
CREATE OR REPLACE FUNCTION public.trg_venta_de_prueba_por_profesional()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_tx uuid;
BEGIN
  FOR v_tx IN SELECT id FROM transactions WHERE professional_id = NEW.id LOOP
    PERFORM public.recomputar_venta_de_prueba(v_tx);
  END LOOP;
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "profesional_recomputa_marca_de_sus_ventas" ON "professional_profiles";--> statement-breakpoint
CREATE TRIGGER "profesional_recomputa_marca_de_sus_ventas"
  AFTER UPDATE OF "is_test" ON "professional_profiles"
  FOR EACH ROW EXECUTE FUNCTION public.trg_venta_de_prueba_por_profesional();--> statement-breakpoint

-- Y marcar un PRODUCTO arrastra las ventas que lo lleven. Es el menos probable y el mas barato de cubrir.
CREATE OR REPLACE FUNCTION public.trg_venta_de_prueba_por_producto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_tx uuid;
BEGIN
  FOR v_tx IN SELECT DISTINCT ti.transaction_id FROM transaction_items ti WHERE ti.nutraceutical_id = NEW.id LOOP
    PERFORM public.recomputar_venta_de_prueba(v_tx);
  END LOOP;
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "producto_recomputa_marca_de_sus_ventas" ON "nutraceuticals";--> statement-breakpoint
CREATE TRIGGER "producto_recomputa_marca_de_sus_ventas"
  AFTER UPDATE OF "is_test" ON "nutraceuticals"
  FOR EACH ROW EXECUTE FUNCTION public.trg_venta_de_prueba_por_producto();--> statement-breakpoint

-- ── EL BACKFILL ──
UPDATE transactions t
   SET cuenta_como_de_prueba = (
         EXISTS (SELECT 1 FROM professional_profiles pp
                  WHERE pp.id = t.professional_id AND COALESCE(pp.is_test, false))
         OR EXISTS (SELECT 1 FROM patients pa
                     WHERE pa.id = t.patient_id AND COALESCE(pa.cuenta_como_de_prueba, false))
         OR EXISTS (SELECT 1 FROM transaction_items ti
                      JOIN nutraceuticals n ON n.id = ti.nutraceutical_id
                     WHERE ti.transaction_id = t.id AND COALESCE(n.is_test, false))
       );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "transactions_cuenta_como_de_prueba_idx"
  ON "transactions" ("cuenta_como_de_prueba");--> statement-breakpoint

COMMENT ON COLUMN "transactions"."cuenta_como_de_prueba" IS
  'DERIVADA por trigger: profesional, paciente o producto de prueba. Es la unica respuesta a si esta venta cuenta.';
