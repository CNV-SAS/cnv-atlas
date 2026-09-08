-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LIMPIEZA DE LOS PACIENTES DE LA CUENTA DE PRUEBAS "Profesional Demo"
--
-- TODO VA EN UNA SOLA TRANSACCION, y no es cosmetico: hace falta desactivar dos triggers de
-- inmutabilidad, y como el DDL en Postgres es transaccional, un fallo a mitad los devuelve solos. Sin la
-- transaccion, una sesion que se caiga entre el DISABLE y el ENABLE deja la base sin esas garantias y
-- nadie se entera.
--
-- ESTO NO DEJA RASTRO EN clinical_audit_log. Borrar por la app si lo dejaria. Es aceptable en datos de
-- prueba y NO lo seria en datos reales: ahi el borrado se hace por los caminos de la aplicacion.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- El profesional de pruebas (professional_profiles.id en la NUBE).
create temp table demo_pro on commit drop as
  select '320e7829-d3a4-4a57-a84b-b1a17deef553'::uuid as pro;

-- ── QUE SE BORRA Y QUE NO ────────────────────────────────────────────────────────────────────────
--
-- DOS CAUTELAS EN ESTE CALCULO, las dos salidas del ensayo contra la base local y no de razonarlo:
--   · JOIN CON patients: en local habia 7754 filas de relacion apuntando a pacientes que ya no existen, y
--     sin el join inflaban el conjunto a borrar con ids fantasma. El join lo acota a lo que existe.
--   · count(DISTINCT professional_id): si un paciente tuviera el mismo profesional repetido, contar filas
--     lo haria parecer compartido y se salvaria de un borrado que si le toca.
--
-- Un paciente puede estar a cargo de MAS DE UN profesional. Borrarlo entero se lo quitaria al otro, asi
-- que se parte el conjunto en dos y cada mitad recibe un trato distinto:
--
--   · SOLO DE DEMO  -> se borra el paciente entero, con todo lo que cuelga.
--   · COMPARTIDO    -> el paciente SE QUEDA. Se le quitan solo las evaluaciones de Demo y el vinculo con
--                      Demo. Son los dos residuos del hueco del enlace publico (CC 0000000000 y el de
--                      agosto), y el paciente sigue siendo de Gildardo Uribe con su historia intacta.
create temp table pac_solo on commit drop as
  select r.patient_id
  from (
    select r.patient_id,
           count(distinct r.professional_id) as n,
           bool_or(r.professional_id = (select pro from demo_pro)) as tiene_demo
    from patient_professional_relationships r
    join patients p on p.id = r.patient_id
    group by r.patient_id
  ) r
  where r.tiene_demo and r.n = 1;

create temp table pac_compartido on commit drop as
  select r.patient_id
  from (
    select r.patient_id,
           count(distinct r.professional_id) as n,
           bool_or(r.professional_id = (select pro from demo_pro)) as tiene_demo
    from patient_professional_relationships r
    join patients p on p.id = r.patient_id
    group by r.patient_id
  ) r
  where r.tiene_demo and r.n > 1;

-- Las evaluaciones a borrar: TODAS las de los pacientes que solo son de Demo, y SOLO las de Demo en los
-- pacientes compartidos.
create temp table ev_borrar on commit drop as
  select id from evaluations where patient_id in (select patient_id from pac_solo)
  union
  select id from evaluations
   where patient_id in (select patient_id from pac_compartido)
     and professional_id = (select pro from demo_pro);

create temp table dx_borrar on commit drop as
  select id from diagnoses where evaluation_id in (select id from ev_borrar);

create temp table tx_borrar on commit drop as
  select id from treatments where diagnosis_id in (select id from dx_borrar);

