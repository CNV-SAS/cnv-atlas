-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- /pacientes: UNA FILA POR PACIENTE EN VEZ DE 4.598 FILAS EMBEBIDAS  ·  0228
--
-- ═══ DE DONDE SALE ═══
--
-- La 0222 quito el costo por fila de la RLS y la pantalla dejo de reventar, pero su propio comentario lo
-- dejo dicho: *"NO SUSTITUYE A ACOTAR LA CONSULTA: una lista que crece sin techo acaba volviendo a chocar
-- con el limite... que las cifras de la fila no salgan de embeds"*. Medido en produccion el 2026-10-24 con
-- service role (sin RLS): 671 ms, 553 pacientes, 656 KB, ~4.598 filas, 8,3 por paciente. Sin ningun embed,
-- 160 ms y 179 KB. Y el crecimiento es real: 47 pacientes en agosto, 123 en septiembre, 383 en octubre.
--
-- De las tres salidas que se midieron, Gildardo eligio esta (2026-10-24): *"La vista de una fila por
-- paciente con los EXISTS, y las reglas siguen en TS."*
--
-- ═══ QUE HACE ESTA VISTA Y QUE NO HACE, QUE ES LO QUE IMPORTA ═══
--
-- RESPONDE HECHOS: ¿esta evaluacion tiene medicion? ¿tiene condiciones registradas? ¿tiene diagnostico?
-- ¿en que estado esta su reporte? Son `exists` y subconsultas de un valor. NO DECIDE NADA CLINICO: que le
-- falta al paciente, si se le puede crear una evaluacion y si hay algo que regularizar siguen siendo tres
-- funciones de TypeScript (`pendientes.ts`, `can-create-evaluation`, `regularizacion.ts`). Calcularlas
-- aqui habria creado una SEGUNDA definicion de cada regla capaz de divergir de la primera.
--
-- ═══ POR QUE BAJA EL COSTO ═══
--
--   1. UNA FILA POR PACIENTE sobre el cable, en vez de 8,3. PostgREST deja de armar el JSON anidado de
--      4.598 filas, que es la mitad del tiempo medido (671 ms con embeds contra 160 ms sin ellos).
--   2. LOS `exists` SE CORTAN EN LA PRIMERA FILA. La consulta de antes traia las 406 mediciones, los 310
--      diagnosticos y los 286 reportes enteros para preguntarles si existian; aqui la policy de cada tabla
--      hija se evalua hasta encontrar una, no sobre todas.
--   3. LOS 2.236 CONSENTIMIENTOS se agregan en la base y cruzan como un solo jsonb por paciente.
--
-- ═══ security_invoker = true: LA RLS SIGUE SIENDO LA DE QUIEN PREGUNTA ═══
--
-- Es lo que separa esta vista de las dos de la 0224 (`evaluaciones_vigentes` y
-- `evaluaciones_para_investigacion`), que se REVOCARON a `authenticated` a proposito porque son un
-- producto de datos que se lee como dueño. Esta es una superficie de pantalla: con `security_invoker` las
-- policies de `patients`, `patient_profiles`, `patient_consents`, `evaluations` y sus hijas se evaluan
-- como el usuario de la sesion, asi que un profesional sigue viendo solo sus pacientes y admin todos. No
-- es una puerta alrededor de la RLS: es la misma RLS, con menos filas pagandola.
--
-- ═══ POR QUE SE PUEDE DEMOSTRAR INERTE ═══
--
-- Porque la fila de la pantalla se arma en UN solo sitio (`modules/patients/roster-fila.ts`) a partir de
-- estos hechos, asi que la prueba `el-roster-por-la-vista-no-cambia-ninguna-cifra-db` puede armarla por
-- los DOS caminos (la consulta de embeds de antes y esta vista) y compararlas campo por campo, paciente
-- por paciente. Lo que se afirma no es "deberia dar lo mismo": es que da lo mismo en todos.
--
-- ═══ EL UNICO SITIO DONDE HABIA AMBIGUEDAD, DICHO EN VOZ ALTA ═══
--
-- Una evaluacion puede tener varias mediciones (en la base local hay una con cuatro, de reimportaciones
-- de prueba). La consulta de embeds tomaba `bis_measurements[0]`, que es el orden FISICO de la tabla y no
-- un criterio: PostgREST no ordenaba ese embed. Aqui se toma la de `created_at` mas antiguo, que es lo que
-- ese orden fisico devolvia, y se deja escrito para que el dia que haga falta un criterio clinico se
-- decida en vez de heredarse. Lo mismo con el reporte, que hoy es uno por evaluacion en toda la base.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS "public"."pacientes_del_roster";--> statement-breakpoint

