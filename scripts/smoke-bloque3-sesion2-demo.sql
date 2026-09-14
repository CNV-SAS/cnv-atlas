-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- PREPARAR EL PASO 6 DEL SMOKE (venta en Tratamiento) CON "Profesional Demo"  ·  Bloque 3, sesion 2
--
-- LO QUE HACE, y es todo lo comercial:
--   · Elige el paciente DE PRUEBA de Profesional Demo (tiene que haber exactamente uno) y lo dice.
--   · Carga 3 unidades del producto de prueba (lote SMOKE-B) en la ubicacion de Profesional Demo. La venta
--     que haga el sale de SU ubicacion, no de la central, asi que sin esto no tendria nada que vender.
--   · Dice que le falta a la evaluacion de ese paciente para que aparezca la seccion de venta.
--
-- LO QUE NO HACE, a proposito: NO escribe diagnostico, tratamiento, prescripcion, emision ni decision. Son
-- registros clinicos: llevan su constelacion de versiones (regla dura 7) y su auditoria inline (regla 8), y
-- un script que los fabricara dejaria una historia clinica que nadie hizo. Eso se hace en la pantalla, como
-- profesional, con el paciente de prueba.
--
-- POR QUE NO EL 1000898321: ese paciente quedo SIN Integrante para que las ventas de `/pagos` del smoke salgan
-- de la central. Profesional Demo no lo puede abrir sin relacion (RLS), y volver a relacionarlo cambiaria de
-- donde salen las ventas de los pasos anteriores.
--
-- COMO SE CORRE: ver docs/entregas/SMOKE_BLOQUE_3_SESION_2.md, paso 6. NO se pega en el editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  v_perfiles  int;
  v_prof      uuid;
  v_profesion text;
  v_loc       uuid;
  v_pacientes int;
  v_paciente  uuid;
  v_doc       text;
  v_prod      uuid;
  v_precio    numeric;
  v_lote      uuid;
  r           record;
begin
  -- ── La cuenta ──
  select count(*) into v_perfiles from profiles where full_name = 'Profesional Demo';
  if v_perfiles <> 1 then
    raise exception 'ABORTADO: hay % cuentas llamadas "Profesional Demo". Tiene que haber exactamente una.', v_perfiles;
  end if;
  select pp.id, pp.profession into v_prof, v_profesion
    from profiles pr join professional_profiles pp on pp.profile_id = pr.id
   where pr.full_name = 'Profesional Demo';
  if v_prof is null then
    raise exception 'ABORTADO: "Profesional Demo" no tiene perfil profesional.';
  end if;
  select id into v_loc from inventory_locations where professional_id = v_prof and is_active limit 1;
  if v_loc is null then
    raise exception 'ABORTADO: "Profesional Demo" no tiene ubicacion de inventario activa. Su venta saldria de la central, y este paso no probaria lo que tiene que probar.';
  end if;

  -- ── El paciente de prueba ──
  select count(*) into v_pacientes
    from patient_professional_relationships ppr join patients p on p.id = ppr.patient_id
   where ppr.professional_id = v_prof and p.is_test;
  if v_pacientes <> 1 then
    raise exception 'ABORTADO: "Profesional Demo" tiene % pacientes DE PRUEBA. Tiene que haber exactamente uno para no adivinar.', v_pacientes;
  end if;
  select p.id, p.document_number into v_paciente, v_doc
    from patient_professional_relationships ppr join patients p on p.id = ppr.patient_id
   where ppr.professional_id = v_prof and p.is_test;

  -- ── El producto ──
  select id, unit_price into v_prod, v_precio from nutraceuticals where name = 'PRUEBA SMOKE BLOQUE 3' and is_test;
  if v_prod is null then
    raise exception 'ABORTADO: no existe el producto de prueba activo. Correr primero smoke-bloque3-preparar.sql.';
  end if;
  if v_precio < 1500 then
    raise exception 'ABORTADO: el producto de prueba vale %, por debajo del minimo de Wompi ($1.500). Correr primero smoke-bloque3-subir-precio.sql.', v_precio;
  end if;
  if exists (select 1 from nutraceutical_stock_movements where location_id = v_loc and nutraceutical_id = v_prod) then
    raise exception 'ABORTADO: la ubicacion de Profesional Demo ya tiene movimientos del producto de prueba: este script ya se corrio. No se carga dos veces.';
  end if;
  select id into v_lote from lots where nutraceutical_id = v_prod and code = 'SMOKE-B';
  if v_lote is null then
    raise exception 'ABORTADO: el producto de prueba no tiene el lote SMOKE-B.';
  end if;

  insert into nutraceutical_stock_movements
    (professional_id, nutraceutical_id, location_id, lot_id, delta, type, reason)
  values (v_prof, v_prod, v_loc, v_lote, 3, 'recepcion', 'Smoke Bloque 3, sesion 2: venta en Tratamiento');

  raise notice 'Profesional Demo (%): 3 unidades de PRUEBA SMOKE BLOQUE 3 (lote SMOKE-B) cargadas en su ubicacion.', v_profesion;
  raise notice 'Paciente de prueba: documento %.', v_doc;

  -- ── Lo que le falta a cada evaluacion de ese paciente ──
  for r in
    select e.id, e.status, e.created_at::date as fecha, t.id as treatment_id, t.nutraceutical_decision as decision,
           (select count(*) from prescription_emissions pe where pe.treatment_id = t.id) as emisiones,
           exists (select 1 from treatment_nutraceuticals tn where tn.treatment_id = t.id and tn.nutraceutical_id = v_prod) as prescrito
      from evaluations e
      left join diagnoses d on d.evaluation_id = e.id
      left join treatments t on t.diagnosis_id = d.id
     where e.patient_id = v_paciente and e.professional_id = v_prof
     order by e.created_at desc
  loop
    raise notice 'Evaluacion del % (%): %', r.fecha, r.status,
      case
        when r.treatment_id is null then 'SIN tratamiento: completa el diagnostico y el tratamiento en la pantalla.'
        else concat_ws(' ',
          case when r.prescrito then 'producto de prueba PRESCRITO;' else 'FALTA prescribir PRUEBA SMOKE BLOQUE 3;' end,
          case when r.emisiones > 0 then 'prescripcion ENTREGADA;' else 'FALTA entregar la prescripcion (imprimirla o enviarla);' end,
          case when r.decision = 'si' then 'decision SI.' else 'FALTA registrar que SI los adquiere.' end)
      end;
  end loop;
  if not found then
    raise notice 'Ese paciente no tiene evaluaciones de Profesional Demo: crea una en la pantalla.';
  end if;
end $$;

commit;
