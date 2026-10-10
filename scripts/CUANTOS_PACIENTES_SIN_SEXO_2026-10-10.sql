-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CUANTOS PACIENTES NO TIENEN SEXO REGISTRADO, Y A QUIEN LE BLOQUEAN UNA CONSULTA
--
-- Solo LECTURA. No escribe nada. Responde la segunda pregunta del caso del 2026-10-10 (la evaluacion
-- e4939971: "Esta pestaña no se pudo mostrar" al entrar a Diagnostico, por `normalizeSex`): ese caso
-- ¿es uno solo o hay mas esperando?
--
-- POR QUE PASA: el motor exige el sexo exacto F/M (todas sus clasificaciones son sexo-especificas). El
-- intake lo pide obligatorio, pero el import del HTML lo mapea desde la palabra del archivo y lo deja
-- NULO cuando no la reconoce, sin avisar. Desde el 2026-10-10 el import lo cuenta y lo dice al terminar,
-- y la ficha del paciente tiene un bloque para completarlo; esta consulta es para los que ya entraron.
--
-- SIN PII A PROPOSITO: ni nombre, ni documento, ni correo. Solo el id del paciente (que es lo que hace
-- falta para abrir su ficha en /pacientes/<id>) y el estado de sus consultas, que es lo que dice si
-- alguien esta frenado AHORA.
--
-- LAS DOS FORMAS DE "SIN SEXO", y se miran las dos porque el remedio difiere:
--   · VACIO (nulo o en blanco): lo completa el profesional en la ficha.
--   · PRESENTE PERO NO F/M (un "mujer" de los perfiles viejos de texto libre): la ficha NO lo toca
--     (solo rellena huecos, nunca pisa un valor). Esos los canoniza `normalize-patient-sex.mjs`.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. EL TAMAÑO DEL PROBLEMA, de un vistazo.
select
  count(*) filter (where pp.sex is null or btrim(pp.sex) = '')                  as vacio_arreglable_en_la_ficha,
  count(*) filter (where btrim(upper(pp.sex)) not in ('F','M') and btrim(pp.sex) <> '') as valor_invalido_necesita_script,
  count(*)                                                                      as pacientes_totales
  from patient_profiles pp
  join patients p on p.id = pp.patient_id
 where p.deleted_at is null;

-- 2. QUIENES SON (por id) Y SI ESTAN FRENANDO ALGO. Ordenados por urgencia: primero quien tiene una
--    consulta abierta sin diagnostico, que es exactamente el caso de la integrante.
select
  pp.patient_id,
  case when pp.sex is null or btrim(pp.sex) = '' then 'vacio' else 'invalido: ' || pp.sex end as sexo,
  p.document_type,
  (select count(*) from evaluations e where e.patient_id = p.id and e.retirada_at is null) as consultas,
  (select count(*) from evaluations e
    where e.patient_id = p.id and e.retirada_at is null and e.status = 'in_progress') as consultas_abiertas,
  (select count(*) from evaluations e
     join diagnoses d on d.evaluation_id = e.id
    where e.patient_id = p.id and e.retirada_at is null) as consultas_con_diagnostico,
  (select count(*) from evaluations e
    where e.patient_id = p.id and e.retirada_at is null and e.import_batch_id is not null) as consultas_importadas,
  -- SUBCONSULTA Y NO JOIN: un paciente puede tener varias relaciones (se reasigna), y un join
  -- duplicaria su fila, que es justo lo que no se quiere al contar a quien hay que arreglar.
  (select string_agg(distinct pr.profession::text, ', ')
     from patient_professional_relationships rel
     join professional_profiles pr on pr.id = rel.professional_id
    where rel.patient_id = p.id) as profesiones,
  p.created_at
  from patient_profiles pp
  join patients p on p.id = pp.patient_id
 where p.deleted_at is null
   and (pp.sex is null or btrim(upper(pp.sex)) not in ('F','M'))
 order by consultas_abiertas desc, consultas_con_diagnostico desc, p.created_at;

-- 3. ¿Y ALGUN PACIENTE SIN FILA DE PERFIL? Seria el otro camino al mismo 500 (el lector del pipeline
--    lee `profile?.sex ?? null`, asi que una fila ausente se ve igual que un sexo nulo). Si esto da 0,
--    el unico hueco es el de arriba.
select count(*) as pacientes_sin_fila_de_perfil
  from patients p
  left join patient_profiles pp on pp.patient_id = p.id
 where p.deleted_at is null and pp.patient_id is null;
