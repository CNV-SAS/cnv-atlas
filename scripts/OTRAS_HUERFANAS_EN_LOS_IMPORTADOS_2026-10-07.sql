-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿CUANTAS RESPUESTAS IMPORTADAS TIENEN UNA "OTRA" QUE NO EXISTE EN EL CATALOGO?  ·  SOLO LECTURA
--
-- ═══ EL CASO (Santiago, 2026-10-07) ═══
--
-- Paciente importado del HTML, pregunta 35 (suplementos): la encuesta dice "63 de 64", en LECTURA salen tres
-- opciones marcadas y en EDICION solo dos. La integrante dice que pasa con mas pacientes.
--
-- ═══ UNA SOLA CAUSA, TRES SINTOMAS ═══
--
-- El HTML escribe esa opcion "Otros" (plural) y el catalogo de Atlas la tiene como "Otra" (singular,
-- verificado en el seed). La importacion copia el valor TAL CUAL, asi que queda guardado un texto que NO es
-- ninguna opcion de Atlas. De ahi:
--
--   1. LECTURA pinta el valor guardado verbatim -> se ve "Otros" marcado.
--   2. EDICION pinta el CATALOGO y marca por texto EXACTO -> "Otros" no casa con "Otra" -> sale sin marcar.
--      Y OJO: si se guarda desde ahi, el valor se PIERDE, porque el widget emite solo lo marcado.
--   3. COMPLETITUD trata un "Otr*" PELADO como "eligio otra y no especifico", y eso invalida la respuesta
--      ENTERA (`isAnswered` -> false) aunque haya dos opciones buenas al lado. De ahi el "falta 1 pregunta".
--
-- ESTO CONTESTA LAS DOS PREGUNTAS QUE IMPORTAN: en cuantos pacientes pasa, y en cuantas preguntas.
--
-- NO IMPRIME DATOS DE PACIENTE: solo conteos, la clave de la pregunta y el valor guardado (que es una opcion
-- de la encuesta, no un dato de la persona). La consulta (D) si trae ids de evaluacion para poder revisarlos.
--
-- COMO SE CORRE (contra la NUBE, en el SQL editor de Supabase):
--   psql "<cadena>" -f scripts/OTRAS_HUERFANAS_EN_LOS_IMPORTADOS_2026-10-07.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) LA RESPUESTA EN UNA FILA ──────────────────────────────────────────────────────────────────
--
-- Una respuesta es "huerfana" si alguno de sus valores parece una opcion "Otra*" (en cualquier flexion, con o
-- sin texto despues) y ESE TEXTO BASE no esta entre las opciones de SU pregunta.
with respuestas as (
  select sa.id,
         sr.evaluation_id,
         sq.field_key                                        as clave,
         sq.question_text                                    as pregunta,
         sa.answer_value                                     as valor,
         -- Los elementos de una multi (JSON) o el valor pelado de una unica.
         case when sa.answer_value like '[%'
              then (select array_agg(x) from jsonb_array_elements_text(sa.answer_value::jsonb) as t(x))
              else array[sa.answer_value]
         end                                                 as elementos,
         (select array_agg(so.option_text)
            from survey_options so where so.question_id = sq.id) as opciones
    from survey_answers sa
    join survey_responses sr on sr.id = sa.response_id
    join survey_questions sq on sq.id = sa.question_id
   where sa.answer_value is not null
     and sa.answer_value <> ''
),
huerfanas as (
  select r.*,
         (select array_agg(e)
            from unnest(r.elementos) as e
           where e ~* '^otr[oa]s?(\s*:.*)?$'
             and not exists (
               select 1 from unnest(r.opciones) as o
                where lower(btrim(o)) = lower(btrim(regexp_replace(e, '\s*:.*$', '')))
             )
         ) as otras_sin_opcion
    from respuestas r
)
select 'A · el conteo' as consulta,
       count(*)                                        as respuestas_afectadas,
       count(distinct evaluation_id)                   as evaluaciones_afectadas,
       count(distinct clave)                           as preguntas_distintas
  from huerfanas
 where otras_sin_opcion is not null;

