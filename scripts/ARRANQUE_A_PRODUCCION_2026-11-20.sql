-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL ARRANQUE A PRODUCCION  ·  SEGUNDA PASADA, con la fecha real
--
-- ═══ POR QUE NO SE VUELVE A CORRER EL DEL 2026-10-15 (la pregunta F de Santiago) ═══
--
-- Correrlo otra vez tal cual seria PEOR que no correrlo, y por una sola linea: su paso (4) hace
-- `set fecha_de_arranque = '2026-10-15'`, o sea que volveria a dejar puesta la fecha del arranque que se
-- aplazo, que es justo el defecto que /direccion estaba reportando. Y sus otros dos pasos ya no tienen
-- nada que hacer, medido contra produccion el 2026-11-17:
--
--   · MARCAR LAS VENTAS ANTERIORES: su filtro es `not cuenta_como_de_prueba`, y de las **64 ventas de la
--     nube las 64 cuentan ya como de prueba** (45 por derivacion el 15 de octubre, 11 marcadas a mano por
--     Santiago, el resto por su paciente o su profesional). No quedan ventas reales que marcar.
--   · ANULAR LAS CUENTAS DE DISTRIBUCION: solo queda **una** cuenta (corte 2026-10-01 al 15) y esta
--     **PAGADA**, asi que el trigger de la 0215 prohibe anularla y el script la salta, correctamente. Ver
--     la seccion 4e del segundo smoke.
--
-- ASI QUE HACE FALTA UNO NUEVO, y es mucho mas pequeno que el primero: lo unico que de verdad tiene que
-- pasar el dia del arranque es FIJAR LA FECHA. Los otros dos pasos se quedan porque entre hoy y ese dia va
-- a haber un smoke, y un smoke deja ventas: si alguna queda sin marcar, este script la atrapa.
--
-- ═══ QUE HACE Y QUE NO ═══
--
-- HACE: dejar clasificado como prueba todo lo operado ANTES de la fecha real, anular las cuentas de
-- Distribucion de cortes anteriores que no esten pagadas, y fijar la fecha de arranque.
--
-- NO BORRA NADA. `clinical_audit_log` es append-only por trigger y los movimientos de inventario tambien:
-- borrar pelearia con candados que existen por razones que ya nos salvaron.
--
-- NO TOCA NADA CLINICO: ni una evaluacion, ni un diagnostico, ni un consentimiento. Lo verifica comparando
-- las cifras antes y despues.
--
-- NO TOCA EL INVENTARIO. Eso lo hace `CARGAR_EL_INVENTARIO_AL_ARRANQUE_2026-11-18.sql`, que va DESPUES de
-- este y es otra decision (ahi se declara el punto de partida de cada vitrina).
--
-- ═══ COMO SE CORRE ═══
--
--   1. PARA_REVISAR el bloque (0): la FECHA real y el correo del actor. La fecha viene en 2026-11-18, que
--      es la fecha limite; si el arranque es otro dia, se cambia AHI y en ningun otro sitio.
--   2. Pegarlo en el editor SQL de Supabase de PRODUCCION y correrlo TAL CUAL: termina en `rollback`, asi
--      que no guarda nada y muestra los cuadros de verificacion.
--   3. Leer los cuadros (1), (5) y (5c). Lo clinico tiene que dar EXACTAMENTE lo mismo antes y despues.
--   4. Solo entonces, cambiar `rollback` por `commit` y volver a correr.
--
-- ⚠ EL ORDEN DEL DIA DEL ARRANQUE ESTA EN `docs/SMOKE_COMERCIAL_FINAL.md`. Este script es un paso de esa
-- lista, no el arranque completo: las llaves de Wompi y de Alegra van despues.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── (0) LOS PARAMETROS, en un solo sitio ─────────────────────────────────────────────────────────
--
-- PARA_REVISAR: la fecha y el correo.
--
-- LA FECHA ES EL PRIMER DIA QUE CUENTA. Todo lo OPERADO ANTES de este dia se marca como prueba; lo de ese
-- dia en adelante es operacion real. Y desde el 2026-11-17 esa fecha decide una cosa mas: mientras no haya
-- una fecha de arranque de hoy o anterior, las pantallas de cifras dicen que todavia no se ha arrancado y
-- NO cuentan nada (ver `src/modules/payments/arranque.ts`). O sea que fijarla es el acto que ENCIENDE las
-- cifras, y ponerla en el futuro es legitimo: dice "arrancamos ese dia" sin mentir mientras llega.
create temporary table _arranque(fecha date, correo text, motivo text) on commit drop;
insert into _arranque values (
  '2026-11-18',
  'gilurgi69@gmail.com',
  -- EL MISMO MOTIVO PARA TODAS: un motivo generico que se pueda buscar despues. Cumple el minimo de diez
  -- caracteres del CHECK de la 0217.
  'Smoke anterior a produccion: operacion de prueba previa al arranque del 2026-11-18'
);

