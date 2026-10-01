-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UN PACIENTE DE UN PROFESIONAL DE PRUEBA CUENTA COMO DE PRUEBA, SIN QUE NADIE LO ESCRIBA
--
-- LO PIDIO SANTIAGO (2026-10-01): "a los profesionales de prueba, por defecto deberian aparecer todos sus
-- pacientes como de prueba, conservando la marca de revertir por si alguno es real".
--
-- ── POR QUE DERIVADO Y NO QUINCE FILAS MARCADAS ──
--
-- Marcarlos uno por uno deja quince decisiones escritas que habria que deshacer una a una, y el dia que
-- alguien asigne un paciente NUEVO a esa cuenta nace sin marcar: el hueco vuelve solo. Derivarlo cubre al que
-- llegue mañana y no hay nada que sincronizar.
--
-- ── POR QUE UNA COLUMNA MANTENIDA POR TRIGGER Y NO UNA VISTA O UNA FUNCION ──
--
-- Las diez lecturas que hoy filtran `patients.is_test` van por PostgREST con `.eq("is_test", false)`, y una
-- funcion no se puede llamar desde ahi. Con una COLUMNA real, el barrido es un cambio de nombre en cada
-- lectura y la REGLA vive en UN solo sitio: esta funcion. Era eso o diez copias de un `exists`, y una copia
-- es como se llega a que una pantalla excluya y la otra no (nos paso con el inventario, con la RLS y con el
-- dinero del paciente marcado).
--
-- ── LA REGLA, Y SU CASO LIMITE ──
--
-- Cuenta como de prueba si:
--   · esta MARCADO explicitamente (`is_test`), o
--   · TODOS sus profesionales activos son de prueba, y nadie dijo lo contrario.
--
-- UN PACIENTE CON DOS PROFESIONALES, UNO DE PRUEBA Y OTRO REAL, ES REAL. Si lo atiende alguien real, sus
-- datos son reales: lo que decide es la atencion de verdad, no la cuenta con la que se probo algo. Al
-- contrario seria perder data clinica real por donde paso una prueba.
--
-- Y UN PACIENTE SIN NINGUN PROFESIONAL NO SE DERIVA: no hay de quien deducirlo. Queda como esta.
--
-- `es_real_confirmado` es la salida explicita en el otro sentido: "este SI es real aunque su profesional sea
-- de prueba". Es lo que mantiene reversible la derivacion sin tener que desmarcar de a uno.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "es_real_confirmado" boolean NOT NULL DEFAULT false,
  -- DERIVADA: la escribe el trigger, nunca la aplicacion. Arranca en false y el backfill del final la pone
  -- al dia; cada cambio posterior la recalcula.
  ADD COLUMN IF NOT EXISTS "cuenta_como_de_prueba" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- LAS DOS MARCAS EXPLICITAS SE CONTRADICEN, asi que no pueden convivir: "es de prueba" y "es real" son la
-- misma decision en sentidos opuestos, y dejarlas juntas obligaria a inventar cual gana.
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_marca_no_se_contradice";--> statement-breakpoint
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_marca_no_se_contradice" CHECK (NOT ("is_test" AND "es_real_confirmado"));--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.recomputar_marca_de_prueba(p_patient uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE patients p
     SET cuenta_como_de_prueba = (
           p.is_test
           OR (
             NOT p.es_real_confirmado
             -- TIENE AL MENOS UNO ACTIVO: sin relaciones no hay de quien deducir nada.
             AND EXISTS (
               SELECT 1 FROM patient_professional_relationships r
                WHERE r.patient_id = p.id AND r.status = 'active'
             )
             -- Y NINGUNO ES REAL: si lo atiende alguien real, el paciente es real.
             AND NOT EXISTS (
               SELECT 1 FROM patient_professional_relationships r
                 JOIN professional_profiles pp ON pp.id = r.professional_id
                WHERE r.patient_id = p.id AND r.status = 'active'
                  AND COALESCE(pp.is_test, false) = false
             )
           )
         )
   WHERE p.id = p_patient;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.recomputar_marca_de_prueba(uuid) FROM anon, authenticated;--> statement-breakpoint

