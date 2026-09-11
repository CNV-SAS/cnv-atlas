-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- PURGA DE LOS DATOS COMERCIALES DE PRUEBA  ·  Bloque 0  ·  2026-09-11
--
-- QUE HACE: deja en cero las ventas, el inventario y todo lo que cuelga de ellos, CONSERVANDO INTACTA
-- la historia clinica. Los 23 registros de transacciones, las 5 recepciones, las 4 entregas y los 11
-- checkouts que hay en la base NO son operacion real: son datos de desarrollo. La operacion real arranca
-- despues de correr esto.
--
-- ── COMO SE CORRE ────────────────────────────────────────────────────────────────────────────────
--
-- SE EJECUTA ENTERO, DE UNA SOLA VEZ, INCLUIDO EL `commit` FINAL.
-- El SQL Editor de Supabase NO sostiene una transaccion entre ejecuciones: partirlo la pierde en
-- silencio (paso el 2026-09-09 con la limpieza de Demo; el `commit` suelto respondio "success" y no
-- habia nada que confirmar).
--
-- TODO VA EN UNA SOLA TRANSACCION, y no es cosmetico: hace falta desactivar dos triggers de
-- inmutabilidad, y como el DDL en Postgres es transaccional, un fallo a mitad los devuelve solos. Sin la
-- transaccion, una sesion que se caiga entre el DISABLE y el ENABLE deja la base sin esas garantias y
-- nadie se entera.
--
-- ES IDEMPOTENTE: correrlo dos veces es seguro. Los borrados van sobre tablas enteras, asi que en la
-- segunda vuelta no hay nada que borrar; los disable/enable de trigger tambien son idempotentes, y si una
-- vuelta anterior quedo a medias sin restaurarlos, esta los restaura.
--
-- ── ORDEN RESPECTO DE LA MIGRACION 0118 ──────────────────────────────────────────────────────────
--
-- ESTE SCRIPT VA PRIMERO. La migracion `0118_vinculo_entrega_paciente` añade un CHECK que exige
-- `treatment_id` en las entregas, y un CHECK se valida contra las filas que YA ESTAN: con las cuatro
-- entregas de prueba (que lo tienen nulo) todavia en la tabla, la migracion fallaria.
--
--   1. Correr este script.   2. Aplicar la migracion 0118.   3. Cargar el inventario inicial.
--
-- ── LO QUE ESTO NO TOCA ──────────────────────────────────────────────────────────────────────────
--
-- ALEGRA. En Alegra produccion hay facturas REALES emitidas a mano (ventas en firme a dos Integrantes y
-- sus notas credito). Esta purga es solo de Atlas y no las toca. El inventario inicial del Bloque 1 tiene
-- que partir de que esas unidades YA SALIERON.
--
-- EL CATALOGO (`nutraceuticals`, 10 productos). Es contenido, no operacion.
--
-- LA HISTORIA CLINICA. Nueve tablas tienen que salir con el MISMO conteo antes y despues, y el bloque de
-- verificacion aborta si alguna cambiaria.
--
-- ESTO NO DEJA RASTRO EN clinical_audit_log. Borrar por la app si lo dejaria. Es aceptable en datos de
-- prueba y NO lo seria en datos reales: ahi el borrado se hace por los caminos de la aplicacion.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── CONTEO ANTES ─────────────────────────────────────────────────────────────────────────────────
-- Se guarda en una tabla temporal, no solo se imprime: el bloque de verificacion de mas abajo lo compara
-- contra el estado posterior al borrado. Un conteo que solo se mira a ojo no verifica nada.
drop table if exists purga_antes;
create temp table purga_antes on commit drop as
select
  -- Comerciales: tienen que quedar en cero.
  (select count(*) from transactions)                          as transacciones,
  (select count(*) from transaction_items)                     as items_de_transaccion,
  (select count(*) from professional_revenue)                  as comisiones,
  (select count(*) from cnv_revenue)                           as ingreso_cnv,
  (select count(*) from payment_webhook_events)                as eventos_pasarela,
  (select count(*) from nutraceutical_stock_movements)         as movimientos,
  (select count(*) from nutraceutical_inventory)               as saldos,
  (select count(*) from nutraceutical_count_sessions)          as sesiones_conteo,
  (select count(*) from nutraceutical_count_lines)             as lineas_conteo,
  (select count(*) from nutraceutical_faltante_cases)          as casos_faltante,
  (select count(*) from nutraceutical_faltante_transitions)    as transiciones_faltante,
  -- CLINICAS: tienen que salir IDENTICAS. Son la razon por la que este script lleva verificacion.
  (select count(*) from patients)                              as c_pacientes,
  (select count(*) from evaluations)                           as c_evaluaciones,
  (select count(*) from diagnoses)                             as c_diagnosticos,
  (select count(*) from treatments)                            as c_tratamientos,
  (select count(*) from reports)                               as c_reportes,
  (select count(*) from survey_responses)                      as c_respuestas_encuesta,
  (select count(*) from survey_answers)                        as c_items_encuesta,
  (select count(*) from prescription_emissions)                as c_emisiones,
  -- `nutraceutical_usage` PARECE comercial por el nombre y NO LO ES: guarda lo que el tratamiento
  -- PRESCRIBIO (producto y cantidad por tratamiento). Es dato clinico y no se toca. Hoy tiene 0 filas;
  -- el guard existe igual, porque un cero de hoy no es un cero de siempre.
  (select count(*) from nutraceutical_usage)                   as c_prescripcion_nutraceuticos,
  -- El catalogo tampoco se toca: es contenido.
  (select count(*) from nutraceuticals)                        as c_catalogo;

