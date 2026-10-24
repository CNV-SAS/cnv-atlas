-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- "EVALUACION VIGENTE": UNA SOLA DEFINICION, EN LA BASE  ·  0224
--
-- ═══ DE DONDE SALE (Santiago, 2026-10-24) ═══
--
-- Su pregunta, textual: *"nosotros en investigacion, ahora por regla, solo utilizamos los diagnosticos
-- vigentes o algo asi, correcto? cuales es que eran las reglas? que no esten marcados como is_test y
-- despues de fecha_lanzamiento (solo para lo comercial) creo que era asi."*
--
-- Y SU LECTURA ES LA CORRECTA, incluida la parte entre parentesis. La 0219 ya lo dejo escrito al crear
-- `ventas_reales`: *"LAS DOS CONDICIONES SON DE LO COMERCIAL. La data CLINICA tiene UNA SOLA: no ser de
-- prueba. Una consulta del 2 de octubre es una consulta de verdad, con su medicion y su diagnostico,
-- aunque la operacion comercial arranque el 15."* Asi que aqui NO entra la fecha de arranque.
--
-- ═══ LO QUE AÑADE LO CLINICO, Y NO ES UNA CONDICION MAS: SON DOS ═══
--
-- Una evaluacion puede existir y NO ser la verdad vigente sobre ese paciente:
--
--   · REEMPLAZADA (`superseded_at`): una correccion versionada emitio una version nueva. Contar las dos es
--     contar al mismo paciente dos veces, con dos diagnosticos que se contradicen.
--   · RETIRADA (`retirada_at`, 0212): la consulta que NO OCURRIO. No es que salga mal: es que no paso.
--
-- Esas dos ya se repiten a mano en cada consulta analitica, y eso es exactamente lo que la 0219 vino a
-- impedir: *"si cada consulta las repite a mano, tarde o temprano una se olvida y la cifra sale mal sin que
-- nadie lo note."* Ya paso una vez con esta misma data: el CSV de la cohorte para la Direccion Cientifica.
--
-- ═══ Y LA SEGUNDA VISTA, QUE ES LA QUE FALTABA DE VERDAD ═══
--
-- `evaluaciones_para_investigacion` = lo de arriba MAS la autorizacion de investigacion VIGENTE del
-- paciente. Medido en produccion el 2026-10-24: de 402 pacientes con consentimiento de servicio vigente,
-- **349 autorizaron investigacion, 53 NO la autorizaron y 4 la revocaron**. La autorizacion es OPCIONAL
-- (casilla propia del consentimiento v1.0, nombra a ObBIA-Latam y dice "seudonimizados").
--
-- POR QUE ESTO IMPORTA MAS QUE LA COMODIDAD: el modulo CNVResearch del archivo de la Direccion Cientifica
-- exporta TODOS los pacientes de la base (verificado leyendo el HTML: en las 385 lineas de su motor no
-- aparece la palabra consentimiento, investigacion ni autorizacion, y el modo "observatorio" solo deja en
-- blanco el documento y el nombre). En su archivo eso no se ve como un defecto, porque su consentimiento no
-- tiene casilla de investigacion. En Atlas el mismo export sacaria a 53 personas que dijeron que no.
--
-- EL FILTRO VIVE EN EL LECTOR, NO EN LA PANTALLA. Si vive en la pantalla, el siguiente camino que lea la
-- misma tabla lo saltea. Esta vista ES ese lector.
--
-- ═══ POR QUE SE ENUMERAN LAS COLUMNAS, igual que en la 0219 ═══
--
-- `t.*` se expande al crear la vista, asi que una columna nueva no apareceria y nadie se enteraria. Y esto
-- alimenta un producto de datos: que salga una columna es una decision, no una herencia. Por eso AQUI NO
-- HAY NINGUNA QUE IDENTIFIQUE A UN PACIENTE: van sus identificadores tecnicos, para poder unir, y nada
-- mas. El dia que haya que entregar un dataset, el seudonimo se construye sobre `patient_id`.
--
-- ⚠ SEGURIDAD: `security_invoker = true` (la vista respeta la RLS de quien pregunta, no la de su dueño) MAS
--   la revocacion a `anon` y `authenticated`. Sin lo primero, una vista corre con los privilegios de su
--   dueño y se vuelve una puerta alrededor de la RLS de `evaluations`.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS "public"."evaluaciones_para_investigacion";--> statement-breakpoint
DROP VIEW IF EXISTS "public"."evaluaciones_vigentes";--> statement-breakpoint

CREATE VIEW "public"."evaluaciones_vigentes"
  WITH (security_invoker = true) AS
