-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- QUE LES FALTA A LAS EVALUACIONES IMPORTADAS DEL HTML PARA GENERAR DIAGNOSTICO
--
-- Solo LECTURA. No escribe nada. Responde la pregunta de Santiago del 2026-10-02: el caso de Camila
-- (una paciente que "no quiere generar") ¿es aislado o les pasa a varios de los 160?
--
-- LOS CUATRO REQUISITOS QUE ESTA CONSULTA MIRA, y son los mismos que el codigo:
--   1. Los NUEVE insumos del motor (`ENGINE_REQUIRED` en el clinical-engine), guardados en
--      `bis_raw_values.variable_name` con el header NORMALIZADO del export del Biody.
--   2. La cintura y la cadera ("Waist Size cm", "Hips Size cm").
--   3. Las condiciones de la toma REGISTRADAS por una persona (`conditions_registered_at`), sin
--      contraindicacion.
--   4. Que no tenga ya un diagnostico (si lo tiene, genero y no hay nada que mirar).
--
-- LO QUE NO MIRA: la completitud de la ENCUESTA, que el pipeline exige aparte y se calcula por dominio
-- con la version de la encuesta. Se dice aqui para no leer esta tabla como la lista completa.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

with requeridos(nombre) as (values
  ('Extracellular resistance'),
  ('Intracellular resistance Ω'),
  ('Infinite resistance'),
  ('Membrane capacitance nF'),
  ('Masa grasa bruta valor kg'),
  ('Masa sin grasa valor kg'),
  ('Altura cm'),
  ('Indice de masa sin grasa (FFMI) valor kg/m²'),
  ('Peso kg')
),
importadas as (
  select e.id as evaluation_id, e.patient_id, e.created_at, m.id as measurement_id
    from evaluations e
    left join bis_measurements m on m.evaluation_id = e.id
   where e.import_batch_id is not null
),
estado as (
  select i.*,
         (select string_agg(r.nombre, ', ' order by r.nombre)
            from requeridos r
           where i.measurement_id is null
              or not exists (select 1 from bis_raw_values v
                              where v.measurement_id = i.measurement_id and v.variable_name = r.nombre)
         ) as insumos_del_motor_que_faltan,
         (select string_agg(c.nombre, ' y ' order by c.nombre)
            from (values ('cadera'), ('cintura')) as c(nombre)
           where i.measurement_id is null
              or not exists (
                   select 1 from bis_raw_values v
                    where v.measurement_id = i.measurement_id
                      and v.variable_name = case c.nombre when 'cintura' then 'Waist Size cm' else 'Hips Size cm' end
                      and v.value::numeric > 0)
         ) as circunferencias_que_faltan,
         (select bi.conditions_registered_at is null from evaluation_bis_intake bi
           where bi.evaluation_id = i.evaluation_id) as condiciones_sin_registrar,
         coalesce((select bi.contraindicated from evaluation_bis_intake bi
                    where bi.evaluation_id = i.evaluation_id), false) as contraindicada,
         exists (select 1 from diagnoses d where d.evaluation_id = i.evaluation_id) as ya_tiene_diagnostico
    from importadas i
)
-- ── (A) EL RESUMEN: cuantas pueden y cuantas no, y por que ──
select case
         when ya_tiene_diagnostico then 'YA GENERO'
         when measurement_id is null then 'SIN MEDICION: el import no le dejo ninguna'
         when insumos_del_motor_que_faltan is not null then 'LE FALTAN INSUMOS DEL MOTOR'
         when circunferencias_que_faltan is not null then 'LE FALTAN CIRCUNFERENCIAS (se teclean)'
         when contraindicada then 'CONTRAINDICADA (marcapasos): no se diagnostica'
         when condiciones_sin_registrar is not false then 'FALTAN LAS CONDICIONES DE LA TOMA'
         else 'LISTA para generar (salvo la encuesta, que esta consulta no mira)'
       end as estado,
       count(*)::int as evaluaciones,
       count(distinct patient_id)::int as pacientes
  from estado
 group by 1
 order by 2 desc;

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- (B) EL CASO DE CAMILA, evaluacion por evaluacion del paciente 146dca04-2b9c-4542-8cbd-e69a766da57b
--
-- Mismas comprobaciones, sin agrupar, para ver QUE le falta a CADA consulta suya. Cambia el id para
-- mirar cualquier otro paciente.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

