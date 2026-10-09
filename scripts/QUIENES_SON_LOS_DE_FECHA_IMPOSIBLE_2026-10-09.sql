-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- QUIENES SON LOS TRES DE LA FECHA IMPOSIBLE, Y QUE DIJERON SUS DIAGNOSTICOS  ·  SOLO LECTURA
--
-- ═══ LA PREGUNTA DE SANTIAGO, EN ESE ORDEN ═══
--
-- *"Quiero verificar de quien es el paciente de esa edad imposible y como se llama y que documento tiene,
-- porque puede ser de prueba. En ese caso, solo lo marcaria como prueba."*
--
-- Y es el orden correcto: si son de prueba, el problema se acaba marcandolos y no hay nada que rehacer. Solo
-- si son REALES hay que mirar que dijo su diagnostico.
--
-- SI IMPRIME NOMBRES Y DOCUMENTOS, y es deliberado: es lo que la pregunta pide, son tres filas, y sin el
-- nombre no se puede saber de quien se trata. El resultado se queda en la pantalla de Santiago.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/QUIENES_SON_LOS_DE_FECHA_IMPOSIBLE_2026-10-09.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) QUIENES SON, Y DE QUIEN ──────────────────────────────────────────────────────────────────
select 'A · quienes son'                                                 as consulta,
       pa.document_type || ' ' || pa.document_number                      as documento,
       pp.first_name || ' ' || pp.last_name                               as nombre,
       pp.birth_date                                                      as fecha_de_nacimiento,
       -- ¿YA ESTA MARCADO DE PRUEBA? La derivada de la 0203: cuenta la marca del paciente Y la del profesional.
       coalesce(pa.cuenta_como_de_prueba, false)                          as ya_cuenta_como_de_prueba,
       coalesce(pa.is_test, false)                                        as marcado_a_mano,
       -- DE QUE INTEGRANTE ES, que es la otra mitad de la pregunta.
       (select string_agg(distinct pr.full_name, ', ')
          from patient_professional_relationships r
          join professional_profiles ppf on ppf.id = r.professional_id
          join profiles pr on pr.id = ppf.profile_id
         where r.patient_id = pa.id)                                      as integrantes,
       (select count(*) from evaluations e where e.patient_id = pa.id)     as evaluaciones,
       (e.created_at at time zone 'America/Bogota')::date                 as primera_evaluacion
  from patients pa
  join patient_profiles pp on pp.patient_id = pa.id
  left join evaluations e on e.patient_id = pa.id
 where pp.birth_date is not null
   and (pp.birth_date > current_date or pp.birth_date < date '1900-01-01')
 order by 4;

-- ── (B) Y QUE DIJERON LOS DIAGNOSTICOS QUE YA SALIERON ───────────────────────────────────────────
--
-- Solo hace falta mirar esto si (A) dice que NO son de prueba. Se piden las piezas donde la EDAD pesa, que es
-- lo que un dato imposible pudo torcer:
--   · la capacitancia, que se clasifica contra una tabla POR DECADA DE EDAD (con 231 años cae fuera y usa la
--     ultima banda, produciendo una clasificacion plausible, que es lo que la hace peligrosa.
--   · y el gasto calorico, que entra en la prescripcion.
select 'B · que dijo el diagnostico'                                     as consulta,
       pa.document_type || ' ' || pa.document_number                      as documento,
       pp.birth_date                                                      as fecha_de_nacimiento,
       d.id                                                               as diagnostico,
       (d.created_at at time zone 'America/Bogota')::date                 as emitido_el,
       d.engine_version                                                   as motor,
       -- LOS INDICADORES VIVEN EN EL SNAPSHOT DEL REPORTE, no en la tabla de diagnosticos (ahi solo esta la
       -- constelacion de versiones). Se saca el bloque entero y no campos sueltos: no se sabe de antemano que
       -- torcio la edad, y pedir solo lo que uno sospecha es como se pasa por alto el resto.
       (select r.snapshot -> 'indicators' from reports r
         where r.evaluation_id = e.id order by r.created_at desc limit 1) as indicadores_sellados,
       (select r.snapshot -> 'dfi' from reports r
         where r.evaluation_id = e.id order by r.created_at desc limit 1) as dfi_sellado
  from diagnoses d
  join evaluations e on e.id = d.evaluation_id
  join patients pa on pa.id = e.patient_id
  join patient_profiles pp on pp.patient_id = pa.id
 where pp.birth_date is not null
   and (pp.birth_date > current_date or pp.birth_date < date '1900-01-01')
 order by 5;

-- ── (C) Y SI HAY MAS CON FECHA SOSPECHOSA PERO NO IMPOSIBLE ──────────────────────────────────────
--
-- Lo que el cinturon NO atrapa y hay que mirar a mano: una edad posible pero improbable. No se bloquea (sin
-- fuente, un rango estrecho seria una cifra nuestra frenando un paciente real), pero se LISTA, porque un
-- paciente de 3 años o de 105 en esta practica es casi seguro un tecleo.
--
-- EL CORTE ES PARA MIRAR, NO PARA DECIDIR: 100 y 5 no salen de ninguna fuente clinica, salen de que es una
-- lista corta de revisar. Lo dice aqui para que nadie los convierta en una validacion.
select 'C · posibles pero improbables (revisar a mano)'                  as consulta,
       pa.document_type || ' ' || pa.document_number                      as documento,
       pp.first_name || ' ' || pp.last_name                               as nombre,
       pp.birth_date                                                      as fecha_de_nacimiento,
       date_part('year', age(pp.birth_date))::int                        as edad,
       coalesce(pa.cuenta_como_de_prueba, false)                          as de_prueba
  from patients pa
  join patient_profiles pp on pp.patient_id = pa.id
 where pp.birth_date is not null
   and pp.birth_date between date '1900-01-01' and current_date
   and (date_part('year', age(pp.birth_date)) > 100 or date_part('year', age(pp.birth_date)) < 5)
 order by 5;
