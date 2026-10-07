-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LAS DOS EVALUACIONES DE LA PACIENTE db3e5f71: ¿QUE TIENE CADA UNA?  ·  SOLO LECTURA
--
-- ═══ POR QUE HAY QUE MIRAR ESTO ANTES DE TOCAR NADA ═══
--
-- Santiago propone retirar la INICIAL (del 25) "que no tiene nada" y volver inicial la del 21.
--
-- PERO LA DEL 25 ESTA "Completada", Y ESO NO ES AUTOMATICO: en Atlas `completed` lo pone `closeEvaluation`,
-- o sea un acto EXPLICITO del profesional cerrando la consulta. Si la cerro, trabajo en ella.
--
-- Y SI ADEMAS TIENE DIAGNOSTICO, retirarla seria esconder la unica salida clinica del paciente. El sistema va
-- a negarse a hacerlo (el retiro lo prohibe cuando hay diagnostico), pero conviene saberlo ANTES de decidir.
--
-- LO QUE ESTO CONTESTA, para las dos: si tiene encuesta, si tiene medicion BIS, si tiene diagnostico, si
-- tiene tratamiento y si se le entrego algo al paciente. Con eso se decide cual sobra, si sobra alguna.
--
-- NO IMPRIME PII: ni nombre, ni documento, ni respuestas.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/LAS_DOS_EVALUACIONES_DE_ESA_PACIENTE_2026-10-07.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

select 'que tiene cada evaluacion'                                        as consulta,
       e.id                                                               as evaluacion,
       e.type                                                             as tipo,
       e.status                                                           as estado,
       (e.created_at at time zone 'America/Bogota')::date                 as dia,
       e.import_batch_id is not null                                      as importada_del_html,
       (e.closed_at at time zone 'America/Bogota')                        as cerrada_el,
       e.superseded_at is not null                                        as reemplazada,
       -- LO QUE DE VERDAD DECIDE: cuanta sustancia clinica cuelga de ella.
       (select count(*) from survey_responses sr
          join survey_answers sa on sa.response_id = sr.id
         where sr.evaluation_id = e.id)                                   as respuestas_de_encuesta,
       (select count(*) from bis_measurements m where m.evaluation_id = e.id) as mediciones_bis,
       (select count(*) from diagnoses d where d.evaluation_id = e.id)     as diagnosticos,
       (select count(*) from treatments t
          join diagnoses d2 on d2.id = t.diagnosis_id
         where d2.evaluation_id = e.id)                                   as tratamientos,
       (select count(*) from hc_deliveries h where h.evaluation_id = e.id) as entregas_al_paciente
  from evaluations e
 where e.patient_id = 'db3e5f71-7c59-4c9b-801e-8c7a38f6135d'
 order by e.created_at;
