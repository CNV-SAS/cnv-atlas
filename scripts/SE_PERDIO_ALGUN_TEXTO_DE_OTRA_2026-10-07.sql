-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿SE PERDIO YA ALGUN TEXTO LIBRE DE "OTRA"?  ·  SOLO LECTURA
--
-- ═══ POR QUE HAY QUE PREGUNTARLO ═══
--
-- El formulario de EDICION no casaba la flexion importada ("Otros" contra el catalogo "Otra"), asi que la
-- pildora salia apagada y, al guardar, emitia la flexion PELADA sin el texto: "Otros: CREATINA" se convertia
-- en "Otros". La integrante estuvo entrando a esas preguntas y pulsando "Guardar respuestas".
--
-- LA PREGUNTA NO ES SI EL DEFECTO EXISTIA (existia, y ya esta arreglado): es SI ALCANZO A BORRAR ALGO.
--
-- ═══ COMO SE SABE, SI `survey_answers` NO TIENE FECHA ═══
--
-- Por el AUDIT. Cada edicion del profesional escribe `evaluation.survey_edited` con el id de la evaluacion.
-- Asi que:
--
--   · una evaluacion IMPORTADA, con una respuesta "Otr*" PELADA, y CON una edicion registrada
--     -> SOSPECHOSA: pudo tener texto y haberlo perdido al guardar.
--   · una evaluacion importada con una respuesta pelada y SIN ninguna edicion
--     -> el paciente marco la opcion y no escribio nada en el HTML. No se perdio nada.
--
-- NO ES PRUEBA, ES SOSPECHA, y conviene decirlo asi: la edicion pudo tocar OTRA pregunta. Pero acota la lista
-- a lo que hay que mirar contra el HTML de origen, que es lo unico que puede decir que habia antes.
--
-- NO IMPRIME PII: ids de evaluacion, claves de pregunta, conteos y fechas.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/SE_PERDIO_ALGUN_TEXTO_DE_OTRA_2026-10-07.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) LA RESPUESTA EN UNA FILA ──────────────────────────────────────────────────────────────────
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
),
editadas as (
  select distinct entity_id::uuid as evaluation_id
    from clinical_audit_log
   where event = 'evaluation.survey_edited'
)
select 'A · el conteo'                                                   as consulta,
       count(*)                                                          as respuestas_peladas,
       count(*) filter (where p.importada)                               as peladas_importadas,
       count(*) filter (where p.importada and e.evaluation_id is not null) as sospechosas_de_perdida,
       count(*) filter (where p.importada and e.evaluation_id is null)    as peladas_de_origen
  from peladas p
  left join editadas e on e.evaluation_id = p.evaluation_id;

-- ── (B) LAS SOSPECHOSAS, UNA POR UNA, para cotejarlas contra el HTML ─────────────────────────────
with peladas as (
  select sr.evaluation_id, sq.field_key as clave, sr.import_batch_id
    from survey_answers sa
    join survey_responses sr on sr.id = sa.response_id
    join survey_questions sq on sq.id = sa.question_id,
         lateral (
           select case when sa.answer_value like '[%'
                       then (select array_agg(x) from jsonb_array_elements_text(sa.answer_value::jsonb) as t(x))
                       else array[sa.answer_value] end as els
         ) ex
   where sa.answer_value is not null
     and sr.import_batch_id is not null
     and exists (select 1 from unnest(ex.els) as e where e ~* '^otr[oa]s?$')
)
select 'B · sospechosas'                                     as consulta,
       p.evaluation_id,
       p.clave,
       count(a.id)                                           as ediciones,
       max(a.created_at at time zone 'America/Bogota')        as ultima_edicion
  from peladas p
  join clinical_audit_log a
    on a.event = 'evaluation.survey_edited' and a.entity_id = p.evaluation_id::text
 group by 1, 2, 3
 order by 5 desc;

-- ── (C) CUANTAS ENCUESTAS IMPORTADAS SE EDITARON, en total ──────────────────────────────────────
--
-- El contexto: si se editaron tres el riesgo es chico, y si se editaron cuarenta, hay que cotejar el lote.
select 'C · ediciones sobre encuestas importadas'            as consulta,
       count(distinct a.entity_id)                           as evaluaciones_editadas,
       min(a.created_at at time zone 'America/Bogota')        as la_primera,
       max(a.created_at at time zone 'America/Bogota')        as la_ultima
  from clinical_audit_log a
  join survey_responses sr on sr.evaluation_id = a.entity_id::uuid
 where a.event = 'evaluation.survey_edited'
   and sr.import_batch_id is not null;

-- ── (D) Y LAS 14 PELADAS: ¿de que lote son? ─────────────────────────────────────────────────────
--
-- `conElTextoDeOtra` (el merge del texto libre al importar) existe desde el 2026-09-23, y el import se
-- estreno el 2026-09-22. Un lote importado ESE primer dia pudo quedarse sin el texto por eso, y entonces la
-- perdida es de la importacion y no de la edicion.
select 'D · peladas por lote'                                as consulta,
       (b.imported_at at time zone 'America/Bogota')::date   as dia_del_lote,
       count(*)                                              as peladas
  from survey_answers sa
  join survey_responses sr on sr.id = sa.response_id
  join html_import_batches b on b.id = sr.import_batch_id,
       lateral (
         select case when sa.answer_value like '[%'
                     then (select array_agg(x) from jsonb_array_elements_text(sa.answer_value::jsonb) as t(x))
                     else array[sa.answer_value] end as els
       ) ex
 where sa.answer_value is not null
   and exists (select 1 from unnest(ex.els) as e where e ~* '^otr[oa]s?$')
 group by 1, 2
 order by 2;
