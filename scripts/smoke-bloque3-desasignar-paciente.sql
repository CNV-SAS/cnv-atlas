-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- DEJAR AL PACIENTE DE PRUEBA 1000898321 SIN INTEGRANTE ASIGNADO  ·  preparacion del smoke del Bloque 3
--
-- POR QUE: una venta sale de la ubicacion del Integrante asignado al paciente. Con Integrante, el producto de
-- prueba del smoke viviria en la vitrina de un Integrante REAL: lo veria en su "Mi inventario", la venta de
-- prueba le sumaria comision hasta la purga, y como las recepciones no se borran, despues de la purga le
-- quedaria un producto fantasma con unidades. Sin Integrante, la venta sale de la bodega central de CNV.
--
-- DECISION DE SANTIAGO (2026-09-13): el 1000898321 queda sin asignar; el 1000898123 sigue siendo el paciente
-- de pruebas principal, con su Integrante.
--
-- QUE HACE: borra la(s) relacion(es) paciente-profesional de ESE paciente, y solo si esta marcado de prueba.
-- Consecuencia: el Integrante que lo tenia deja de ver su historia (el acceso sale de esta relacion). Es un
-- paciente de prueba; no hay nada clinico real que perder. No deja rastro en clinical_audit_log.
--
-- COMO SE CORRE: ver docs/entregas/SMOKE_BLOQUE_3_SESION_1.md, paso 1. NO se pega en el editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  v_paciente uuid;
  v_nombres  text;
  n          int;
begin
  select p.id into v_paciente from patients p where p.document_number = '1000898321' and p.is_test;
  if v_paciente is null then
    raise exception 'ABORTADO: no hay un paciente DE PRUEBA con documento 1000898321. Este script solo toca pacientes de prueba.';
  end if;

  select string_agg(coalesce(pr.full_name, ppr.professional_id::text), ', ') into v_nombres
    from patient_professional_relationships ppr
    left join professional_profiles pp on pp.id = ppr.professional_id
    left join profiles pr on pr.id = pp.profile_id
   where ppr.patient_id = v_paciente;

  delete from patient_professional_relationships where patient_id = v_paciente;
  get diagnostics n = row_count;

  if n = 0 then
    raise notice 'El paciente 1000898321 ya no tenia Integrante asignado: nada que hacer.';
  else
    raise notice 'Paciente 1000898321: se quito su relacion con % (% fila/s). Desde ahora sus ventas salen de la bodega central.', v_nombres, n;
  end if;
end $$;

commit;