-- NO SE IMPRIME AQUI, y es deliberado: el SQL Editor de Supabase muestra SOLO EL ULTIMO resultado de la
-- ejecucion, asi que un `select` del ANTES en este punto se pierde y Santiago solo veria el DESPUES. Y el
-- ANTES es la mitad del acta. Va todo junto en la fila final, en pares antes/despues.

-- ── DESACTIVAR LOS DOS TRIGGERS DE INMUTABILIDAD ─────────────────────────────────────────────────
--
-- Los movimientos de inventario y las transiciones de faltante son APPEND-ONLY por trigger (`BEFORE
-- UPDATE OR DELETE`): un error se corrige con un movimiento inverso, no se edita ni se borra. Esa
-- garantia es correcta y es justo la que impide esta purga, asi que se levanta aqui dentro y se devuelve
-- unas lineas mas abajo. Si algo falla en medio, el rollback las devuelve solo.
alter table nutraceutical_stock_movements      disable trigger nutra_movement_append_only_trg;
alter table nutraceutical_faltante_transitions disable trigger nutra_faltante_transition_append_only_trg;

-- ── EL BORRADO, EN ORDEN DE DEPENDENCIA ──────────────────────────────────────────────────────────
--
-- De las hojas al tronco. Las que tienen `on delete cascade` se borran igual de forma explicita: un
-- cascade que cambie de definicion mañana no deberia cambiar lo que este script hace.

-- 1. Faltantes: primero las transiciones (fuente de verdad), luego los casos (su proyeccion).
delete from nutraceutical_faltante_transitions;
delete from nutraceutical_faltante_cases;

-- 2. Movimientos ANTES que las lineas de conteo: `nutraceutical_stock_movements.count_line_id` apunta a
--    ellas, y `remesa_id` apunta a la propia tabla. El borrado de la tabla entera en UNA sentencia
--    resuelve la auto-referencia (la restriccion es NO ACTION, que se valida al final de la sentencia).
delete from nutraceutical_stock_movements;

-- 3. Conteos: lineas y luego sesiones.
delete from nutraceutical_count_lines;
delete from nutraceutical_count_sessions;

-- 4. El saldo. Es una PROYECCION de los movimientos, asi que sin ellos no significa nada.
delete from nutraceutical_inventory;

-- 5. Dinero: reparto, items y transacciones.
delete from professional_revenue;
delete from cnv_revenue;
delete from transaction_items;
delete from transactions;

-- 6. Eventos de la pasarela (sandbox).
delete from payment_webhook_events;

-- ── VERIFICACION QUE ABORTA ──────────────────────────────────────────────────────────────────────
--
-- Dos preguntas distintas, y las dos tienen que pasar:
--   a) ¿Quedo en cero lo comercial?          -> si no, el borrado no hizo lo que dice.
--   b) ¿Sigue intacto lo clinico?            -> si no, se borro algo que no se debia, y se aborta.
--
-- La (b) es la que justifica el script entero. Un `delete` mal escrito, un cascade inesperado o una
-- tabla mal clasificada se ven AQUI y no dentro de tres semanas.
do $$
declare
  a purga_antes%rowtype;
  d record;
  faltan text := '';