-- ── CONTEO ANTES ─────────────────────────────────────────────────────────────────────────────────
select 'ANTES' as momento,
  (select count(*) from pac_solo)                                                        as pacientes_a_borrar,
  (select count(*) from pac_compartido)                                                  as pacientes_compartidos_que_se_quedan,
  (select count(*) from ev_borrar)                                                       as evaluaciones,
  (select count(*) from dx_borrar)                                                       as diagnosticos,
  (select count(*) from dx_borrar d join diagnoses g on g.id = d.id
    where g.confirmed_by is not null)                                                    as diagnosticos_confirmados,
  (select count(*) from tx_borrar)                                                       as tratamientos,
  (select count(*) from reports where evaluation_id in (select id from ev_borrar))       as reportes,
  (select count(*) from clinical_corrections
    where old_evaluation_id in (select id from ev_borrar)
       or new_evaluation_id in (select id from ev_borrar))                               as correcciones,
  (select count(*) from patients)                                                        as pacientes_totales_en_la_base;

-- ── EL ESCAPE ────────────────────────────────────────────────────────────────────────────────────
--
-- CINCO TRIGGERS BLOQUEAN EL BORRADO, y estan ahi por buenas razones. Salieron de listar TODOS los que
-- actuan sobre DELETE, no de suponerlos: la primera vez corte la salida con  y me perdi tres.
--   · reports_snapshot_immutable:              "reports es inmutable: no se permite DELETE". SIEMPRE.
--   · referrals_immutable_trg:                 "no se borra una remision (acto clinico)". SIEMPRE.
--   · clinical_corrections_append_only_trg:    "append-only: no se actualiza ni se borra". SIEMPRE.
--   · diagnoses_confirmation_immutability_trg: solo si el diagnostico esta CONFIRMADO.
--   · treatments_immutability_trg:             solo si el protocolo esta APROBADO.
--   · nutra_movement_append_only_trg:          NO por un DELETE, sino por un UPDATE: al borrar un
--     tratamiento, la FK de nutraceutical_stock_movements.treatment_id es SET NULL, y ese UPDATE choca
--     con el append-only del registro de custodia. Los movimientos de inventario SOBREVIVEN, solo pierden
--     el vinculo con el tratamiento borrado, que es lo que el esquema dice que pase.
--
-- EL RIESGO, dicho: mientras esten desactivados, esa garantia no rige PARA NADIE, ni para la aplicacion
-- ni para otra sesion que este escribiendo a la vez. Por eso se desactivan lo mas tarde posible, se
-- vuelven a activar en el mismo bloque, y todo va dentro de la transaccion: si algo falla o se hace
-- ROLLBACK, los triggers vuelven solos. Requiere ser dueño de la tabla (en Supabase, el SQL Editor lo es).
alter table reports              disable trigger reports_snapshot_immutable;
alter table referrals            disable trigger referrals_immutable_trg;
alter table clinical_corrections disable trigger clinical_corrections_append_only_trg;
alter table diagnoses            disable trigger diagnoses_confirmation_immutability_trg;
alter table treatments           disable trigger treatments_immutability_trg;
alter table nutraceutical_stock_movements disable trigger nutra_movement_append_only_trg;

-- ── BORRADO, DE ABAJO HACIA ARRIBA ───────────────────────────────────────────────────────────────
--
-- El orden sale del grafo real de claves foraneas, no de la intuicion. Lo que va explicito es lo que
-- tiene RESTRICT (o NO ACTION); lo que tiene CASCADE se va solo y no se lista:
--   patients   -> consents, contacts, relationships, profiles, survey_links  (CASCADE)
--   evaluations-> survey_responses (-> survey_answers), bis_measurements (-> raw/corrections),
--                 indicator_values, evaluation_notes, evaluation_bis_intake  (CASCADE)
--   treatments -> notes, approvals, diet_guidelines, nutraceuticals, usage, ai_menu_suggestions (CASCADE)

-- 1. referrals: RESTRICT desde patients Y desde treatments.
delete from referrals
 where patient_id in (select patient_id from pac_solo)
    or treatment_id in (select id from tx_borrar);

-- 2. treatments (RESTRICT desde diagnoses).
delete from treatments where id in (select id from tx_borrar);

