-- Dedup defensivo ANTES del UNIQUE: si existieran filas duplicadas (response_id, question_id) el ADD
-- CONSTRAINT fallaria. El camino de la app no las produce (intake/survey-edit son delete-then-insert; la
-- correccion escribe a un response nuevo), asi que en datos normales esto es un no-op. Los unicos duplicados
-- conocidos son anomalias (p.ej. un fixture que insertaba sin el delete). survey_answers NO tiene columna de
-- fecha, asi que "la mas reciente" no es determinable: se conserva UNA fila por (response_id, question_id) de
-- forma determinista por ctid (la fisicamente primera) y se borran las demas. No hay semantica de "ganadora"
-- porque los duplicados no deberian existir; el objetivo es colapsar a una fila para poder aplicar el unique.
DELETE FROM "survey_answers" a
USING "survey_answers" b
WHERE a."response_id" = b."response_id"
  AND a."question_id" = b."question_id"
  AND a.ctid > b.ctid;
--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_question_unique" UNIQUE("response_id","question_id");