-- EL ACTOR TIENE QUE EXISTIR. Sin esto, un correo mal escrito dejaria `marcada_como_prueba_por` en nulo, el
-- CHECK de la 0217 abortaria el script entero y el mensaje no diria por que.
do $$
declare v_id uuid;
begin
  select p.id into v_id from profiles p join _arranque a on true where lower(p.email) = lower(a.correo);
  if v_id is null then
    raise exception 'No hay ningun perfil con ese correo. Revisa el parametro `correo` del bloque (0).';
  end if;
end $$;

-- ── (1) LO QUE HAY HOY, ANTES DE TOCAR NADA ──────────────────────────────────────────────────────
--
-- SE MIRA PRIMERO Y SE GUARDA, para poder comparar al final. Un script que solo dice "listo" no permite
-- saber si hizo lo que se esperaba.
select 'ANTES' as momento,
  (select fecha_de_arranque::text from commercial_config limit 1)              as fecha_de_arranque_actual,
  (select count(*) from transactions)                                          as ventas,
  (select count(*) from transactions where cuenta_como_de_prueba)              as ventas_de_prueba,
  (select count(*) from transactions t join _arranque a on true
    where coalesce(t.operated_at, t.created_at) < a.fecha::timestamptz
      and not t.cuenta_como_de_prueba)                                         as ventas_reales_antes_del_corte,
  (select count(*) from distribucion_statements where superseded_at is null)   as cuentas_distribucion_vivas,
  (select count(*) from evaluations)                                           as consultas,
  (select count(*) from patient_consents)                                      as consentimientos;

-- ── (2) LAS VENTAS ANTERIORES AL ARRANQUE SE MARCAN COMO PRUEBA ──────────────────────────────────
--
-- SE MARCA POR FECHA DE OPERACION, no de creacion: una venta retroactiva registrada ayer sobre un hecho de
-- la semana pasada pertenece a la semana pasada, y es el mismo criterio con el que se arma cada corte.
--
-- SOLO LAS QUE TODAVIA CUENTAN (`not cuenta_como_de_prueba`): las que ya son de prueba por su paciente, su
-- profesional o su producto no necesitan una marca mas, y ponersela haria creer que alguien decidio algo
-- sobre ellas. La derivacion ya respondio.
--
-- LA COLUMNA DERIVADA NO SE TOCA AQUI: la escribe el trigger de la 0217 al ver `marcada_como_prueba_at`.
--
-- AL 2026-11-17 ESTO MARCA CERO FILAS, y se deja igual: entre hoy y el arranque hay un smoke, y una venta
-- del smoke con paciente y profesional reales es exactamente el caso que la derivacion NO cubre.
update transactions t
   set marcada_como_prueba_at = now(),
       marcada_como_prueba_por = (select p.id from profiles p join _arranque a2 on true
                                   where lower(p.email) = lower(a2.correo)),
       marcada_como_prueba_motivo = (select motivo from _arranque)
  from _arranque a
 where coalesce(t.operated_at, t.created_at) < a.fecha::timestamptz
   and not t.cuenta_como_de_prueba;

-- ── (2b) Y CADA UNA DEJA SU RASTRO ───────────────────────────────────────────────────────────────
--
-- UNA FILA POR VENTA, no una por el lote: el rastro se consulta por la entidad (`entity_id`), asi que un
-- unico registro del lote seria invisible desde la venta, que es donde alguien va a preguntar.
insert into clinical_audit_log (event, entity_type, entity_id, actor_id, actor_email, payload)
select 'venta.marcada_de_prueba',
       'transaction',
       t.id::text,
       t.marcada_como_prueba_por,
       a.correo,
       jsonb_build_object('motivo', t.marcada_como_prueba_motivo, 'arranque', a.fecha::text)
  from transactions t
  join _arranque a on true
 where t.marcada_como_prueba_motivo = a.motivo
   and not exists (
     select 1 from clinical_audit_log l
      where l.entity_type = 'transaction' and l.entity_id = t.id::text
        and l.event = 'venta.marcada_de_prueba'
        and l.payload->>'arranque' = a.fecha::text
   );

-- ── (3) LAS CUENTAS DE DISTRIBUCION DE LOS CORTES DE PRUEBA SE ANULAN ────────────────────────────
--
-- Marcar sus ventas las deja en cero pero la cuenta sigue viva, visible y esperando pago, y el Integrante
-- la seguiria viendo en su pantalla. Sus ventas vuelven al pozo sin facturar, que es lo correcto.
--
-- UNA PAGADA NO SE ANULA (lo impide el trigger de la 0215): la plata ya se movio. Al 2026-11-17 la UNICA
-- cuenta que existe esta pagada, asi que esto no alcanza a ninguna y el `select` (5b) la muestra para que
-- se decida a mano, con contabilidad. Es de una cuenta de smoke (`Profesional demo 2`).
update transactions t
   set distribucion_statement_id = null
 where t.distribucion_statement_id in (
   select s.id from distribucion_statements s join _arranque a on true
    where s.superseded_at is null and s.paid_at is null and s.corte_hasta < a.fecha
 );