SELECT e."id",
       e."patient_id",
       e."professional_id",
       e."organization_id",
       e."type",
       e."status",
       -- SI ES UNA CONSULTA HECHA. `awaiting_survey` es un cascaron firmado sin responder y `abandoned` una
       -- que se dejo: existen (el consentimiento firmado es un acto real) pero no son una consulta. Va como
       -- COLUMNA y no como filtro, porque quien cuenta consentimientos SI las necesita y quien cuenta
       -- consultas no. La lista es la misma que usa el roster (`patients/labels.ts`).
       (e."status" NOT IN ('awaiting_survey', 'abandoned')) AS "es_consulta_hecha",
       -- VINO DE UN LOTE DEL HTML: no es lo mismo una consulta medida en Atlas que una importada, y para un
       -- analisis de calidad del dato esa procedencia es lo primero que se pregunta.
       (e."import_batch_id" IS NOT NULL) AS "importada",
       m."id" AS "measurement_id",
       m."measurement_date",
       -- EL DIA DE LA MEDICION EN HORA DE COLOMBIA, que es el que cuenta para agrupar por fecha. En UTC una
       -- medicion de las 7 de la noche se va al dia siguiente.
       (m."measurement_date" AT TIME ZONE 'America/Bogota')::date AS "dia",
       d."id" AS "diagnosis_id",
       -- LA CONSTELACION DE VERSIONES (regla dura 7). Sin ella una cifra no se puede explicar ni recalcular
       -- con la ciencia de su dia, y un dataset que mezcla versiones del motor compara lo incomparable.
       d."engine_version",
       d."model_version_id",
       d."rules_version",
       d."survey_version_id",
       d."confirmed_at",
       e."created_at"
  FROM "evaluations" e
  JOIN "patients" p ON p."id" = e."patient_id"
  LEFT JOIN "bis_measurements" m ON m."evaluation_id" = e."id"
  LEFT JOIN "diagnoses" d ON d."evaluation_id" = e."id"
 WHERE p."deleted_at" IS NULL
   -- LA UNICA CONDICION DE LO CLINICO. `cuenta_como_de_prueba` ya incluye las dos formas de serlo (marcado
   -- a mano, o derivado de que su profesional sea de prueba; trigger de la 0202) menos la salida de
   -- "es real aunque su profesional sea de prueba". Por eso es UNA y no tres.
   AND COALESCE(p."cuenta_como_de_prueba", false) = false
   AND e."superseded_at" IS NULL
   AND e."retirada_at" IS NULL;--> statement-breakpoint

COMMENT ON VIEW "public"."evaluaciones_vigentes" IS
  'Evaluaciones que son la verdad VIGENTE sobre un paciente real: no de prueba (cuenta_como_de_prueba, 0202/0203), no reemplazada por una correccion (superseded_at) y no retirada (retirada_at, 0212). Sin la fecha de arranque: esa es de lo comercial (ver 0219). Para consultas analiticas y exportaciones; las pantallas NO la usan. Lleva la constelacion de versiones del diagnostico y CERO columnas que identifiquen a un paciente.';--> statement-breakpoint

-- ── Y LA DE INVESTIGACION, que es la de arriba MAS el consentimiento ────────────────────────────
CREATE VIEW "public"."evaluaciones_para_investigacion"
  WITH (security_invoker = true) AS
SELECT v.*
  FROM "public"."evaluaciones_vigentes" v
 WHERE EXISTS (
         SELECT 1 FROM "patient_consents" c
          WHERE c."patient_id" = v."patient_id"
            AND c."consent_type" = 'investigacion'
            -- VIGENTE = firmada y no revocada. La revocacion tiene que poder alcanzar un dataset ya
            -- generado: o se regenera siempre desde aqui, o se registra que pacientes entraron en cada uno.
            -- Lo segundo es lo que deja contestarle a un titular que pregunta.
            AND c."revoked_at" IS NULL
       );--> statement-breakpoint

COMMENT ON VIEW "public"."evaluaciones_para_investigacion" IS
  'Lo de evaluaciones_vigentes MAS la autorizacion `investigacion` vigente del paciente (patient_consents, sin revoked_at). Es la unica fuente valida para un dataset de OB BIA LATAM: la autorizacion es OPCIONAL y el 2026-10-24 habia 53 pacientes con servicio vigente que NO la dieron, mas 4 que la revocaron. El rotulo de cualquier dataset que salga de aqui dice cuantos quedaron fuera y por que, no solo que quedo dentro.';--> statement-breakpoint

REVOKE ALL ON "public"."evaluaciones_vigentes" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON "public"."evaluaciones_para_investigacion" FROM anon, authenticated;
