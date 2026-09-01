-- PESO META: UN SOLO SITIO DE GUARDADO (Gildardo, 2026-08-28 §2).
--
-- Su instruccion, textual: "el campo va en la entrada, en mod antropometria... no son dos pesos meta, es
-- uno. El campo de la entrada y el ajuste del tratamiento son el mismo dato en dos superficies de edicion,
-- no dos datos que puedan discrepar. SI LOS CONSTRUYEN COMO CAMPOS SEPARADOS, EL DEFECTO LO CREAN USTEDES."
--
-- Hasta el 2026-08-31 habia dos columnas: `evaluation_bis_intake.weight_goal_kg` (la entrada, que existia
-- desde la 0021 y NO LA LEIA NADIE) y `treatments.adj_peso_meta` (el ajuste del panel). El 31 se conectaron
-- para que la de la entrada llegara a la cadena; esta migracion cierra la otra mitad: un solo sitio.
--
-- QUEDA `evaluation_bis_intake.weight_goal_kg`, y no la del tratamiento, porque el peso meta es del
-- PACIENTE: "el motor lo calcula como punto de partida, el profesional lo fija, y el tratamiento lo LEE.
-- No lo crea". Ademas sobrevive al tratamiento (una reemision no deberia perder el peso acordado).

-- 1 · PROCEDENCIA. La distincion de QUIEN lo fijo es informacion clinica y no se pierde al unificar: no es
--     lo mismo el peso acordado con el paciente en la consulta que uno ajustado despues al armar el plan.
ALTER TABLE "evaluation_bis_intake" ADD COLUMN "weight_goal_set_in" text;

COMMENT ON COLUMN "evaluation_bis_intake"."weight_goal_set_in" IS
  'Superficie donde se fijo el peso meta: entrada (condiciones de la toma) o tratamiento (panel del nutricionista). Es UN dato con dos superficies de edicion, no dos datos.';

-- 2 · BACKFILL, en dos pasos y en este orden.
--
-- 2a · Lo que ya estaba en la entrada se marca como tal.
UPDATE "evaluation_bis_intake"
SET "weight_goal_set_in" = 'entrada'
WHERE "weight_goal_kg" IS NOT NULL;

-- 2b · GUARDA ANTES DE COPIAR. Si algun tratamiento tiene peso meta y su evaluacion no tiene fila de
--      intake, la copia lo perderia en silencio: el valor gobierna las calorias y los gramos de proteina
--      de un plan vivo. La migracion FALLA en vez de dejar caer una cifra clinica. (No puede crearse la
--      fila aqui: `bis_condition_version_id` y `condition_answers` son NOT NULL y no hay de donde sacarlas.)
DO $$
DECLARE huerfanos int;
BEGIN
  SELECT count(*) INTO huerfanos
  FROM "treatments" t
  JOIN "diagnoses" d ON d.id = t.diagnosis_id
  JOIN "evaluations" e ON e.id = d.evaluation_id
  LEFT JOIN "evaluation_bis_intake" i ON i.evaluation_id = e.id
  WHERE t.adj_peso_meta IS NOT NULL AND i.evaluation_id IS NULL;

  IF huerfanos > 0 THEN
    RAISE EXCEPTION 'peso meta: % tratamiento(s) con adj_peso_meta sin fila de evaluation_bis_intake. Copiar los dejaria sin destino y se perderia una cifra que gobierna la prescripcion. Resolver a mano antes de migrar.', huerfanos;
  END IF;
END $$;

-- 2c · El ajuste del tratamiento GANA sobre el de la entrada cuando los dos existen y difieren.
--      La razon NO es de jerarquia sino de continuidad: hasta hoy la cadena resolvia
--      `adj_peso_meta ?? weight_goal_kg`, asi que el del tratamiento es el que esta gobernando la
--      prescripcion de ese paciente AHORA MISMO. Que gane el otro cambiaria calorias y gramos de proteina
--      de planes vivos, en silencio y sin que nadie lo pidiera. Una migracion de datos no prescribe.
UPDATE "evaluation_bis_intake" i
SET "weight_goal_kg" = t.adj_peso_meta,
    "weight_goal_set_in" = 'tratamiento'
FROM "treatments" t
JOIN "diagnoses" d ON d.id = t.diagnosis_id
JOIN "evaluations" e ON e.id = d.evaluation_id
WHERE i.evaluation_id = e.id AND t.adj_peso_meta IS NOT NULL;

-- 3 · CANDADOS DE COHERENCIA, despues del backfill (antes romperian las filas existentes).
ALTER TABLE "evaluation_bis_intake"
  ADD CONSTRAINT "evaluation_bis_intake_weight_goal_set_in_check"
  CHECK ("weight_goal_set_in" IS NULL OR "weight_goal_set_in" IN ('entrada', 'tratamiento'));

-- Un valor sin procedencia es un dato al que le falta la mitad, y una procedencia sin valor es una
-- afirmacion sobre nada. Las dos columnas viajan juntas o no viajan.
ALTER TABLE "evaluation_bis_intake"
  ADD CONSTRAINT "evaluation_bis_intake_weight_goal_coherente"
  CHECK (("weight_goal_kg" IS NULL) = ("weight_goal_set_in" IS NULL));

-- 4 · La columna vieja NO se borra (forward-only, y es el registro de lo que el tratamiento tuvo antes de
--     la unificacion), pero deja de escribirse y de leerse. El comentario lo dice en la base, que es donde
--     lo va a leer quien abra la tabla dentro de seis meses; el candado `peso-meta-una-sola-fuente` lo dice
--     en el codigo. Una columna viva que nadie escribe es la otra cara del campo que nadie lee.
COMMENT ON COLUMN "treatments"."adj_peso_meta" IS
  'SUPERSEDIDA por evaluation_bis_intake.weight_goal_kg (migracion 0095, 2026-09-01). No se escribe ni se lee: el peso meta es del paciente, no del tratamiento. Se conserva como registro historico.';