-- ── LOS TRES DISPARADORES, uno por cada cosa que puede cambiar la respuesta ──

CREATE OR REPLACE FUNCTION public.trg_marca_de_prueba_del_paciente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.recomputar_marca_de_prueba(NEW.id);
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "patients_recomputa_marca" ON "patients";--> statement-breakpoint
CREATE TRIGGER "patients_recomputa_marca"
  AFTER INSERT OR UPDATE OF "is_test", "es_real_confirmado" ON "patients"
  FOR EACH ROW EXECUTE FUNCTION public.trg_marca_de_prueba_del_paciente();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.trg_marca_de_prueba_por_relacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- EN UN DELETE no hay NEW, y en un cambio de paciente hay que recalcular los dos.
  IF TG_OP <> 'INSERT' THEN PERFORM public.recomputar_marca_de_prueba(OLD.patient_id); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM public.recomputar_marca_de_prueba(NEW.patient_id); END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "relaciones_recomputan_marca" ON "patient_professional_relationships";--> statement-breakpoint
CREATE TRIGGER "relaciones_recomputan_marca"
  AFTER INSERT OR UPDATE OR DELETE ON "patient_professional_relationships"
  FOR EACH ROW EXECUTE FUNCTION public.trg_marca_de_prueba_por_relacion();--> statement-breakpoint

-- Y EL TERCERO ES EL QUE DE VERDAD PIDIO SANTIAGO: marcar al profesional arrastra a sus pacientes.
CREATE OR REPLACE FUNCTION public.trg_marca_de_prueba_por_profesional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_patient uuid;
BEGIN
  FOR v_patient IN
    SELECT DISTINCT r.patient_id FROM patient_professional_relationships r
     WHERE r.professional_id = NEW.id
  LOOP
    PERFORM public.recomputar_marca_de_prueba(v_patient);
  END LOOP;
  RETURN NULL;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "profesional_recomputa_marca_de_sus_pacientes" ON "professional_profiles";--> statement-breakpoint
CREATE TRIGGER "profesional_recomputa_marca_de_sus_pacientes"
  AFTER UPDATE OF "is_test" ON "professional_profiles"
  FOR EACH ROW EXECUTE FUNCTION public.trg_marca_de_prueba_por_profesional();--> statement-breakpoint

-- ── EL BACKFILL: pone al dia lo que ya existe, incluidos los quince de la cuenta de demostracion ──
UPDATE patients p
   SET cuenta_como_de_prueba = (
         p.is_test
         OR (
           NOT p.es_real_confirmado
           AND EXISTS (
             SELECT 1 FROM patient_professional_relationships r
              WHERE r.patient_id = p.id AND r.status = 'active'
           )
           AND NOT EXISTS (
             SELECT 1 FROM patient_professional_relationships r
               JOIN professional_profiles pp ON pp.id = r.professional_id
              WHERE r.patient_id = p.id AND r.status = 'active'
                AND COALESCE(pp.is_test, false) = false
           )
         )
       );--> statement-breakpoint

-- El indice es para los filtros de las diez lecturas, que preguntan por el valor FALSO (la operacion real).
CREATE INDEX IF NOT EXISTS "patients_cuenta_como_de_prueba_idx"
  ON "patients" ("cuenta_como_de_prueba");--> statement-breakpoint

COMMENT ON COLUMN "patients"."cuenta_como_de_prueba" IS
  'DERIVADA por trigger: marcado explicito, o todos sus profesionales activos de prueba. Es la que filtran las cifras.';--> statement-breakpoint
COMMENT ON COLUMN "patients"."es_real_confirmado" IS
  'Salida explicita: este paciente SI es real aunque su profesional sea de prueba.';
