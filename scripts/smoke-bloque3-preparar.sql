-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- PREPARAR EL SMOKE DEL BLOQUE 3 (sesion 1)  ·  un producto de PRUEBA con dos lotes y 5 unidades
--
-- POR QUE UN PRODUCTO DE PRUEBA: el smoke corre en la base de produccion (dominio real, Wompi de prueba). Una
-- venta de prueba de un producto REAL descontaria la vitrina real de un Integrante con movimientos que son
-- inmutables. Con un producto propio de prueba, lo unico que se mueve es ese producto, y la purga de ventas
-- de prueba lo deshace entero.
--
-- DE DONDE SALE LA VENTA: igual que en la aplicacion, de la ubicacion del profesional ASIGNADO al paciente, y
-- si no tiene, de la bodega central. Este script calcula esa ubicacion con el documento del paciente de
-- prueba y carga ahi las unidades. Si el paciente tiene Integrante asignado, el producto de prueba se vera en
-- el "Mi inventario" de ese Integrante mientras dure el smoke: el NOTICE lo dice.
--
-- SE FACTURA EN SANDBOX contra el item "PRUEBA" (id 1, base 1.000 + IVA): por eso el precio es 1.190.
--
-- COMO SE CORRE:
--   node --env-file=<archivo con DATABASE_URL de la nube> scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql
--   ... y con --commit al final.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ══ EL UNICO VALOR QUE SE EDITA: el documento del paciente de PRUEBA con el que se hara el smoke ══
create temp table smoke_param on commit drop as select '<DOCUMENTO>'::text as documento;

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
    raise exception 'ABORTADO: falta el documento del paciente de prueba (<DOCUMENTO>).';
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
  if (select count(*) from patient_professional_relationships where patient_id = v_paciente) > 1 then
    raise exception 'ABORTADO: el paciente de prueba tiene varios profesionales asignados; usa uno con uno solo o ninguno.';
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
