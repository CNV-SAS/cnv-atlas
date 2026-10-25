-- UNA HUELLA REPETIDA SALE DE LA COHORTE DE INVESTIGACION, HASTA QUE SE CORRIJA
--
-- ═══ DE DONDE SALE ═══
--
-- Gildardo, 2026-10-25: *"Las evaluaciones con huella repetida salen de
-- evaluaciones_para_investigacion hasta que se corrijan, con la misma funcion de la huella. Es calidad de
-- dato."* El 24 de octubre lo habia dejado abierto ("pregunten"); el 25 lo decidio.
--
-- ═══ POR QUE ESTO NO ES UNA EXCLUSION MAS ═══
--
-- Una huella repetida entre dos consultas VIGENTES significa que la misma toma fisica esta en dos
-- historias clinicas, y en 5 de los 11 grupos medidos son pacientes DISTINTOS. O sea: el diagnostico de
-- una de las dos salio de la bioimpedancia de otra persona. Un dataset que las lleve no esta "un poco
-- sucio": lleva filas que atribuyen un cuerpo a quien no es.
--
-- MEDIDO EN PRODUCCION ANTES DE APLICARLO (2026-10-25, solo lectura):
--   · 11 grupos sobre 513 consultas vigentes: 5 entre pacientes distintos, 6 dentro del mismo paciente.
--   · 23 evaluaciones salen, de 17 pacientes.
--   · La cohorte autorizada pasa de 316 a 303.
--   · Uno de los 11 grupos son los TRES pacientes de smoke que todavia cuentan como reales; al marcarlos
--     de prueba, esta cuenta vuelve a los 10 grupos y 4 cruzados de la lista de Gildardo. Las dos
--     mediciones cuadran, y la diferencia tiene nombre.
--
-- ═══ "LA MISMA FUNCION DE LA HUELLA": COMO SE CUMPLE ESO EN SQL ═══
--
-- La huella vive en TypeScript (`bis/services/huella-de-la-medicion.ts`) y una vista no la puede llamar.
-- Lo que NO se hace es reescribir su formato: aqui la huella es el ARREGLO NUMERICO de las cuatro
-- lecturas ordenadas por nombre de variable, no la cadena `a|b|c|d`. Asi no hay dos formatos que puedan
-- divergir por un cero de mas: la igualdad de arreglos numericos de Postgres compara 2.04 con 2.040 como
-- iguales, que es exactamente lo que la funcion de TS consigue pasando a numero antes de comparar.
--
-- LO QUE SI SE REPITE son los CUATRO NOMBRES de variable, y ahi es donde cabe la divergencia: salen de
-- `normalizeHeader(BIODY_COLUMNS[...].header)`. Un candado del repositorio compara esta lista contra
-- `VARIABLES_DE_LA_HUELLA` y falla si dejan de coincidir, igual que el candado del CHECK de la 0227
-- contra `NIVELES_DE_ANONIMIZACION`.
--
-- Y DONDE LAS DOS NO COINCIDEN, SE CAE DEL LADO DE NO EXCLUIR: si una medicion tuviera la misma variable
-- dos veces con valores distintos, TS se queda con la ultima y esto no le calcula huella. "No se puede
-- comparar" no es "es un duplicado", igual que en el freno de la 0225.
--
-- ═══ POR QUE NO HACEN FALTA LAS DOS EXCEPCIONES DEL FRENO ═══
--
-- El freno de la 0225 exceptua la copia de una cadena de correccion y la medicion marcada como de otro
-- paciente. Aqui no hacen falta, y esa es la razon de comparar SOLO entre vigentes: al corregir, la
-- version vieja queda `superseded_at` y sale del universo antes de comparar; la medicion marcada se
-- queda colgada de esa version vieja. Las dos excepciones se cumplen sin nombrarlas, lo que significa una
-- lista menos que mantener.
--
-- ═══ Y SE DICE, NO SE ESCONDE ═══
--
-- `huella_repetida` es una COLUMNA de `evaluaciones_vigentes`, no un filtro invisible. El panel puede
-- contar cuantas salen por calidad de dato, que es la regla que la propia 0224 escribio: lo que queda
-- fuera se dice, no solo lo que queda dentro. Una cohorte que baja de 316 a 303 sin que nada lo explique
-- es como se pierde la confianza en la cifra.
--
-- Forward-only: se recrean las dos vistas (la de investigacion depende de `v.*`, asi que para que vea las
-- columnas nuevas hay que rehacerla; mismo motivo por el que la 0224 las creo en ese orden).

DROP VIEW IF EXISTS "public"."evaluaciones_para_investigacion";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."evaluaciones_vigentes";--> statement-breakpoint

CREATE VIEW "public"."evaluaciones_vigentes"
  WITH (security_invoker = true) AS
