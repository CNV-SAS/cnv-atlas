-- EL CASO 6 DEL FLUJO DE CORRECCION: "Biody del paciente equivocado" (Santiago, 2026-10-24).
--
-- docs/PLAN_FLUJO_CORRECCION.md lo separo el primer dia y nunca se construyo: "no es 'reimportar mi
-- medicion', es 'esta medicion es de OTRA persona' (contaminacion cruzada de PHI)". El barrido del 24 de
-- octubre encontro 10 grupos reales, 4 de ellos repartidos entre pacientes DISTINTOS, asi que el caso dejo
-- de ser hipotetico. Esta migracion pone las DOS piezas de base; la tercera (corregir sin arrastrar la
-- medicion) es el servicio.
--
-- ── PIEZA 1: EL DISPARADOR PROPIO ──────────────────────────────────────────────────────────────────
--
-- Reusar `correccion_profesional` habria enterrado el caso entre las correcciones de un decimal. Al auditar
-- la cadena de un paciente hay que poder distinguir "aqui se corrigio un dato" de "aqui la medicion era de
-- otra persona", que es un incidente de datos de salud y se reporta distinto. Forward-only, al final del
-- enum y sin usarlo en esta misma migracion (seguro en PG12+, igual que la 0032).
--
-- ── PIEZA 2: LA MARCA DE LA MEDICION QUE NO ES DE ESTE PACIENTE ────────────────────────────────────
--
-- POR QUE HACE FALTA, y es la parte que no se ve: la medicion NO SE BORRA (nada se borra en una historia
-- clinica), asi que se queda colgada de la evaluacion reemplazada. Y entonces el freno de la 0225, que
-- compara la huella de los crudos, BLOQUEARIA al dueno de verdad cuando intente importar su propio archivo:
-- la huella ya esta en la base. Sin esta marca, corregir el error del paciente A deja al paciente B sin
-- poder cargar su propia medicion, y el mensaje le diria que su archivo es de otra persona. Cierto, pero
-- al reves.
--
-- LAS TRES COLUMNAS VIAJAN JUNTAS (CHECK, mismo criterio que el peso meta y su procedencia en la 0095): una
-- marca sin quien la puso ni por que es medio dato, y este es justo el dato que alguien va a venir a
-- preguntar dentro de un ano.
ALTER TYPE "public"."correction_trigger_type" ADD VALUE 'medicion_de_otro_paciente';--> statement-breakpoint

ALTER TABLE "bis_measurements"
  ADD COLUMN IF NOT EXISTS "no_es_del_paciente_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "no_es_del_paciente_por" uuid REFERENCES "public"."profiles"("id"),
  ADD COLUMN IF NOT EXISTS "no_es_del_paciente_motivo" text;--> statement-breakpoint

ALTER TABLE "bis_measurements"
  DROP CONSTRAINT IF EXISTS "bis_measurements_no_es_del_paciente_coherente";--> statement-breakpoint
ALTER TABLE "bis_measurements"
  ADD CONSTRAINT "bis_measurements_no_es_del_paciente_coherente" CHECK (
    ("no_es_del_paciente_at" IS NULL
      AND "no_es_del_paciente_por" IS NULL
      AND "no_es_del_paciente_motivo" IS NULL)
    OR ("no_es_del_paciente_at" IS NOT NULL
      AND "no_es_del_paciente_por" IS NOT NULL
      AND btrim(COALESCE("no_es_del_paciente_motivo", '')) <> '')
  );--> statement-breakpoint

-- LA MARCA NO SE QUITA (write-once), por lo mismo que `evaluations.superseded_at`: cuando se marca, el
-- dueno de verdad ya pudo importar su archivo, y des-marcarla volveria a armar el freno sobre una toma que
-- consta como ajena. Si la marca se puso por error, el camino es el de siempre en esta base: una correccion
-- nueva que lo diga, no un UPDATE que borre el rastro.
--
-- NO HAY POLICY DE UPDATE en bis_measurements (0003), asi que por el camino normal esto solo lo escribe el
-- servidor como owner. El trigger es la defensa en profundidad del dia en que alguien agregue esa policy.
CREATE OR REPLACE FUNCTION bis_measurements_marca_ajena_write_once() RETURNS trigger AS $$
BEGIN
  IF OLD.no_es_del_paciente_at IS NOT NULL
     AND NEW.no_es_del_paciente_at IS DISTINCT FROM OLD.no_es_del_paciente_at THEN
    RAISE EXCEPTION 'La marca de "esta medicion no es de este paciente" no se quita ni se cambia: es registro clinico.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS bis_measurements_marca_ajena_trg ON bis_measurements;--> statement-breakpoint
CREATE TRIGGER bis_measurements_marca_ajena_trg
  BEFORE UPDATE ON bis_measurements
  FOR EACH ROW EXECUTE FUNCTION bis_measurements_marca_ajena_write_once();
