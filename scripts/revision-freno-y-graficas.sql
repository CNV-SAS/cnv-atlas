-- SOLO LEE. Para el editor SQL de Supabase (nube).

-- ═══ 1. ¿"Hhh Ooo" DE VERDAD EMPEORO? ═══
--
-- El freno pide DOS cosas: que la banda sellada del reporte diga 'empeoro' Y que no haya proxima cita.
-- Si `band` sale distinto de 'empeoro' (o null), el bloque ambar NO tiene que aparecer: no es un defecto,
-- es que ese paciente no cumple la condicion.
select p.document_number,
       e.id            as evaluacion,
       e.type          as tipo,
       r.created_at    as reporte_creado,
       r.status        as estado_reporte,
       r.trajectory->>'band'      as banda,
       r.trajectory->>'ebDelta'   as delta_eb,
       (r.trajectory->>'provisional')::bool as provisional,
       (select t.proxima_cita
          from treatments t join diagnoses d on d.id = t.diagnosis_id
         where d.evaluation_id = e.id
         order by t.created_at desc limit 1) as proxima_cita
  from patients p
  join patient_profiles pp on pp.patient_id = p.id
  join evaluations e on e.patient_id = p.id
  left join reports r on r.evaluation_id = e.id and r.type = 'paciente'
 where lower(pp.first_name || ' ' || pp.last_name) like '%hhh%'
 order by e.created_at desc, r.created_at desc;

-- COMO SE LEE:
--   banda = 'empeoro' y proxima_cita NULL  -> el bloque ambar DEBE salir. Si no salio, es defecto.
--   banda = 'empeoro' y proxima_cita CON FECHA -> sale el aviso gris. Correcto.
--   banda = 'mejoro' / 'sin_cambio' / NULL -> no sale nada. Correcto.
--   banda NULL en un SEGUIMIENTO -> no habia previa comparable, o el intervalo fue menor a 12 semanas.

-- ═══ 2. UN SEGUIMIENTO QUE SI EMPEORO, si el de arriba no sirve ═══
select pp.first_name || ' ' || pp.last_name as paciente,
       p.document_number,
       e.id as evaluacion,
       r.trajectory->>'band' as banda,
       (select t.proxima_cita
          from treatments t join diagnoses d on d.id = t.diagnosis_id
         where d.evaluation_id = e.id order by t.created_at desc limit 1) as proxima_cita
  from reports r
  join evaluations e on e.id = r.evaluation_id
  join patients p on p.id = e.patient_id
  join patient_profiles pp on pp.patient_id = p.id
 where r.type = 'paciente'
   and r.trajectory->>'band' = 'empeoro'
 order by r.created_at desc
 limit 10;

-- ═══ 3. LAS TRES GRAFICAS DEL PACIENTE 1000898123 ═══
--
-- La serie pintaba un punto POR REPORTE (ya corregido: ahora es uno por evaluacion). Esto dice cual de
-- las dos cosas hay en la nube: varios reportes de la misma evaluacion, o varias evaluaciones el mismo dia.
select e.id           as evaluacion,
       e.type         as tipo,
       e.created_at   as evaluacion_creada,
       e.superseded_at,
       (select count(*) from reports r where r.evaluation_id = e.id and r.type = 'paciente') as reportes,
       (select count(*) from bis_measurements m where m.evaluation_id = e.id)                as mediciones,
       (select max(m.measurement_date) from bis_measurements m where m.evaluation_id = e.id) as fecha_medicion
  from evaluations e
  join patients p on p.id = e.patient_id
 where p.document_number = '1000898123'
 order by e.created_at desc;

-- COMO SE LEE:
--   una fila con reportes = 3   -> era el defecto de la serie. Ya corregido en el codigo.
--   tres filas con la misma fecha_medicion -> hay tres evaluaciones de verdad, y la grafica decia la
--                                             verdad: lo que sobra son las evaluaciones.

-- ═══ 4. "Hhh Ooo", BUSCADO POR PARTES (2026-09-19, segunda vuelta) ═══
--
-- La consulta 1 no lo encontró: su `like '%hhh%'` exige que el nombre esté escrito así de seguido y en
-- minúsculas dentro de nombre+apellido. Esta busca cada parte por separado y sin importar mayúsculas.
select pp.first_name || ' ' || pp.last_name as paciente,
       p.document_type || ' ' || p.document_number as documento,
       e.id            as evaluacion,
       e.type          as tipo,
       e.created_at    as evaluacion_creada,
       r.trajectory->>'band'    as banda,
       r.trajectory->>'ebDelta' as delta_eb,
       (select max(m.measurement_date) from bis_measurements m where m.evaluation_id = e.id) as fecha_medicion,
       (select t.proxima_cita
          from treatments t join diagnoses d on d.id = t.diagnosis_id
         where d.evaluation_id = e.id order by t.created_at desc limit 1) as proxima_cita
  from patients p
  join patient_profiles pp on pp.patient_id = p.id
  join evaluations e on e.patient_id = p.id
  left join reports r on r.evaluation_id = e.id and r.type = 'paciente'
 where pp.first_name ilike '%hhh%' or pp.last_name ilike '%ooo%'
 order by e.created_at desc, r.created_at desc;

-- ═══ 5. POR QUE UN SEGUIMIENTO NO TIENE BANDA ═══
--
-- La banda solo se sella si hay una evaluación PREVIA comparable con 12 semanas o más de diferencia entre
-- MEDICIONES. Esto muestra las mediciones del paciente en orden, para ver el intervalo real.
select pp.first_name || ' ' || pp.last_name as paciente,
       e.type,
       m.measurement_date,
       lag(m.measurement_date) over (partition by p.id order by m.measurement_date) as medicion_anterior,
       round(
         extract(epoch from (m.measurement_date
           - lag(m.measurement_date) over (partition by p.id order by m.measurement_date))) / 604800
       , 1) as semanas_desde_la_anterior
  from patients p
  join patient_profiles pp on pp.patient_id = p.id
  join evaluations e on e.patient_id = p.id
  join bis_measurements m on m.evaluation_id = e.id
 where pp.first_name ilike '%hhh%' or pp.last_name ilike '%ooo%'
 order by m.measurement_date;

-- COMO SE LEE: si `semanas_desde_la_anterior` es menor que 12, NO hay banda y el bloque ámbar no sale.
-- Es el comportamiento correcto, no un defecto: comparar dos mediciones demasiado cercanas mide ruido.