WITH "huellas" AS (
  -- DISTINCT ANTES DE AGREGAR: `bis_raw_values` no tiene unico sobre (medicion, variable), asi que una
  -- fila repetida identica no puede inflar el conteo. Si la misma variable viniera con DOS valores
  -- distintos, el conteo sube a cinco, el HAVING la descarta y esa medicion se queda SIN huella: no se
  -- puede comparar, asi que no se excluye.
  SELECT d."measurement_id",
         array_agg(d."valor" ORDER BY d."variable_name") AS "huella"
    FROM (
      SELECT DISTINCT r."measurement_id", r."variable_name", r."value"::numeric AS "valor"
        FROM "bis_raw_values" r
       WHERE r."variable_name" IN (
               'Extracellular resistance',
               'Intracellular resistance Ω',
               'Infinite resistance',
               'Membrane capacitance nF'
             )
    ) d
   GROUP BY d."measurement_id"
  HAVING count(*) = 4
)
SELECT e."id",
       e."patient_id",
       e."professional_id",
       e."organization_id",
       e."type",
       e."status",
       (e."status" NOT IN ('awaiting_survey', 'abandoned')) AS "es_consulta_hecha",
       (e."import_batch_id" IS NOT NULL) AS "importada",
       m."id" AS "measurement_id",
       m."measurement_date",
       (m."measurement_date" AT TIME ZONE 'America/Bogota')::date AS "dia",
       d."id" AS "diagnosis_id",
       d."engine_version",
       d."model_version_id",
       d."rules_version",
       d."survey_version_id",
       d."confirmed_at",
       e."created_at",
       -- LA HUELLA DE LA TOMA, para poder auditar POR QUE una fila quedo fuera. Es el arreglo numerico,
       -- no una cadena: ver la nota de arriba sobre los dos formatos.
       h."huella",
       -- ¿ESTA MISMA TOMA ESTA EN OTRA CONSULTA VIGENTE?
       --
       -- La ventana se evalua DESPUES del WHERE, asi que la particion solo cuenta filas que ya pasaron los
       -- filtros de vigencia: "otra evaluacion vigente" sale gratis, sin repetir el predicado.
       --
       -- Y SE COMPARA CONTRA LA PARTICION (huella, evaluacion) y no contra 1, porque la vista puede dar
       -- VARIAS filas por evaluacion (una por medicion). Sin eso, una evaluacion con dos tomas identicas
       -- se marcaria repetida, que es otro problema y no el que Gildardo decidio excluir.
       CASE
         WHEN h."huella" IS NULL THEN false
         ELSE count(*) OVER (PARTITION BY h."huella")
                > count(*) OVER (PARTITION BY h."huella", e."id")
       END AS "huella_repetida"
  FROM "evaluations" e
  JOIN "patients" p ON p."id" = e."patient_id"
  LEFT JOIN "bis_measurements" m ON m."evaluation_id" = e."id"
  LEFT JOIN "huellas" h ON h."measurement_id" = m."id"
  LEFT JOIN "diagnoses" d ON d."evaluation_id" = e."id"
 WHERE p."deleted_at" IS NULL
   AND COALESCE(p."cuenta_como_de_prueba", false) = false
   AND e."superseded_at" IS NULL
   AND e."retirada_at" IS NULL;--> statement-breakpoint

COMMENT ON VIEW "public"."evaluaciones_vigentes" IS
  'Evaluaciones que son la verdad VIGENTE sobre un paciente real: no de prueba (cuenta_como_de_prueba, 0202/0203), no reemplazada por una correccion (superseded_at) y no retirada (retirada_at, 0212). Desde la 0230 lleva tambien la HUELLA de la toma (las cuatro lecturas electricas, el mismo criterio que el freno de la 0225) y huella_repetida: si esa misma toma fisica esta en otra consulta vigente. Para consultas analiticas y exportaciones; las pantallas NO la usan. CERO columnas que identifiquen a un paciente.';--> statement-breakpoint

CREATE VIEW "public"."evaluaciones_para_investigacion"
  WITH (security_invoker = true) AS
SELECT v.*
  FROM "public"."evaluaciones_vigentes" v
 WHERE EXISTS (
         SELECT 1 FROM "patient_consents" c
          WHERE c."patient_id" = v."patient_id"
            AND c."consent_type" = 'investigacion'
            AND c."revoked_at" IS NULL
       )
   -- CALIDAD DE DATO (0230). No es una condicion de consentimiento: el paciente SI autorizo. Lo que falla
   -- es el dato, y una fila que atribuye la bioimpedancia de otra persona no se arregla anonimizandola.
   -- Vuelve a entrar sola en cuanto la correccion deje una sola de las dos como vigente.
   AND NOT v."huella_repetida";--> statement-breakpoint

COMMENT ON VIEW "public"."evaluaciones_para_investigacion" IS
  'Lo de evaluaciones_vigentes MAS la autorizacion `investigacion` vigente del paciente (patient_consents, sin revoked_at) MENOS las de huella repetida (0230: la misma toma fisica en dos consultas vigentes, 11 grupos medidos el 2026-10-25, 5 entre pacientes distintos). Es la unica fuente valida para un dataset de OB BIA LATAM: la autorizacion es OPCIONAL y el 2026-10-25 habia 53 pacientes con servicio vigente que no la dieron. El rotulo de cualquier dataset que salga de aqui dice cuantos quedaron fuera y por que, no solo que quedo dentro.';--> statement-breakpoint

REVOKE ALL ON "public"."evaluaciones_vigentes" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "public"."evaluaciones_para_investigacion" FROM anon, authenticated;
