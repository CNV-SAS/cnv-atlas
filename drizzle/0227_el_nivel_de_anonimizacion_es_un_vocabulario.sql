-- EL NIVEL DE ANONIMIZACION DEJA DE SER TEXTO LIBRE (Gildardo, 2026-10-24).
--
-- *"Abre el vocabulario a pseudonymized, cerrado con CHECK o enum, y que el nivel se derive de lo que el
-- export quita. La tabla esta vacia: hoy es gratis."*
--
-- ── DE DONDE SALE EL PROBLEMA ───────────────────────────────────────────────────────────────────────
--
-- `anonymization_level` era `text NOT NULL` SIN NINGUNA restriccion. El unico sitio donde constaba su
-- vocabulario era un comentario del schema de Drizzle ("aggregate, anonymized"), que no es un control: con
-- eso, un dataset podia quedar rotulado 'anonimizado', 'anon', 'ninguno' o vacio, y los tres se leerian
-- igual de validos. Y faltaba el nivel que de verdad describe lo que CNV produce hoy: SEUDONIMIZADO.
--
-- ── LOS TRES NIVELES, Y SU FUENTE ───────────────────────────────────────────────────────────────────
--
-- Las definiciones NO son nuestras: salen de `docs/DATA_GOVERNANCE.md`, que es el documento que gobierna
-- esto, y se citan en `nivel-de-anonimizacion.ts` linea por linea.
--
--   aggregate      Solo cifras por cohorte, nunca fila a fila re-identificable (regla 3 del uso agregado).
--   pseudonymized  Fila por paciente con una llave estable (`patient_id` o un `research_id`) que permite
--                  volver a unir sus registros. SIGUE SIENDO DATO PERSONAL bajo la Ley 1581: es el nivel
--                  de la investigacion interna (CNV Research / ObBIA) "bajo gobernanza y consentimiento".
--   anonymized     Identificadores directos suprimidos INCLUIDO el patient_id, cuasi-identificadores
--                  generalizados y k-anonimato verificado (k >= 5, PENDIENTE JURIDICO de ratificacion).
--                  Solo entonces deja de ser dato personal.
--
-- ── POR QUE UN CHECK Y NO UN ENUM ───────────────────────────────────────────────────────────────────
--
-- Un valor de enum en Postgres no se puede quitar, y este vocabulario va a crecer con un nivel que todavia
-- no existe (un agregado con k verificado). El CHECK se lee al lado de la tabla, se cambia con una
-- migracion normal, y cierra igual de bien. El vocabulario tambien vive en TypeScript, y un candado
-- compara las dos listas: si una crece y la otra no, la prueba falla.
--
-- GRATIS HOY: la tabla tiene 0 filas, asi que no hay nada que migrar. Dentro de un mes habria que decidir
-- que rotulo le ponemos a lo ya emitido, y nadie podria saberlo.
ALTER TABLE "research_datasets"
  DROP CONSTRAINT IF EXISTS "research_datasets_anonymization_level_vocabulario";--> statement-breakpoint
ALTER TABLE "research_datasets"
  ADD CONSTRAINT "research_datasets_anonymization_level_vocabulario"
  CHECK ("anonymization_level" IN ('aggregate', 'pseudonymized', 'anonymized'));--> statement-breakpoint

COMMENT ON COLUMN "research_datasets"."anonymization_level" IS
  'aggregate | pseudonymized | anonymized. NO se teclea: se DERIVA de lo que el export quita (modules/obbia/services/nivel-de-anonimizacion.ts), porque quitar el identificador directo no basta para anonimizar y un rotulo escrito a mano acaba diciendo lo que conviene. Definiciones y fuente en docs/DATA_GOVERNANCE.md (Seudonimizacion vs. anonimizacion, y Anonimizacion real).';
