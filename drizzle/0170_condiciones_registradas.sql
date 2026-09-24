-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CUANDO SE REGISTRARON LAS CONDICIONES DE LA TOMA  ·  2026-09-24
--
-- SALE DE UNA PREGUNTA DE SANTIAGO: el HTML guarda la fuerza prensil y el peso meta por consulta, y no se
-- importaban. La fuerza prensil ENTRA AL MOTOR (criterio primario del fenotipo) y una consulta de julio no
-- se puede volver a medir: perderla es perderla.
--
-- LA RESERVA ERA ESTA: esos dos datos viven en `evaluation_bis_intake`, que es la captura de las CONDICIONES
-- de la toma, y la puerta del diagnostico solo miraba si la fila EXISTE. Crearla al importar habria hecho
-- creer que las condiciones ya se registraron, cuando no las respondio nadie.
--
-- Y NO SERVIA MIRAR SI LAS RESPUESTAS ESTAN VACIAS: 484 de las 498 filas de hoy tienen el snapshot vacio,
-- porque el formulario solo guarda lo que se responde que SI. Vacio significa "respondio y no marco nada",
-- que es el caso normal, no "no respondio".
--
-- Asi que el hecho se escribe: CUANDO las registro una persona. Nulo = la fila existe por otra razon (hoy,
-- una consulta importada que trae medidas), y la puerta del diagnostico las sigue pidiendo.
--
-- El relleno de lo existente es seguro y exacto: hasta hoy la UNICA forma de crear esta fila es el formulario
-- de condiciones (Antropometria exige que ya exista, y falla si no). Todas fueron registradas por alguien.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "evaluation_bis_intake"
  ADD COLUMN IF NOT EXISTS "conditions_registered_at" timestamptz;--> statement-breakpoint

COMMENT ON COLUMN "evaluation_bis_intake"."conditions_registered_at" IS
  'Cuando un profesional registro las condiciones de la toma. Nulo = la fila existe por otra via (medidas importadas) y las condiciones siguen pendientes.';--> statement-breakpoint

UPDATE "evaluation_bis_intake"
   SET "conditions_registered_at" = "created_at"
 WHERE "conditions_registered_at" IS NULL;
