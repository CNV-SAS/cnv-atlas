-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- PREPARAR EL SMOKE DEL BLOQUE 3 (sesion 1)  ·  un producto de PRUEBA con dos lotes y 5 unidades
--
-- POR QUE UN PRODUCTO DE PRUEBA: el smoke corre en la base de produccion (dominio real, Wompi de prueba). Una
-- venta de prueba de un producto REAL descontaria la vitrina real de un Integrante con movimientos que son
-- inmutables. Con un producto propio de prueba, lo unico que se mueve es ese producto, y la purga de ventas
-- de prueba lo deshace entero.
--
-- DE DONDE SALE LA VENTA: de la ubicacion del profesional asignado al paciente, y si no tiene, de la bodega
-- central. El smoke usa al paciente de prueba 1000898321 SIN Integrante (decision de Santiago, 2026-09-13), asi
-- que las unidades se cargan en la CENTRAL. Si todavia tiene Integrante, este script ABORTA: primero va
-- `smoke-bloque3-desasignar-paciente.sql`. Con Integrante, el producto de prueba viviria en una vitrina real.
--
-- SE FACTURA EN SANDBOX contra el item "PRUEBA" (id 1, base 1.000 + IVA): por eso el precio es 1.190.
--
-- COMO SE CORRE:
--   ver docs/entregas/SMOKE_BLOQUE_3_SESION_1.md, paso 2. NO se pega en el editor de Supabase.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- El paciente de PRUEBA del smoke, ya escrito: no hay nada que editar.
create temp table smoke_param on commit drop as select '1000898321'::text as documento;

do $$
declare
  v_doc      text := (select documento from smoke_param);
  v_paciente uuid;
  v_prof     uuid;
  v_loc      uuid;
  v_loc_tipo text;
  v_org      uuid;
  v_prod     uuid := gen_random_uuid();
  v_lote_a   uuid := gen_random_uuid();
  v_lote_b   uuid := gen_random_uuid();
begin
  if v_doc !~ '^[0-9]+$' then
    raise exception 'ABORTADO: el documento del paciente de prueba no es valido.';
  end if;
  select id, organization_id into v_paciente, v_org from patients where document_number = v_doc and is_test;
  if v_paciente is null then
    raise exception 'ABORTADO: no hay un paciente DE PRUEBA con documento %. El smoke no se hace con pacientes reales.', v_doc;
  end if;
  if exists (select 1 from nutraceuticals where name = 'PRUEBA SMOKE BLOQUE 3') then
    raise exception 'ABORTADO: el producto de prueba ya existe. Si es de un smoke anterior, retiralo antes (smoke-bloque3-retirar.sql).';
  end if;

  -- La misma lectura que hace la aplicacion (`getProfessionalIdForPatient`: la primera relacion, sin orden).
  -- Si el paciente tuviera varias, la aplicacion podria elegir otra: se avisa en vez de adivinar.
  if exists (select 1 from patient_professional_relationships where patient_id = v_paciente) then
    raise exception 'ABORTADO: el paciente % todavia tiene Integrante asignado. Corre primero smoke-bloque3-desasignar-paciente.sql.', v_doc;
  end if;
  select professional_id into v_prof from patient_professional_relationships
   where patient_id = v_paciente limit 1;
  select id, kind into v_loc, v_loc_tipo from inventory_locations
   where is_active and ((v_prof is not null and professional_id = v_prof)) limit 1;
  if v_loc is null then
    select id, kind into v_loc, v_loc_tipo from inventory_locations where kind = 'central' and is_active limit 1;
    v_prof := null;
  end if;

  insert into nutraceuticals (id, organization_id, name, unit_price, is_test, ownership,
                              commercial_availability, alegra_item_id, alegra_env)
  values (v_prod, v_org, 'PRUEBA SMOKE BLOQUE 3', 1190, true, 'propio', 'en_consultorio', '1', 'sandbox');

  insert into lots (id, nutraceutical_id, code, expires_on) values
    (v_lote_a, v_prod, 'SMOKE-A', current_date + 90),
    (v_lote_b, v_prod, 'SMOKE-B', current_date + 180);

  insert into nutraceutical_stock_movements
    (professional_id, nutraceutical_id, location_id, lot_id, delta, type, reason) values
    (v_prof, v_prod, v_loc, v_lote_a, 2, 'recepcion', 'Smoke Bloque 3: producto de prueba'),
    (v_prof, v_prod, v_loc, v_lote_b, 3, 'recepcion', 'Smoke Bloque 3: producto de prueba');

  raise notice 'Producto de prueba creado: PRUEBA SMOKE BLOQUE 3 (id %)', v_prod;
  raise notice 'Ubicacion: % (%). %', v_loc, v_loc_tipo,
    case when v_loc_tipo = 'integrante' then 'OJO: el Integrante asignado al paciente vera el producto de prueba en su inventario durante el smoke.'
         else 'Bodega central: ningun Integrante lo ve en su inventario.' end;
  raise notice 'Lote SMOKE-A: 2 unidades (vence primero). Lote SMOKE-B: 3 unidades.';
end $$;

commit;
