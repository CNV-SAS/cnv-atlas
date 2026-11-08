-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LOS MENORES DE EDAD QUEDAN MARCADOS Y FUERA DE LA COHORTE DE INVESTIGACION  ·  2026-11-07
--
-- ═══ DE DONDE SALE ═══
--
-- La simulacion del 2026-11-07 (17:51) corrida contra la nube: en `evaluaciones_para_investigacion`
-- entraba UNA consulta de una persona de 13 años al medirse. Santiago: *"Los menores quedan FUERA de la
-- cohorte de investigacion (o marcados y excluidos por defecto en /obbia), con candado."*
--
-- SE HACEN LAS DOS COSAS, y cada una en la vista que le corresponde:
--
--   · `evaluaciones_vigentes` los MARCA (`menor_al_medirse`). Esa vista cuenta CONSULTAS, y la consulta
--     existio: borrarla de ahi seria decir que no se atendio a nadie. Medido hoy: 6 de 652.
--   · `evaluaciones_para_investigacion` los EXCLUYE. Esa vista es la cohorte publicable, y ahi un menor
--     no es un caso mas: la EB-BIS v7 esta calibrada de 18 a 100 años y su propio codigo RECHAZA la edad
--     fuera de ese rango, asi que sus indicadores de edad no significan lo que dice la columna. Y la
--     autorizacion de investigacion de un menor no la da el; la da quien tenga su representacion legal,
--     que es una comprobacion que Atlas hoy no hace. Medido hoy: 1 de 429.
--
-- ═══ LA CONDICION ES "PROBADAMENTE MENOR", NO "NO SE SABE SI ES MAYOR" ═══
--
-- Sin fecha de nacimiento o sin fecha de medicion, `menor_al_medirse` da FALSE y la fila se queda. Es a
-- proposito: un dato que falta es un problema de calidad, no una causa de inelegibilidad, y tratarlo como
-- menor sacaria de la cohorte a adultos de los que solo falta un dato. Medido hoy en la cohorte: cero
-- pacientes sin fecha de nacimiento, y 137 consultas sin medicion todavia (las que estan en curso).
--
-- Y LA EDAD SE MIDE A LA FECHA DE LA TOMA, no a hoy. Es la misma regla que cerro "una fecha ilegible que
-- se vuelve edad cero": a hoy, un menor que cumple 18 el mes que viene dejaria de ser menor en la cohorte
-- sin que su medicion hubiera cambiado.
--
-- ═══ LO QUE NO SE PIERDE ═══
--
-- La vista sigue SIN columnas que identifiquen a un paciente. `menor_al_medirse` es un booleano derivado:
-- dice que la persona era menor, no cuando nacio ni cuantos años tiene.
--
-- Forward-only: se recrean las dos vistas, en ese orden, porque la de investigacion es `v.*` sobre la
-- primera (mismo motivo y mismo orden que la 0224, la 0230 y la 0234).
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

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
       h."huella",
       -- ¿ESTA MISMA TOMA ESTA EN OTRA CONSULTA VIGENTE?
       --
       -- La ventana se evalua DESPUES del WHERE, asi que la particion solo cuenta filas que ya pasaron los
       -- filtros de vigencia. Y con UNA fila por evaluacion, "en otra evaluacion" es simplemente > 1.
       CASE
         WHEN h."huella" IS NULL THEN false
         ELSE count(*) OVER (PARTITION BY h."huella") > 1
       END AS "huella_repetida",
       -- ¿ERA MENOR DE EDAD CUANDO SE MIDIO? (0239)
       --
       -- `age(fecha, nacimiento)` da el intervalo exacto y evita la aritmetica de años bisiestos a mano.
       -- La fecha de la medicion se lleva a la zona de Bogota antes de comparar, que es la misma
       -- conversion que usa la columna `dia`: un UTC crudo puede caer el dia anterior y mover un
       -- cumpleaños. FALSE cuando falta cualquiera de las dos fechas (ver la nota de arriba).
       CASE
         WHEN pp."birth_date" IS NULL OR m."measurement_date" IS NULL THEN false
         ELSE age((m."measurement_date" AT TIME ZONE 'America/Bogota')::date, pp."birth_date")
                < interval '18 years'
       END AS "menor_al_medirse"
  FROM "evaluations" e
  JOIN "patients" p ON p."id" = e."patient_id"
  -- 1:1 CON EL PACIENTE (`patient_id` es la clave primaria de `patient_profiles`), asi que este join NO
  -- puede multiplicar filas, que es lo unico que habria que vigilar al meterlo en esta vista.
  LEFT JOIN "patient_profiles" pp ON pp."patient_id" = e."patient_id"
  -- LA TOMA VIGENTE: la ultima importada. Es el criterio de la mayoria de los lectores de la app
  -- (`created_at desc limit 1`), y el que corresponde a "reemplazar la medicion BIS": la que vale es la
  -- que entro despues. `id` desempata para que la vista sea determinista.
  LEFT JOIN LATERAL (
    SELECT mm."id", mm."measurement_date"
      FROM "bis_measurements" mm
     WHERE mm."evaluation_id" = e."id"
     ORDER BY mm."created_at" DESC, mm."id" DESC
     LIMIT 1
  ) m ON true
  LEFT JOIN "huellas" h ON h."measurement_id" = m."id"
  -- EL DIAGNOSTICO VIGENTE: la ultima fila, que es la regla de la casa (`results-reader`,
  -- `reports-repository`, `desfasadas-reader`). Las anteriores son historia sellada y siguen enteras en la
  -- tabla; lo que no pueden es contarse como consultas.
  LEFT JOIN LATERAL (
    SELECT dd."id", dd."engine_version", dd."model_version_id", dd."rules_version",
           dd."survey_version_id", dd."confirmed_at"
      FROM "diagnoses" dd
     WHERE dd."evaluation_id" = e."id"
     ORDER BY dd."created_at" DESC, dd."id" DESC
     LIMIT 1
  ) d ON true
 WHERE p."deleted_at" IS NULL
   AND COALESCE(p."cuenta_como_de_prueba", false) = false
   AND e."superseded_at" IS NULL
   AND e."retirada_at" IS NULL;--> statement-breakpoint