update distribucion_statements s
   set superseded_at = now(), superseded_reason = 'anulada'
  from _arranque a
 where s.superseded_at is null and s.paid_at is null and s.corte_hasta < a.fecha;

insert into clinical_audit_log (event, entity_type, entity_id, actor_id, actor_email, payload)
select 'distribucion.cuenta_anulada',
       'distribucion_statements',
       s.id::text,
       (select p.id from profiles p join _arranque a2 on true where lower(p.email) = lower(a2.correo)),
       a.correo,
       jsonb_build_object('motivo', a.motivo, 'arranque', a.fecha::text)
  from distribucion_statements s
  join _arranque a on true
 where s.superseded_reason = 'anulada'
   and not exists (
     select 1 from clinical_audit_log l
      where l.entity_type = 'distribucion_statements' and l.entity_id = s.id::text
        and l.event = 'distribucion.cuenta_anulada'
   );

-- ── (4) LA FECHA DE ARRANQUE: EL ACTO QUE ENCIENDE LAS CIFRAS ───────────────────────────────────
--
-- Recorta el bruto, el ingreso de CNV, las comisiones del periodo y los insights, y NO recorta lo que se le
-- DEBE a alguien ni el inventario (un saldo no es un flujo). Las dos reglas tienen candado.
--
-- Y DESDE EL 2026-11-17 ES ADEMAS LO QUE HACE QUE LAS PANTALLAS DEJEN DE DECIR "todavia no se ha arrancado".
-- `updated_at` se toca a proposito: la version anterior no lo hacia, asi que la fila decia que se habia
-- tocado por ultima vez el 11 de septiembre cuando la fecha se habia puesto el 15 de octubre.
update commercial_config c
   set fecha_de_arranque = (select fecha from _arranque),
       updated_at = now();

-- ── (5) VERIFICACION: QUE QUEDO ─────────────────────────────────────────────────────────────────
select 'DESPUES' as momento,
  (select fecha_de_arranque::text from commercial_config limit 1)              as fecha_de_arranque_actual,
  (select count(*) from transactions)                                          as ventas,
  (select count(*) from transactions where cuenta_como_de_prueba)              as ventas_de_prueba,
  -- ESTA TIENE QUE QUEDAR EN CERO. Si no, alguna venta anterior al corte sigue contando como real.
  (select count(*) from transactions t join _arranque a on true
    where coalesce(t.operated_at, t.created_at) < a.fecha::timestamptz
      and not t.cuenta_como_de_prueba)                                         as ventas_reales_antes_del_corte,
  (select count(*) from distribucion_statements where superseded_at is null)   as cuentas_distribucion_vivas,
  -- LO CLINICO TIENE QUE DAR EXACTAMENTE LO MISMO QUE ANTES. Si alguna de estas dos se movio, este script
  -- hizo algo que no debia y hay que revertir.
  (select count(*) from evaluations)                                           as consultas,
  (select count(*) from patient_consents)                                      as consentimientos;

-- ── (5b) LAS CUENTAS DE DISTRIBUCION QUE QUEDAN VIVAS, para decidirlas a mano ───────────────────
select 'CUENTAS QUE QUEDAN VIVAS' as que,
       s.id, s.corte_desde, s.corte_hasta, s.paid_at, s.paid_amount,
       p.full_name as integrante, pp.is_test as integrante_de_prueba
  from distribucion_statements s
  join professional_profiles pp on pp.id = s.professional_id
  join profiles p on p.id = pp.profile_id
 where s.superseded_at is null
 order by s.corte_hasta;

-- ── (5c) LAS VENTAS QUE ESTE SCRIPT MARCO, una por una ─────────────────────────────────────────
--
-- SOLO LAS QUE MARCO ESTA PASADA, por su motivo: listar todas las de prueba de la historia mezclaria lo que
-- este arranque dejo con lo que ya estaba. Sin datos del paciente, porque esta salida se pega en un chat.
select 'MARCADAS EN ESTA PASADA' as que,
       t.id as venta,
       (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date as dia,
       t.status, t.payment_method, t.amount,
       coalesce(l.name, 'sin ubicacion') as ubicacion,
       (select string_agg(n.name || ' x' || ti.quantity, ', ')
          from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
         where ti.transaction_id = t.id) as productos
  from transactions t
  join _arranque a on t.marcada_como_prueba_motivo = a.motivo
  left join inventory_locations l on l.id = t.location_id
 order by dia;

-- ⚠ POR DEFECTO NO GUARDA. Leer los cuadros de arriba y cambiar esta linea por `commit;` para aplicarlo.
rollback;
-- commit;
