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
