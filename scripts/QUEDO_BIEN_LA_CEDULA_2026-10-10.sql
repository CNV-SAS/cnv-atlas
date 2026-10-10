-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿QUEDO BIEN LA CEDULA, O EL BLOQUE (B) NO CORRIO?  ·  SOLO LECTURA
--
-- ═══ POR QUE HAY QUE MIRARLO ═══
--
-- La verificacion devolvio `ya_la_tiene_alguien = 1` para la cedula 15446676, y eso tiene DOS lecturas
-- opuestas que no se distinguen desde ese numero:
--
--   (1) El bloque (B) YA CORRIO, Juan Pablo tiene su cedula buena, y el 1 es el mismo. Todo bien.
--   (2) El bloque (B) NO CORRIO porque esa cedula era de OTRO paciente, y entonces sigue sin resolverse: la
--       integrante tampoco puede crear a Andrea, y ademas hay un tercer paciente con la cedula de Juan Pablo.
--
-- LA CONSULTA DE VERIFICACION SE CORRIO ANTES O DESPUES DEL UPDATE, y no se puede saber cual mirando su
-- resultado. Esto lo dice sin ambiguedad: devuelve QUIEN tiene cada una de las dos cedulas.
--
-- NO SE TOCA NADA. Solo mira.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/QUEDO_BIEN_LA_CEDULA_2026-10-10.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) QUIEN TIENE CADA CEDULA ──────────────────────────────────────────────────────────────────
--
-- LO QUE SE ESPERA SI TODO SALIO BIEN: una sola fila, 15446676 = JUAN PABLO, y 42902851 SIN FILA (libre
-- para Andrea).
select 'A · quien tiene cada cedula'                                     as consulta,
       pa.document_type || ' ' || pa.document_number                      as documento,
       pp.first_name || ' ' || pp.last_name                               as nombre,
       pa.id                                                             as paciente,
       (pa.created_at at time zone 'America/Bogota')::date               as creado_el,
       (select count(*) from evaluations e where e.patient_id = pa.id)    as evaluaciones
  from patients pa
  join patient_profiles pp on pp.patient_id = pa.id
 where pa.document_number in ('15446676', '42902851')
 order by 2;

-- ── (B) Y SI LA CORRECCION QUEDO EN EL AUDIT ─────────────────────────────────────────────────────
--
-- Es la prueba de que el bloque corrio: si el evento esta, el update se hizo (van en la misma transaccion, y
-- sin el audit no queda el cambio).
select 'B · quedo el rastro?'                                            as consulta,
       a.event                                                           as evento,
       (a.created_at at time zone 'America/Bogota')                      as cuando,
       a.payload ->> 'antes'                                             as antes,
       a.payload ->> 'despues'                                           as despues,
       a.payload ->> 'nombre'                                            as nombre
  from clinical_audit_log a
 where a.event in ('patient.document_corrected', 'patient.birth_date_corrected')
   and a.created_at > now() - interval '3 days'
 order by 3 desc;