begin
  select * into a from purga_antes;

  select
    (select count(*) from transactions)                       as transacciones,
    (select count(*) from transaction_items)                  as items_de_transaccion,
    (select count(*) from professional_revenue)               as comisiones,
    (select count(*) from cnv_revenue)                        as ingreso_cnv,
    (select count(*) from payment_webhook_events)             as eventos_pasarela,
    (select count(*) from nutraceutical_stock_movements)      as movimientos,
    (select count(*) from nutraceutical_inventory)            as saldos,
    (select count(*) from nutraceutical_count_sessions)       as sesiones_conteo,
    (select count(*) from nutraceutical_count_lines)          as lineas_conteo,
    (select count(*) from nutraceutical_faltante_cases)       as casos_faltante,
    (select count(*) from nutraceutical_faltante_transitions) as transiciones_faltante,
    (select count(*) from patients)                           as c_pacientes,
    (select count(*) from evaluations)                        as c_evaluaciones,
    (select count(*) from diagnoses)                          as c_diagnosticos,
    (select count(*) from treatments)                         as c_tratamientos,
    (select count(*) from reports)                            as c_reportes,
    (select count(*) from survey_responses)                   as c_respuestas_encuesta,
    (select count(*) from survey_answers)                     as c_items_encuesta,
    (select count(*) from prescription_emissions)             as c_emisiones,
    (select count(*) from nutraceutical_usage)                as c_prescripcion_nutraceuticos,
    (select count(*) from nutraceuticals)                     as c_catalogo
  into d;

  -- (a) Lo comercial, en cero.
  if d.transacciones <> 0 then faltan := faltan || 'transactions=' || d.transacciones || ' '; end if;
  if d.items_de_transaccion <> 0 then faltan := faltan || 'transaction_items=' || d.items_de_transaccion || ' '; end if;
  if d.comisiones <> 0 then faltan := faltan || 'professional_revenue=' || d.comisiones || ' '; end if;
  if d.ingreso_cnv <> 0 then faltan := faltan || 'cnv_revenue=' || d.ingreso_cnv || ' '; end if;
  if d.eventos_pasarela <> 0 then faltan := faltan || 'payment_webhook_events=' || d.eventos_pasarela || ' '; end if;
  if d.movimientos <> 0 then faltan := faltan || 'stock_movements=' || d.movimientos || ' '; end if;
  if d.saldos <> 0 then faltan := faltan || 'inventory=' || d.saldos || ' '; end if;
  if d.sesiones_conteo <> 0 then faltan := faltan || 'count_sessions=' || d.sesiones_conteo || ' '; end if;
  if d.lineas_conteo <> 0 then faltan := faltan || 'count_lines=' || d.lineas_conteo || ' '; end if;
  if d.casos_faltante <> 0 then faltan := faltan || 'faltante_cases=' || d.casos_faltante || ' '; end if;
  if d.transiciones_faltante <> 0 then faltan := faltan || 'faltante_transitions=' || d.transiciones_faltante || ' '; end if;

  if faltan <> '' then
    raise exception 'ABORTADO: quedaron datos comerciales sin borrar -> %', faltan;
  end if;

  -- (b) Lo clinico, intacto. Esta es la verificacion que importa.
  if d.c_pacientes <> a.c_pacientes then
    raise exception 'ABORTADO: `patients` paso de % a %. No se toca ni un paciente.', a.c_pacientes, d.c_pacientes;
  end if;
  if d.c_evaluaciones <> a.c_evaluaciones then
    raise exception 'ABORTADO: `evaluations` paso de % a %.', a.c_evaluaciones, d.c_evaluaciones;
  end if;
  if d.c_diagnosticos <> a.c_diagnosticos then
    raise exception 'ABORTADO: `diagnoses` paso de % a %.', a.c_diagnosticos, d.c_diagnosticos;
  end if;
  if d.c_tratamientos <> a.c_tratamientos then
    raise exception 'ABORTADO: `treatments` paso de % a %.', a.c_tratamientos, d.c_tratamientos;
  end if;
  if d.c_reportes <> a.c_reportes then
    raise exception 'ABORTADO: `reports` paso de % a %.', a.c_reportes, d.c_reportes;
  end if;
  if d.c_respuestas_encuesta <> a.c_respuestas_encuesta then
    raise exception 'ABORTADO: `survey_responses` paso de % a %.', a.c_respuestas_encuesta, d.c_respuestas_encuesta;
  end if;
  if d.c_items_encuesta <> a.c_items_encuesta then
    raise exception 'ABORTADO: `survey_answers` paso de % a %.', a.c_items_encuesta, d.c_items_encuesta;
  end if;
  if d.c_emisiones <> a.c_emisiones then
    raise exception 'ABORTADO: `prescription_emissions` paso de % a %.', a.c_emisiones, d.c_emisiones;
  end if;
  if d.c_prescripcion_nutraceuticos <> a.c_prescripcion_nutraceuticos then
    raise exception 'ABORTADO: `nutraceutical_usage` paso de % a %. Es lo PRESCRITO, no una venta.',
      a.c_prescripcion_nutraceuticos, d.c_prescripcion_nutraceuticos;
  end if;
  if d.c_catalogo <> a.c_catalogo then
    raise exception 'ABORTADO: el catalogo paso de % a % productos. Es contenido, no operacion.',
      a.c_catalogo, d.c_catalogo;
  end if;

  raise notice 'Purga comercial correcta: % transacciones y % movimientos borrados; % pacientes y % evaluaciones intactos.',
    a.transacciones, a.movimientos, d.c_pacientes, d.c_evaluaciones;
