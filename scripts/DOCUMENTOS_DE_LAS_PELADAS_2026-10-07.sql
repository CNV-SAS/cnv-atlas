-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LOS DOCUMENTOS DE LAS RESPUESTAS PELADAS, PARA RECUPERAR SU TEXTO DEL HTML  ·  SOLO LECTURA
--
-- ═══ POR QUE HACE FALTA, Y QUE SE DESCUBRIO ═══
--
-- El JSON exportado del HTML SI trae el texto libre: en d4_35 hay 56 respuestas que marcaron "Otra" y 54 CON
-- TEXTO. Atlas tiene 5 peladas en esa pregunta, y la consulta del audit habia encontrado exactamente 3
-- evaluaciones editadas mientras el defecto del widget estaba vivo (el que al guardar emitia la flexion sin
-- el texto).
--
-- 2 PELADAS DE ORIGEN + 3 QUE PERDIERON SU TEXTO = las 5 de Atlas. Las cuentas cuadran.
--
-- Y EL TEXTO SE PUEDE RECUPERAR: esta en el JSON. Para buscarlo hace falta el DOCUMENTO del paciente, que es
-- la clave con la que el HTML guarda su historia ("atlas:{documento}").
--
-- ESTA CONSULTA DA ESOS DOCUMENTOS. Despues:
--   node scripts/que-trajo-el-html-en-otra.mjs docs/distribucion/<archivo>.json <doc1> <doc2> <doc3>
--
-- SI IMPRIME DOCUMENTOS DE PACIENTE, que es PII, y es deliberado: sin ellos no hay forma de encontrar su
-- historia en el archivo. Son los MINIMOS (las peladas, no los 160), no salen nombres, y el resultado se queda
-- en la pantalla de Santiago.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/DOCUMENTOS_DE_LAS_PELADAS_2026-10-07.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

with peladas as (
  select sr.evaluation_id,
         sq.field_key                     as clave,
         sr.import_batch_id is not null   as importada
    from survey_answers sa
    join survey_responses sr on sr.id = sa.response_id
    join survey_questions sq on sq.id = sa.question_id,
         lateral (
           select case when sa.answer_value like '[%'
                       then (select array_agg(x) from jsonb_array_elements_text(sa.answer_value::jsonb) as t(x))
                       else array[sa.answer_value] end as els
         ) ex
   where sa.answer_value is not null
     and exists (select 1 from unnest(ex.els) as e where e ~* '^otr[oa]s?$')
)
select p.evaluation_id                                            as evaluacion,
       p.clave,
       pa.document_type || ' ' || pa.document_number               as documento,
       p.importada,
       -- SE EDITO MIENTRAS EL DEFECTO ESTABA VIVO: es la señal de que su texto se perdio al guardar, y no de
       -- que el paciente no escribiera nada.
       exists (select 1 from clinical_audit_log a
                where a.event = 'evaluation.survey_edited'
                  and a.entity_id = p.evaluation_id::text)         as se_edito
  from peladas p
  join evaluations e on e.id = p.evaluation_id
  join patients pa on pa.id = e.patient_id
 where p.importada
 order by 5 desc, 2, 3;