-- ── (B) POR PREGUNTA: cual, cuantas veces, y con que texto quedo ──────────────────────────────────
with respuestas as (
  select sa.id, sr.evaluation_id, sq.id as qid, sq.field_key as clave, sq.question_text as pregunta,
         case when sa.answer_value like '[%'
              then (select array_agg(x) from jsonb_array_elements_text(sa.answer_value::jsonb) as t(x))
              else array[sa.answer_value]
         end as elementos,
         (select array_agg(so.option_text) from survey_options so where so.question_id = sq.id) as opciones
    from survey_answers sa
    join survey_responses sr on sr.id = sa.response_id
    join survey_questions sq on sq.id = sa.question_id
   where sa.answer_value is not null and sa.answer_value <> ''
)
select 'B · por pregunta' as consulta,
       r.clave,
       left(r.pregunta, 55)                            as pregunta,
       e                                               as valor_guardado,
       -- COMO SE LLAMA EN ATLAS, para ver el descalce de una ojeada.
       (select o from unnest(r.opciones) as o where o ~* '^otr[oa]s?$' limit 1) as opcion_de_atlas,
       count(*)                                        as veces,
       count(distinct r.evaluation_id)                 as evaluaciones
  from respuestas r, unnest(r.elementos) as e
 where e ~* '^otr[oa]s?(\s*:.*)?$'
   and not exists (
     select 1 from unnest(r.opciones) as o
      where lower(btrim(o)) = lower(btrim(regexp_replace(e, '\s*:.*$', '')))
   )
 group by 1, 2, 3, 4, 5
 order by veces desc;

-- ── (C) ¿SE PERDIO EL TEXTO LIBRE, O SOLO QUEDO DESCALZADA LA OPCION? ─────────────────────────────
--
-- Es la otra mitad de la hipotesis de Santiago. Si el valor es "Otros" PELADO, el texto que el paciente
-- escribio en el HTML no esta en Atlas y NO SE RECUPERA desde aqui (habria que volver al HTML de origen).
-- Si es "Otros: algo", el texto si llego y lo unico descalzado es la palabra.
--
-- EL MERGE DEL TEXTO LIBRE existe en el importador (`conElTextoDeOtra`) desde el 2026-09-23, y el import se
-- estreno el 2026-09-22: un lote importado ESE primer dia pudo quedarse sin el texto por eso.
with respuestas as (
  select sq.field_key as clave,
         case when sa.answer_value like '[%'
              then (select array_agg(x) from jsonb_array_elements_text(sa.answer_value::jsonb) as t(x))
              else array[sa.answer_value]
         end as elementos
    from survey_answers sa
    join survey_responses sr on sr.id = sa.response_id
    join survey_questions sq on sq.id = sa.question_id
   where sa.answer_value is not null and sa.answer_value <> ''
)
select 'C · con texto o pelada' as consulta,
       count(*) filter (where e ~* '^otr[oa]s?$')         as peladas_sin_texto,
       count(*) filter (where e ~* '^otr[oa]s?\s*:\s*.+') as con_texto
  from respuestas r, unnest(r.elementos) as e
 where e ~* '^otr[oa]s?(\s*:.*)?$';

-- ── (D) LAS EVALUACIONES AFECTADAS, para poder abrirlas ──────────────────────────────────────────
with respuestas as (
  select sr.evaluation_id, sq.field_key as clave,
         case when sa.answer_value like '[%'
              then (select array_agg(x) from jsonb_array_elements_text(sa.answer_value::jsonb) as t(x))
              else array[sa.answer_value]
         end as elementos,
         (select array_agg(so.option_text) from survey_options so where so.question_id = sq.id) as opciones
    from survey_answers sa
    join survey_responses sr on sr.id = sa.response_id
    join survey_questions sq on sq.id = sa.question_id
   where sa.answer_value is not null and sa.answer_value <> ''
)
select 'D · evaluaciones' as consulta,
       r.evaluation_id,
       string_agg(distinct r.clave, ', ' order by r.clave) as preguntas
  from respuestas r, unnest(r.elementos) as e
 where e ~* '^otr[oa]s?(\s*:.*)?$'
   and not exists (
     select 1 from unnest(r.opciones) as o
      where lower(btrim(o)) = lower(btrim(regexp_replace(e, '\s*:.*$', '')))
   )
 group by 1, 2
 order by 2;
