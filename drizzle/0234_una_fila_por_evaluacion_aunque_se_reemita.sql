-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- UNA FILA POR EVALUACION, AUNQUE SU DIAGNOSTICO SE REEMITA  ·  0234
--
-- ═══ EL DEFECTO, Y COMO SE VIO ═══
--
-- Santiago, 2026-11-03: *"Hace unos dias: 542 consultas vigentes, 162 importadas del HTML, 225 con
-- diagnostico sellado, 328 autorizadas de 320 pacientes. Hoy: 927 vigentes, 273 importadas, 481 con
-- diagnostico, 584 autorizadas de 346 pacientes. Mi hipotesis: la reemision dejo dos diagnosticos por
-- evaluacion y las vistas cuentan una fila por diagnostico."*
--
-- SU HIPOTESIS ERA LA CORRECTA, Y MEDIDA EN PRODUCCION (2026-11-03, solo lectura,
-- `scripts/CUANTAS_EVALUACIONES_DISTINTAS_CUENTA_obbia_2026-11-03.mjs`):
--
--     cifra del panel                      filas (hoy)   evaluaciones distintas
--     consultas vigentes                          927            569
--     autorizadas para investigacion              584            354
--     con diagnostico sellado                     481            251
--     importadas vigentes                         273            162
--     importadas del HTML y autorizadas             5              4
--     pacientes distintos autorizados             346            346
--
-- 927 = 569 evaluaciones + 358 que tienen DOS diagnosticos. Las mediciones no multiplican nada: las 427
-- evaluaciones con toma tienen exactamente una. Y el 162 de importadas coincide al dedo con lo que
-- Santiago vio antes de las tandas, que es la confirmacion de que lo que crecio fue el conteo y no la
-- cohorte.
--
-- POR QUE PASA, Y POR QUE NO ES UN DEFECTO DE LA REEMISION: reemitir INSERTA una fila de `diagnoses` y no
-- marca la anterior, a proposito (`reemitirDiagnostico`: *"lo sellado no se toca NUNCA, regla 7"*), y lo
-- VIGENTE se deriva de cual es la ultima fila. El defecto es de ESTAS VISTAS, que hacian
-- `LEFT JOIN diagnoses d ON d.evaluation_id = e.id` como si solo pudiera haber una.
--
-- Y LO MAS GRAVE NO ERA EL TOTAL, ERA EL AVISO DE VERSIONES: la cohorte por motor daba 229 filas en
-- `1.0.0` y 250 en `2.0.0`, asi que el panel avisaba *"la cohorte mezcla 2 versiones del motor"*. Contada
-- por evaluacion con su sello VIGENTE, hay 250 en 2.0.0 y UNA en 1.0.0. El aviso describia el historico
-- sellado, no la cohorte, y es el mismo error que la 0230 ya habia corregido una vez por otra via: un
-- aviso que dice "no son comparables" sobre cifras que si lo son hace desconfiar de la cohorte entera.
--
-- ═══ EL ARREGLO: LA VISTA ELIGE EL DIAGNOSTICO VIGENTE, NO TODOS ═══
--
-- Un `LEFT JOIN LATERAL ... ORDER BY created_at DESC LIMIT 1`, que es LA MISMA REGLA que ya usa la app en
-- los tres sitios donde tenia que elegir: `results-reader` (`order created_at desc limit 1`),
-- `reports-repository.getReportDispatch` y `desfasadas-reader` (la pantalla de recalibracion, que ya
-- tomaba una por evaluacion). La vista era el unico lector que no la aplicaba.
--
-- Y LA MEDICION TAMBIEN, aunque hoy no multiplique: `bis_measurements` no tiene unico por evaluacion (solo
-- indice), asi que la multiplicacion estaba abierta por los dos lados y hoy solo se habia cerrado uno.
-- Dejarla abierta seria dejar el mismo defecto esperando a la primera evaluacion con dos tomas.
--
-- CON ESO LA VISTA PASA A TENER LA PROPIEDAD QUE SE PUEDE AFIRMAR Y PROBAR: una fila por evaluacion. Un
-- candado de BD la comprueba insertando un segundo diagnostico (`la-reemision-no-mueve-las-cuentas-db`).
--
-- ═══ LA HUELLA REPETIDA SE SIMPLIFICA, Y ES CONSECUENCIA, NO DECISION ═══
--
-- La 0230 comparaba `count(*) OVER (PARTITION BY huella) > count(*) OVER (PARTITION BY huella, e.id)`
-- porque *"la vista puede dar VARIAS filas por evaluacion"*. Con una fila por evaluacion la comparacion es
-- contra 1: la misma toma fisica en OTRA evaluacion vigente. El criterio de Gildardo no se mueve ni un
-- milimetro (2026-10-25: *"las evaluaciones con huella repetida salen hasta que se corrijan"*); lo que
-- desaparece es la correccion de un efecto que ya no existe.
--
-- Forward-only: se recrean las dos vistas (la de investigacion es `v.*` sobre la primera, asi que para que
-- vea el cambio hay que rehacerla; mismo motivo y mismo orden que la 0224 y la 0230).
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
       END AS "huella_repetida"
  FROM "evaluations" e
  JOIN "patients" p ON p."id" = e."patient_id"
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
  'UNA FILA POR EVALUACION que es la verdad VIGENTE sobre un paciente real: no de prueba (cuenta_como_de_prueba, 0202/0203), no reemplazada por una correccion (superseded_at) y no retirada (retirada_at, 0212). Desde la 0234 el diagnostico y la medicion que trae son los VIGENTES (la ultima fila de cada uno, la misma regla de results-reader y reports-repository): antes hacia un join plano y una evaluacion reemitida daba dos filas, lo que casi duplico las cifras de /obbia (927 filas sobre 569 evaluaciones el 2026-11-03). Lleva la huella de la toma y huella_repetida (0230). Para consultas analiticas y exportaciones; las pantallas NO la usan. CERO columnas que identifiquen a un paciente.';--> statement-breakpoint

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
  'Lo de evaluaciones_vigentes (una fila por evaluacion desde la 0234) MAS la autorizacion `investigacion` vigente del paciente (patient_consents, sin revoked_at) MENOS las de huella repetida (0230: la misma toma fisica en dos consultas vigentes). Es la unica fuente valida para un dataset de OB BIA LATAM: la autorizacion es OPCIONAL y el 2026-10-25 habia 53 pacientes con servicio vigente que no la dieron. El rotulo de cualquier dataset que salga de aqui dice cuantos quedaron fuera y por que, no solo que quedo dentro.';--> statement-breakpoint

REVOKE ALL ON "public"."evaluaciones_vigentes" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "public"."evaluaciones_para_investigacion" FROM anon, authenticated;
