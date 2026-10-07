-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- RETIRAR UNA CONSULTA QUE NO OCURRIO (Santiago, 2026-10-07)
--
-- ═══ EL CASO QUE LO ORIGINA ═══
--
-- Una paciente agendo el 21, no pudo venir, y se atendio el 25. En Atlas quedaron DOS evaluaciones: la del 21
-- (importada del HTML, con su encuesta y su consentimiento firmados ese dia) y la del 25 (la consulta real).
-- La del 21 figura en su historia clinica como una consulta que nunca paso.
--
-- Y VA A PASAR SEGUIDO: un paciente que agenda y no viene es lo normal, no la excepcion.
--
-- ═══ POR QUE NO SIRVE NADA DE LO QUE YA HAY ═══
--
--   · `abandoned` (0045 y siguientes) es para un SHELL FIRMADO SIN RESPONDER, y su escritor lo exige en el
--     WHERE (`status = 'awaiting_survey'`) a proposito: "nunca toca una evaluacion que ya tiene respuestas".
--     La del 21 tiene 63 respuestas.
--   · `superseded_at` es para una CORRECCION: hay una evaluacion nueva que reemplaza a la vieja, y una fila
--     en `clinical_corrections` que las ata. Aqui no hay reemplazo: la consulta simplemente no ocurrio.
--   · Y BORRARLA NO ES OPCION: el consentimiento firmado y la encuesta respondida son ACTOS REALES de una
--     persona. Borrarlos para limpiar una lista es perder la constancia de algo que si paso.
--
-- ═══ LO QUE SE AGREGA, Y SUS TRES CONDICIONES ═══
--
-- Un RETIRO: la evaluacion deja de contar como consulta, pero sigue existiendo entera.
--
--   1. CON MOTIVO OBLIGATORIO. Sin el, dentro de seis meses nadie sabe por que falta una consulta en una
--      historia clinica, y eso es justo lo que una historia clinica no puede permitirse. El CHECK lo exige.
--   2. CON QUIEN Y CUANDO. Es un acto sobre el registro clinico de un paciente: lleva firma.
--   3. Y NUNCA SOBRE UNA EVALUACION CON DIAGNOSTICO. Esa es la condicion que importa: un diagnostico es una
--      salida clinica emitida, y esconderla no es retirar una consulta que no paso, es ocultar un dato
--      clinico. Para corregir una evaluacion diagnosticada ya existe el camino de las correcciones. El
--      TRIGGER lo impide, no solo el servicio: es la clase de regla que no puede depender de una capa.
--
-- ES REVERSIBLE, a diferencia de `abandoned`. Y a proposito: retirar es un juicio sobre si una consulta
-- ocurrio, y un juicio se puede revisar (la integrante se confunde de paciente, o aparece la evidencia de que
-- si vino). Lo irreversible aqui seria peor que el problema.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "evaluations"
  ADD COLUMN IF NOT EXISTS "retirada_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "retirada_motivo" text,
  ADD COLUMN IF NOT EXISTS "retirada_por" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT;--> statement-breakpoint

-- LOS TRES VAN JUNTOS O NO VA NINGUNO: una fecha sin motivo deja una consulta retirada que nadie puede
-- explicar, y un motivo sin fecha no retira nada. El minimo de 5 caracteres impide el motivo de relleno.
ALTER TABLE "evaluations" DROP CONSTRAINT IF EXISTS "evaluations_retiro_completo";--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_retiro_completo" CHECK (
  ("retirada_at" IS NULL AND "retirada_motivo" IS NULL AND "retirada_por" IS NULL)
  OR ("retirada_at" IS NOT NULL AND length(btrim("retirada_motivo")) >= 5 AND "retirada_por" IS NOT NULL)
);--> statement-breakpoint

COMMENT ON COLUMN "evaluations"."retirada_at" IS
  'Consulta retirada: no ocurrio, pero su consentimiento y su encuesta se conservan. NO es `abandoned` (shell sin responder) ni `superseded_at` (correccion con reemplazo). Nunca sobre una evaluacion con diagnostico: lo impide un trigger.';--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "evaluations_retirada_idx" ON "evaluations" ("retirada_at");--> statement-breakpoint

-- ── EL PORTON EN LA BASE: NO SE RETIRA LO QUE TIENE DIAGNOSTICO ──────────────────────────────────
--
-- VA EN UN TRIGGER Y NO SOLO EN EL SERVICIO porque es la unica regla de esta pieza cuyo incumplimiento
-- esconde un dato CLINICO. Un arreglo de datos a mano, un script, o una pantalla nueva que no pase por el
-- servicio, todos tienen que chocar con esto.
CREATE OR REPLACE FUNCTION public.evaluacion_retirada_sin_diagnostico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.retirada_at IS NOT NULL AND OLD.retirada_at IS NULL THEN
    IF EXISTS (SELECT 1 FROM diagnoses d WHERE d.evaluation_id = NEW.id) THEN
      RAISE EXCEPTION
        'No se puede retirar una evaluacion con diagnostico emitido: eso esconderia una salida clinica. Para corregirla, usa la correccion de evaluacion.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.evaluacion_retirada_sin_diagnostico() FROM anon, authenticated;--> statement-breakpoint

DROP TRIGGER IF EXISTS "evaluacion_no_se_retira_con_diagnostico" ON "evaluations";--> statement-breakpoint
CREATE TRIGGER "evaluacion_no_se_retira_con_diagnostico"
  BEFORE UPDATE OF "retirada_at" ON "evaluations"
  FOR EACH ROW EXECUTE FUNCTION public.evaluacion_retirada_sin_diagnostico();
