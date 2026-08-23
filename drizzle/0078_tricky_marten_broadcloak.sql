ALTER TABLE "treatments" ADD COLUMN "tiempos_activos" jsonb;
--> statement-breakpoint
-- DATA-MIGRATION: mover los tiempos ACTIVOS del jsonb `tiempos` a su columna propia.
--
-- Por que aqui y no en codigo: dejar el reader leyendo "la columna nueva, y si no la clave vieja" crearia
-- DOS FUENTES del mismo dato para siempre, que es la forma que ya nos costo un 500. Se mueve una vez y se
-- BORRA del jsonb (`- 'activos'`), asi no queda copia que pueda divergir.
--
-- DEFENSIVA a proposito (no vemos la nube, y alli hay filas que no estan en local):
--   * WHERE acota a las filas que de verdad tienen la clave: sin `tiempos`, o con un jsonb de otra forma,
--     no se toca nada (queda NULL y el panel cae a los activos por defecto, que es el comportamiento actual).
--   * jsonb_typeof verifica que `activos` sea un OBJETO antes de moverlo: una fila con basura ahi no
--     produce una columna con basura, se deja como esta para que se vea.
--   * Es idempotente: al terminar ya no queda la clave, asi que una segunda corrida no encuentra filas.
UPDATE "treatments"
SET "tiempos_activos" = "tiempos" -> 'activos',
    "tiempos" = "tiempos" - 'activos'
WHERE "tiempos" IS NOT NULL
  AND jsonb_typeof("tiempos") = 'object'
  AND "tiempos" ? 'activos'
  AND jsonb_typeof("tiempos" -> 'activos') = 'object';