COMMENT ON VIEW "public"."evaluaciones_vigentes" IS
  'UNA FILA POR EVALUACION que es la verdad VIGENTE sobre un paciente real: no de prueba (cuenta_como_de_prueba, 0202/0203), no reemplazada por una correccion (superseded_at) y no retirada (retirada_at, 0212). Desde la 0234 el diagnostico y la medicion que trae son los VIGENTES (la ultima fila de cada uno, la misma regla de results-reader y reports-repository). Lleva la huella de la toma y huella_repetida (0230) y, desde la 0239, menor_al_medirse: aqui los menores se MARCAN y no se quitan, porque esta vista cuenta consultas y la consulta existio. Para consultas analiticas y exportaciones; las pantallas NO la usan. CERO columnas que identifiquen a un paciente: menor_al_medirse es un booleano derivado, no una fecha de nacimiento.';--> statement-breakpoint

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
   AND NOT v."huella_repetida"
   -- MENORES DE EDAD (0239). Tampoco es consentimiento ni calidad: es ELEGIBILIDAD. La EB-BIS v7 esta
   -- calibrada de 18 a 100 y rechaza lo demas, y la autorizacion de un menor no la da el. Sale sola en
   -- cuanto el menor sea mayor y vuelva a medirse: lo que se excluye es ESA toma, no a la persona.
   AND NOT v."menor_al_medirse";--> statement-breakpoint

COMMENT ON VIEW "public"."evaluaciones_para_investigacion" IS
  'Lo de evaluaciones_vigentes (una fila por evaluacion desde la 0234) MAS la autorizacion `investigacion` vigente del paciente (patient_consents, sin revoked_at) MENOS las de huella repetida (0230: la misma toma fisica en dos consultas vigentes) MENOS las de menores de edad al medirse (0239: la EB-BIS v7 esta calibrada de 18 a 100 y la autorizacion de un menor no la da el). Es la unica fuente valida para un dataset de OB BIA LATAM: la autorizacion es OPCIONAL y el 2026-10-25 habia 53 pacientes con servicio vigente que no la dieron. El rotulo de cualquier dataset que salga de aqui dice cuantos quedaron fuera y por que, no solo que quedo dentro.';--> statement-breakpoint

REVOKE ALL ON "public"."evaluaciones_vigentes" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "public"."evaluaciones_para_investigacion" FROM anon, authenticated;
