-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA PESTAÑA DE TRATAMIENTO SE PASABA DEL TIEMPO, Y FALTABA UN INDICE  ·  0236
--
-- ═══ EL CASO (Sentry, 2026-11-03 20:54 UTC, 13 eventos, Unhandled, ESCALATING) ═══
--
--   treatment-reader: treatments: canceling statement due to statement timeout
--   GET /ani-bis-e/[id]?etapa=tratamiento
--
-- Y 70 ms antes, en los breadcrumbs del mismo evento, un 400 sobre la MISMA tabla
-- (`treatments?select=protocol_snapshot,diagnoses!inner(evaluation_id)...`). Ese 400 es el mismo timeout:
-- PostgREST contesta 400 cuando Postgres cancela por tiempo. No eran dos defectos: era uno asomandose dos
-- veces, y el segundo no lo leia nadie.
--
-- ═══ LA CAUSA, MEDIDA ═══
--
-- `treatments.diagnosis_id` es una FK y NO TENIA INDICE. Postgres no indexa las FK por su cuenta. Asi que
-- cualquier busqueda del tratamiento de una consulta barre la tabla ENTERA, y cada fila paga su policy:
-- `treatments_select` hace diagnoses -> evaluations -> `is_patient_professional`, que a su vez consulta
-- `professional_profiles` y `patient_professional_relationships`. Con 462 tratamientos en produccion eso
-- son cientos de miles de visitas de fila por consulta, y la pagina hace TRES consultas de esa forma.
--
-- LA MEDICION (local, rol `authenticated` con el `auth.uid()` del profesional de la evaluacion, 342
-- tratamientos, EXPLAIN ANALYZE de la consulta que arma PostgREST):
--
--   | consulta                                   | seq scan de treatments | tiempo   |
--   |--------------------------------------------|------------------------|----------|
--   | como esta hoy, SIN este indice             | si                     | 121,2 ms |
--   | la MISMA consulta, CON este indice         | no (Index Scan)        |   3,2 ms |
--
-- Treinta y ocho veces menos. Y la forma de la consulta no hace falta cambiarla: se probo tambien la
-- version "invertida" (barrer `diagnoses` por `evaluation_id` y embeber `treatments`) y con el indice las
-- dos dan 3,2 ms, mientras sin el las dos barren igual. O sea: **lo que faltaba era el indice, no otra
-- forma de preguntar**, y por eso aqui no se toca ni un lector.
--
-- Y EL MISMO AGUJERO EN DOS HIJAS DEL TRATAMIENTO. La pestaña lee `treatment_nutraceuticals` y
-- `treatment_diet_guidelines` por `treatment_id`, y ninguna de las dos tenia indice por esa columna
-- (`treatment_notes` y `treatment_approvals` SI lo tienen; las dos que faltaban son justo las que se leen
-- en cada carga). Van en la misma migracion porque son el mismo defecto en el mismo camino.
--
-- ═══ LO QUE ESTO NO ARREGLA, Y QUEDA DICHO ═══
--
-- En la base hay **159 columnas FK sin indice** en 73 tablas. La mayoria son columnas de autoria
-- (`created_by`, `approved_by`) por las que nadie busca, y ahi un indice solo cuesta escritura. Las que
-- importan son las que un lector usa como clave de busqueda sobre una tabla que crece. Las tres de aqui
-- son las de ESTE incidente, medidas; el inventario completo queda reportado para decidirlo aparte, en vez
-- de crear setenta indices sin una medicion que los pida.
--
-- Tampoco se tocan las policies. Las de `treatments` y `diagnoses` todavia llaman `has_role('admin')` sin
-- el subselect de la 0222 (y son 103 de 136 las que estan asi), lo que las reevalua por fila. Con el
-- indice las filas recorridas pasan de 462 a 1, asi que ese coste deja de importar en este camino: se
-- arregla lo que la medicion senala y no se mete una semantica de RLS por delante sin necesidad.
--
-- IDEMPOTENTE Y SIN BLOQUEO DE ESCRITURA APRECIABLE: `if not exists`, y estas tres tablas son pequenas.
-- No se usa `concurrently` porque Drizzle corre cada migracion dentro de una transaccion.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

create index if not exists "treatments_diagnosis_idx" on "treatments" ("diagnosis_id");--> statement-breakpoint
create index if not exists "treatment_nutraceuticals_treatment_idx" on "treatment_nutraceuticals" ("treatment_id");--> statement-breakpoint
create index if not exists "treatment_diet_guidelines_treatment_idx" on "treatment_diet_guidelines" ("treatment_id");--> statement-breakpoint

comment on index "treatments_diagnosis_idx" is
  'El tratamiento de una consulta se busca por aqui (0236). Sin este indice el barrido era la tabla entera y cada fila pagaba treatments_select: /ani-bis-e con ?etapa=tratamiento se caia por statement timeout (Sentry, 2026-11-03, 13 eventos). Medido: 121,2 ms -> 3,2 ms.';