with requeridos(nombre) as (values
  ('Extracellular resistance'),
  ('Intracellular resistance Ω'),
  ('Infinite resistance'),
  ('Membrane capacitance nF'),
  ('Masa grasa bruta valor kg'),
  ('Masa sin grasa valor kg'),
  ('Altura cm'),
  ('Indice de masa sin grasa (FFMI) valor kg/m²'),
  ('Peso kg')
)
select e.id as evaluacion,
       e.created_at::date as fecha,
       e.import_batch_id is not null as importada,
       m.id is not null as tiene_medicion,
       (select count(*)::int from bis_raw_values v where v.measurement_id = m.id) as valores_guardados,
       (select string_agg(r.nombre, ', ' order by r.nombre)
          from requeridos r
         where m.id is null
            or not exists (select 1 from bis_raw_values v
                            where v.measurement_id = m.id and v.variable_name = r.nombre)
       ) as insumos_del_motor_que_faltan,
       (select v.value::text from bis_raw_values v
         where v.measurement_id = m.id and v.variable_name = 'Waist Size cm') as cintura,
       (select v.value::text from bis_raw_values v
         where v.measurement_id = m.id and v.variable_name = 'Hips Size cm') as cadera,
       bi.conditions_registered_at is not null as condiciones_registradas,
       bi.contraindicated as contraindicada,
       exists (select 1 from diagnoses d where d.evaluation_id = e.id) as tiene_diagnostico,
       (select count(*)::int from survey_answers sa
         join survey_responses sr on sr.id = sa.response_id
        where sr.evaluation_id = e.id) as respuestas_de_encuesta
  from evaluations e
  left join bis_measurements m on m.evaluation_id = e.id
  left join evaluation_bis_intake bi on bi.evaluation_id = e.id
 where e.patient_id = '146dca04-2b9c-4542-8cbd-e69a766da57b'
 order by e.created_at;

-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- (C) QUE SE GENERO Y QUE NO, en el caso de Camila (2026-10-02)
--
-- La parte (B) dijo que a esa consulta NO LE FALTA NADA y que el diagnostico YA EXISTE. Entonces lo que
-- ella llama "no genera bien" es algo DESPUES del diagnostico, o es otra consulta del mismo paciente.
-- Esta parte mira las dos posibilidades a la vez: una fila por evaluacion, con lo que hay colgando.
--
-- LO QUE SE BUSCA, en orden de sospecha:
--   1. OTRA EVALUACION del mismo paciente, sin diagnostico. Un paciente importado del HTML suele traer
--      varias consultas, y la que ella mira puede no ser la que se consulto.
--   2. El RESUMEN DE IA vacio (`ai_summary` nulo). El diagnostico existe, las cifras estan, y el parrafo
--      que lo explica no: la pantalla se ve "a medias" sin que falte ningun dato.
--   3. El diagnostico SIN CONFIRMAR (`confirmed_at` nulo): sin firma no hay tratamiento ni reporte, y
--      desde la pantalla parece que no termino de generar.
--   4. Y lo de mas abajo: tratamiento, aprobacion y reporte.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

select e.id as evaluacion,
       e.created_at::date as fecha,
       e.import_batch_id is not null as importada,
       d.id is not null as tiene_diagnostico,
       d.diagnosis_name,
       d.ai_summary is null or length(trim(coalesce(d.ai_summary, ''))) = 0 as resumen_de_ia_vacio,
       d.confirmed_at is not null as diagnostico_confirmado,
       d.engine_version,
       d.rules_version,
       -- OJO: el tratamiento cuelga del DIAGNOSTICO (diagnosis_id), no de la evaluacion.
       exists (select 1 from treatments t where t.diagnosis_id = d.id) as tiene_tratamiento,
       exists (select 1 from treatments t where t.diagnosis_id = d.id and t.approved_at is not null) as tratamiento_aprobado,
       exists (select 1 from reports r where r.evaluation_id = e.id) as tiene_reporte
  from evaluations e
  left join diagnoses d on d.evaluation_id = e.id
 where e.patient_id = '146dca04-2b9c-4542-8cbd-e69a766da57b'
 order by e.created_at;

-- ── Y LA MISMA PREGUNTA SOBRE TODOS LOS IMPORTADOS, para saber si es de ella o de todos ──
select count(*)::int as evaluaciones_importadas_con_diagnostico,
       count(*) filter (where d.ai_summary is null or length(trim(coalesce(d.ai_summary, ''))) = 0)::int as sin_resumen_de_ia,
       count(*) filter (where d.confirmed_at is null)::int as sin_confirmar,
       count(distinct d.engine_version)::int as versiones_de_motor_distintas,
       string_agg(distinct d.engine_version, ', ') as cuales
  from evaluations e
  join diagnoses d on d.evaluation_id = e.id
 where e.import_batch_id is not null;