end $$;

-- ── DEVOLVER LOS TRIGGERS ────────────────────────────────────────────────────────────────────────
alter table nutraceutical_stock_movements      enable trigger nutra_movement_append_only_trg;
alter table nutraceutical_faltante_transitions enable trigger nutra_faltante_transition_append_only_trg;

-- ── LA FILA DEL ACTA: ANTES Y DESPUES JUNTOS ─────────────────────────────────────────────────────
--
-- UNA SOLA FILA, con las dos cifras de cada tabla. El SQL Editor de Supabase muestra solo el ULTIMO
-- resultado, asi que imprimir el ANTES arriba y el DESPUES abajo dejaria el acta a medias: se veria el
-- DESPUES y no contra que compararlo. El ANTES vive en `purga_antes` desde el principio de la
-- transaccion, asi que se lee de ahi.
--
-- LO QUE TIENE QUE SALIR: las comerciales con "N -> 0", las clinicas y el catalogo con "N -> N", y los
-- dos triggers en 'O' (activos).
--
-- ESTA ES LA FILA QUE VA AL ACTA, junto con la fecha y quien lo corrio.
select
  a.transacciones            || ' -> ' || (select count(*) from transactions)                       as transacciones,
  a.items_de_transaccion     || ' -> ' || (select count(*) from transaction_items)                  as items_de_transaccion,
  a.comisiones               || ' -> ' || (select count(*) from professional_revenue)               as comisiones,
  a.ingreso_cnv              || ' -> ' || (select count(*) from cnv_revenue)                        as ingreso_cnv,
  a.eventos_pasarela         || ' -> ' || (select count(*) from payment_webhook_events)             as eventos_pasarela,
  a.movimientos              || ' -> ' || (select count(*) from nutraceutical_stock_movements)      as movimientos,
  a.saldos                   || ' -> ' || (select count(*) from nutraceutical_inventory)            as saldos,
  a.sesiones_conteo          || ' -> ' || (select count(*) from nutraceutical_count_sessions)       as sesiones_conteo,
  a.lineas_conteo            || ' -> ' || (select count(*) from nutraceutical_count_lines)          as lineas_conteo,
  a.casos_faltante           || ' -> ' || (select count(*) from nutraceutical_faltante_cases)       as casos_faltante,
  a.transiciones_faltante    || ' -> ' || (select count(*) from nutraceutical_faltante_transitions) as transiciones_faltante,
  a.c_pacientes              || ' -> ' || (select count(*) from patients)                           as pacientes,
  a.c_evaluaciones           || ' -> ' || (select count(*) from evaluations)                        as evaluaciones,
  a.c_diagnosticos           || ' -> ' || (select count(*) from diagnoses)                          as diagnosticos,
  a.c_tratamientos           || ' -> ' || (select count(*) from treatments)                         as tratamientos,
  a.c_reportes               || ' -> ' || (select count(*) from reports)                            as reportes,
  a.c_respuestas_encuesta    || ' -> ' || (select count(*) from survey_responses)                   as respuestas_encuesta,
  a.c_items_encuesta         || ' -> ' || (select count(*) from survey_answers)                     as items_encuesta,
  a.c_emisiones              || ' -> ' || (select count(*) from prescription_emissions)             as emisiones,
  a.c_prescripcion_nutraceuticos || ' -> ' || (select count(*) from nutraceutical_usage)            as prescripcion_nutraceuticos,
  a.c_catalogo               || ' -> ' || (select count(*) from nutraceuticals)                     as catalogo,
  (select string_agg(t.tgname || '=' || t.tgenabled::text, ', ')
     from pg_trigger t
    where t.tgname in ('nutra_movement_append_only_trg', 'nutra_faltante_transition_append_only_trg'))
                                                                                                   as triggers,
  now()                                                                                            as corrido_el
from purga_antes a;

-- REVISA LA FILA DE ARRIBA ANTES DE CONFIRMAR.
-- Si cuadra:      commit;
-- Si no cuadra:   rollback;   (y los triggers vuelven solos)
commit;