-- 3. diagnoses (RESTRICT desde evaluations). Aqui actua el trigger desactivado.
delete from diagnoses where id in (select id from dx_borrar);

-- 4. clinical_corrections (RESTRICT desde evaluations, por sus DOS columnas).
delete from clinical_corrections
 where old_evaluation_id in (select id from ev_borrar)
    or new_evaluation_id in (select id from ev_borrar);

-- 5. reports (RESTRICT desde evaluations Y desde patients).
delete from reports
 where evaluation_id in (select id from ev_borrar)
    or patient_id in (select patient_id from pac_solo);

-- 6. hc_deliveries (RESTRICT desde patients; CASCADE desde evaluations, pero se hace explicito).
delete from hc_deliveries
 where evaluation_id in (select id from ev_borrar)
    or patient_id in (select patient_id from pac_solo);

-- 7. followups y 8. contraindicaciones y 9. permisos de acceso: RESTRICT / NO ACTION desde patients.
delete from followups                 where patient_id in (select patient_id from pac_solo);
delete from patient_contraindications where patient_id in (select patient_id from pac_solo);
delete from clinical_access_grants    where resource_id in (select patient_id from pac_solo);

-- 10. evaluaciones (RESTRICT desde patients).
delete from evaluations where id in (select id from ev_borrar);

-- 11. EL VINCULO DE DEMO en los compartidos. El paciente NO se toca: sigue siendo del otro profesional.
delete from patient_professional_relationships
 where professional_id = (select pro from demo_pro)
   and patient_id in (select patient_id from pac_compartido);

-- 12. Y los pacientes que solo eran de Demo. Aqui caen en cascada consentimientos, contactos, perfil,
--     vinculos y sus enlaces de encuesta. `transactions.patient_id` queda en NULL (SET NULL): los pagos
--     de prueba sobreviven sin paciente, que en datos de prueba da igual y en reales no daria.
delete from patients where id in (select patient_id from pac_solo);

-- ── SE VUELVEN A ACTIVAR. No opcional. ───────────────────────────────────────────────────────────
alter table reports              enable trigger reports_snapshot_immutable;
alter table referrals            enable trigger referrals_immutable_trg;
alter table clinical_corrections enable trigger clinical_corrections_append_only_trg;
alter table diagnoses            enable trigger diagnoses_confirmation_immutability_trg;
alter table treatments           enable trigger treatments_immutability_trg;
alter table nutraceutical_stock_movements enable trigger nutra_movement_append_only_trg;

-- ── CONTEO DESPUES ───────────────────────────────────────────────────────────────────────────────
-- Lo que tiene que salir: cero en las tres primeras, los compartidos INTACTOS con su otro profesional, y
-- los dos triggers en 'O' (activos).
select 'DESPUES' as momento,
  (select count(*) from patients p
    where exists (select 1 from patient_professional_relationships r
                   where r.patient_id = p.id and r.professional_id = (select pro from demo_pro)))  as pacientes_de_demo,
  (select count(*) from evaluations where professional_id = (select pro from demo_pro))            as evaluaciones_de_demo,
  (select count(*) from patient_professional_relationships r
     join patients p on p.id = r.patient_id
    where r.professional_id = (select pro from demo_pro))                                          as vinculos_de_demo,
  (select count(*) from patients where id in (select patient_id from pac_compartido))              as compartidos_que_siguen_vivos,
  (select count(*) from patients)                                                                  as pacientes_totales_en_la_base,
  (select string_agg(t.tgname || '=' || t.tgenabled::text, ', ')
     from pg_trigger t
    where t.tgname in ('reports_snapshot_immutable','referrals_immutable_trg','clinical_corrections_append_only_trg','diagnoses_confirmation_immutability_trg','treatments_immutability_trg','nutra_movement_append_only_trg'))
                                                                                                   as triggers;

-- REVISA EL CONTEO DE ARRIBA ANTES DE CONFIRMAR.
-- Si cuadra:      commit;
-- Si no cuadra:   rollback;   (y los triggers vuelven solos)
commit;