CREATE VIEW "public"."pacientes_del_roster"
  WITH (security_invoker = true) AS
SELECT p."id" AS "patient_id",
       p."created_at",
       p."document_type",
       p."document_number",
       p."status",
       COALESCE(p."cuenta_como_de_prueba", false) AS "cuenta_como_de_prueba",
       p."test_proposed_at",
       pp."first_name",
       pp."last_name",
       pp."birth_date",
       -- LAS AUTORIZACIONES VIGENTES, con su firma: `hechosDelConsentimiento` necesita las dos cosas (la
       -- firma que cuenta es la MAS RECIENTE de las necesarias, no la primera).
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object('consent_type', c."consent_type", 'signed_at', c."signed_at"))
           FROM "patient_consents" c
          WHERE c."patient_id" = p."id" AND c."revoked_at" IS NULL
       ), '[]'::jsonb) AS "consentimientos_vigentes",
       -- LAS EVALUACIONES EN PIE: ni reemplazadas por una correccion ni retiradas porque la consulta no
       -- ocurrio. Las dos exclusiones son HECHOS de la propia fila, no criterios.
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
                  'evaluationId', e."id",
                  'type', e."type",
                  'status', e."status",
                  'createdAt', e."created_at",
                  'fechaDeMedicion', (
                    SELECT m."measurement_date" FROM "bis_measurements" m
                     WHERE m."evaluation_id" = e."id"
                     ORDER BY m."created_at" LIMIT 1
                  ),
                  'tieneBis', EXISTS (SELECT 1 FROM "bis_measurements" m WHERE m."evaluation_id" = e."id"),
                  'tieneCondicionesBis', EXISTS (
                    SELECT 1 FROM "evaluation_bis_intake" i WHERE i."evaluation_id" = e."id"
                  ),
                  'tieneDiagnostico', EXISTS (SELECT 1 FROM "diagnoses" d WHERE d."evaluation_id" = e."id"),
                  'reporte', (
                    SELECT r."status"::text FROM "reports" r
                     WHERE r."evaluation_id" = e."id"
                     ORDER BY r."created_at" LIMIT 1
                  ),
                  'importada', e."import_batch_id" IS NOT NULL
                ))
           FROM "evaluations" e
          WHERE e."patient_id" = p."id"
            AND e."superseded_at" IS NULL
            AND e."retirada_at" IS NULL
       ), '[]'::jsonb) AS "evaluaciones"
  FROM "patients" p
  JOIN "patient_profiles" pp ON pp."patient_id" = p."id"
 WHERE p."deleted_at" IS NULL;--> statement-breakpoint

COMMENT ON VIEW "public"."pacientes_del_roster" IS
  'Una fila por paciente para /pacientes, con los HECHOS de sus evaluaciones en pie ya resueltos (exists de medicion, condiciones, diagnostico y estado del reporte) y sus autorizaciones vigentes como jsonb. Reemplaza la cadena de embeds que traia 8,3 filas por paciente. NO decide nada clinico: que le falta al paciente, si se le puede crear evaluacion y si hay algo que regularizar siguen en TypeScript (modules/patients/roster-fila.ts). security_invoker = true: la RLS es la de quien pregunta, asi que un profesional ve solo los suyos.';--> statement-breakpoint

-- A DIFERENCIA DE LAS VISTAS DE LA 0224, esta SI se abre a `authenticated`: es una superficie de pantalla
-- con `security_invoker`, no un producto de datos que se lea como dueño.
GRANT SELECT ON "public"."pacientes_del_roster" TO authenticated;
