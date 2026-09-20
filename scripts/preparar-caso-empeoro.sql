-- ═══ PREPARAR UN CASO DE "EMPEORÓ" PARA EL SMOKE (2026-09-19) ═══
--
-- POR QUE HACE FALTA: hoy en la nube NO hay ningún seguimiento con banda `empeoro` (la consulta 2 de
-- `revision-freno-y-graficas.sql` no devuelve filas), así que el paso 8 del smoke (el bloque ámbar y el
-- freno de la entrega) no se puede ejercitar con lo que hay.
--
-- POR QUE NO LO HAY, verificado con "Hhh Ooo": entre sus dos mediciones hay 8,9 semanas y la banda exige
-- 12 (decisión de Gildardo, P0). Sin 12 semanas no se sella banda, y sin banda no hay ámbar. El
-- comportamiento es correcto; lo que falta es un caso que cumpla la condición.
--
-- QUE HACE FALTA PARA QUE SALGA `empeoro`, las dos cosas a la vez:
--   1. Intervalo de 12 semanas o más entre la medición ANTERIOR y la del seguimiento.
--   2. Y que la edad bioeléctrica SUBA 2 años o más (`EB_CHANGE_BAND_YEARS`): más alta = peor.
--
-- ── ESTO NO LO EJECUTA CLAUDE. Se entrega para revisión y lo corre Santiago. ─────────────────────
--
-- Y SOLO SOBRE UN PACIENTE DE PRUEBA: mueve la fecha de una medición, que es dato clínico. El guard de
-- abajo aborta si el paciente no está marcado `is_test`. En un paciente real esto NO se hace: ahí el
-- caso llega solo cuando pasen las 12 semanas.

begin;

do $$
declare
  v_paciente uuid;
  v_inicial  uuid;
  v_fecha    timestamptz;
begin
  -- EL PACIENTE: cámbialo por el documento del de prueba que vayas a usar.
  select p.id into v_paciente
    from patients p
   where p.document_number = '222'
   limit 1;
  if v_paciente is null then
    raise exception 'ABORTADO: no se encontró el paciente.';
  end if;

  if not exists (select 1 from patients where id = v_paciente and is_test) then
    raise exception 'ABORTADO: el paciente no está marcado como de prueba. Esto mueve una fecha de medición y no se hace sobre un paciente real.';
  end if;

  -- La medición MÁS ANTIGUA del paciente: es la "anterior" con la que se compara el seguimiento.
  select m.id, m.measurement_date into v_inicial, v_fecha
    from bis_measurements m
    join evaluations e on e.id = m.evaluation_id
   where e.patient_id = v_paciente
   order by m.measurement_date asc
   limit 1;
  if v_inicial is null then
    raise exception 'ABORTADO: el paciente no tiene mediciones.';
  end if;

  -- SE RETRASA 16 SEMANAS, con margen sobre las 12 que pide la regla.
  update bis_measurements
     set measurement_date = v_fecha - interval '16 weeks'
   where id = v_inicial;

  raise notice 'Medición % movida de % a %.', v_inicial, v_fecha, v_fecha - interval '16 weeks';
  raise notice 'Ahora: importa un BIS PEOR en un seguimiento sin medición y genera su diagnóstico.';
end $$;

commit;

-- ── DESPUÉS DE CORRER ESTO ───────────────────────────────────────────────────────────────────────
--
-- 1. En Atlas, entra a un seguimiento de ese paciente que NO tenga medición e importa un BIS con valores
--    PEORES que los de la medición vieja (más grasa, menos masa magra, ángulo de fase más bajo).
-- 2. Entra a la pestaña Diagnóstico: el diagnóstico se genera solo y ahí se sella la banda.
-- 3. Comprueba con la consulta 1 de `revision-freno-y-graficas.sql` que `banda` diga `empeoro`.
-- 4. Y entonces sí, el paso 8 del smoke: el bloque ámbar, el freno de la entrega, y que el plan y las
--    rutas SÍ se impriman.
