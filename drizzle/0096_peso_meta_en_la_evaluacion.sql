-- PESO META: A `evaluations`, QUE ES DONDE PERTENECE. Corrige la eleccion de tabla de la 0095 (mismo dia).
--
-- QUE PASO. La 0095 unifico el peso meta en `evaluation_bis_intake.weight_goal_kg`, que era donde la
-- columna YA EXISTIA. Eso no es una razon: es donde estaba, no donde pertenece. Y la diferencia se cobro
-- en el primer smoke, con el panel de tratamiento bloqueado:
--
--   "No se puede guardar el peso meta: esta evaluacion no tiene registradas las condiciones de la toma."
--
-- La fila de `evaluation_bis_intake` es OPCIONAL: existe cuando alguien respondio las condiciones de la
-- toma BIS. Al medir, 41 de 60 tratamientos tenian su evaluacion SIN esa fila. Colgar de ella un dato que
-- gobierna la prescripcion hizo que el panel dependiera de algo que puede no existir.
--
-- `evaluations` es 1:1 con la consulta y su fila SIEMPRE existe. Y ya guarda exactamente esta clase de
-- dato: lo que el profesional registra de la consulta antes de la encuesta (motivo, escolaridad,
-- ocupacion, estrato, etnia). El peso meta es uno de esos, no un detalle de la toma BIS. El formulario
-- que lo captura ya lo decia de si mismo: "comparten formulario con las condiciones porque se llenan en el
-- mismo momento de la consulta, NO PORQUE SEAN LO MISMO".
--
-- Sigue siendo UN SOLO SITIO, que es la instruccion de Gildardo (2026-08-28 §2). Cambia cual.

ALTER TABLE "evaluations" ADD COLUMN "weight_goal_kg" numeric;
ALTER TABLE "evaluations" ADD COLUMN "weight_goal_set_in" text;

COMMENT ON COLUMN "evaluations"."weight_goal_kg" IS
  'Peso meta (kg) acordado en esta consulta. SITIO UNICO. Gobierna toda la cadena calorica: gasto, objetivo y gramos de proteina. Es POR EVALUACION y no por paciente a proposito: cada consulta acuerda el suyo, y cambiarlo en un seguimiento no puede reescribir la prescripcion de una consulta pasada.';
COMMENT ON COLUMN "evaluations"."weight_goal_set_in" IS
  'Superficie donde se fijo: entrada (datos de la consulta) o tratamiento (panel del nutricionista). Es UN dato con dos superficies de edicion, no dos datos.';

-- Copia de lo que la 0095 dejo en el intake. Sin regla de conflicto que decidir: la 0095 ya unifico, asi
-- que aqui no hay dos valores que puedan discrepar, solo uno cambiando de casa.
UPDATE "evaluations" e
SET "weight_goal_kg" = i.weight_goal_kg,
    "weight_goal_set_in" = i.weight_goal_set_in
FROM "evaluation_bis_intake" i
WHERE i.evaluation_id = e.id AND i.weight_goal_kg IS NOT NULL;

-- Mismo candado de coherencia que traia la 0095: un valor sin procedencia es medio dato, y una
-- procedencia sin valor es una afirmacion sobre nada.
ALTER TABLE "evaluations"
  ADD CONSTRAINT "evaluations_weight_goal_set_in_check"
  CHECK ("weight_goal_set_in" IS NULL OR "weight_goal_set_in" IN ('entrada', 'tratamiento'));
ALTER TABLE "evaluations"
  ADD CONSTRAINT "evaluations_weight_goal_coherente"
  CHECK (("weight_goal_kg" IS NULL) = ("weight_goal_set_in" IS NULL));

-- La columna del intake queda supersedida, como quedo la del tratamiento en la 0095. No se borra
-- (forward-only) y se marca en la base, que es donde lo lee quien abra la tabla.
COMMENT ON COLUMN "evaluation_bis_intake"."weight_goal_kg" IS
  'SUPERSEDIDA por evaluations.weight_goal_kg (migracion 0096, 2026-09-01). No se escribe ni se lee: su fila es opcional y el peso meta no puede depender de que alguien haya respondido las condiciones de la toma. Se conserva como registro historico.';
COMMENT ON COLUMN "evaluation_bis_intake"."weight_goal_set_in" IS
  'SUPERSEDIDA por evaluations.weight_goal_set_in (migracion 0096, 2026-09-01).';
