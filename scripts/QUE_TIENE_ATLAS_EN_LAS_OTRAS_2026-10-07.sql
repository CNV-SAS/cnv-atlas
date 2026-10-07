-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- QUE TIENE ATLAS HOY EN CADA "OTRA" DE LAS TRES EDITADAS  ·  SOLO LECTURA
--
-- ═══ LAS DOS PREGUNTAS QUE CIERRA ═══
--
-- (1) QUE HAY QUE TECLEAR, Y DONDE. Santiago va a reescribir a mano los tres textos que el guardado borro,
--     asi que necesita ver la PREGUNTA (su enunciado, no su clave) y lo que Atlas tiene ahora en ella.
--
-- (2) Y SI SE PERDIO ALGO MAS QUE LA 35. El HTML de CC 42678918 traia DOS textos: `d4_35` ("Otros") y
--     `d6_qx` ("Otra", cirugias). El barrido de peladas no reporto el `d6_qx`, asi que ese texto deberia
--     estar en Atlas. ESTO LO COMPRUEBA en vez de suponerlo: lista TODAS las respuestas con una flexion de
--     "Otra" de esas tres evaluaciones, con texto y sin texto, y marca cuales estan vacias.
--
-- ═══ Y ENSANCHA EL PATRON DE "PELADA", QUE ERA LA GRIETA DEL BARRIDO ANTERIOR ═══
--
-- El barrido buscaba el valor EXACTO ('otra', 'otros'...). Si el guardado hubiera dejado "Otros:" con el
-- separador y nada detras, no lo habria encontrado, y la respuesta se veria igual de incompleta en pantalla.
-- Aqui el patron admite el separador y los espacios: `^otr[oa]s?\s*:?\s*$`.
--
-- SI IMPRIME TEXTO CLINICO de tres pacientes, y es deliberado: es justo lo que se va a reparar. No imprime
-- nombres, y son tres filas, no un volcado.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/QUE_TIENE_ATLAS_EN_LAS_OTRAS_2026-10-07.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

with las_tres(evaluation_id) as (
  values ('1c968e45-bc9f-4978-8eb9-3ef99b1f6c96'::uuid),
         ('698438b2-f651-4d3a-a686-34026cfac20f'::uuid),
         ('8d266d29-43d5-47e1-a7a7-1333995db12a'::uuid)
)
select pa.document_type || ' ' || pa.document_number                as documento,
       sq.field_key                                                as clave,
       -- EL ENUNCIADO, no solo la clave: es lo que Santiago va a buscar en la pantalla.
       left(sq.question_text, 70)                                   as pregunta,
       sa.answer_value                                              as lo_que_atlas_tiene,
       -- ¿QUEDO PELADA? Patron ENSANCHADO: admite el separador y los espacios, no solo el valor exacto.
       exists (
         select 1
           from unnest(
                  case when sa.answer_value like '[%'
                       then (select array_agg(x) from jsonb_array_elements_text(sa.answer_value::jsonb) as t(x))
                       else array[sa.answer_value] end
                ) as e
          where e ~* '^otr[oa]s?\s*:?\s*$'
       )                                                            as quedo_pelada
  from las_tres t
  join evaluations e        on e.id = t.evaluation_id
  join patients pa          on pa.id = e.patient_id
  join survey_responses sr  on sr.evaluation_id = e.id
  join survey_answers sa    on sa.response_id = sr.id
  join survey_questions sq  on sq.id = sa.question_id
 where sa.answer_value is not null
   and sa.answer_value ~* 'otr[oa]s?'
 order by 1, 2;
