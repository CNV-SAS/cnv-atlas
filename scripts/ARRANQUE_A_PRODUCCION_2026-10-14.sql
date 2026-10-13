-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL ARRANQUE A PRODUCCION  ·  fecha de corte 2026-10-14 (Santiago, 2026-10-12)
--
-- ═══ QUE SE DECIDIO, Y POR QUE ESTA ES LA TERCERA OPCION ═══
--
-- Santiago planteo dos caminos para salir a produccion: (a) migrar todo a un Atlas nuevo, con lo clinico tal
-- cual y las ventas en cero, o (b) construir la arquitectura para borrar todo rastro de prueba. Se dimensiono
-- cada uno y se propuso una tercera, que es la que se adopto: FECHA DE CORTE.
--
-- Y SUS PROPIOS NUMEROS LA CIERRAN: 55 ventas, de las cuales 45 YA eran de prueba por derivacion, contra
-- 1.568 consentimientos, 5.847 filas de auditoria y 302 diagnosticos. La opcion (a) proponia reescribir la
-- parte legalmente sensible (historia clinica, consentimientos, cadena de auditoria) para limpiar DIEZ
-- ventas reales.
--
-- ═══ LO QUE ESTE SCRIPT HACE Y LO QUE NO ═══
--
-- HACE: dejar lo anterior al arranque CLASIFICADO como prueba, con su motivo y su rastro, para que las
-- cifras arranquen en cero y los pendientes dejen de pedir accion.
--
-- NO BORRA NADA. Es deliberado y es la arquitectura del sistema, no una comodidad: la pantalla de
-- liquidaciones dice en voz alta que dejo algo fuera, porque *"hacer desaparecer comisiones ya selladas
-- esconde que existen"*, y `clinical_audit_log` es append-only POR TRIGGER. Borrar pelearia con candados que
-- existen por razones que ya nos salvaron.
--
-- NO TOCA NADA CLINICO: ni una evaluacion, ni un diagnostico, ni un consentimiento, ni una fila de
-- auditoria. Es justo la parte que mas conviene no mover.
--
-- ═══ POR QUE ES UN SCRIPT Y NO ESCRITURAS A MANO EN SUPABASE ═══
--
-- Santiago propuso marcar desde Supabase. No asi, y por dos razones medidas:
--
--   1. UNA ESCRITURA DIRECTA NO SE SALTA LOS TRIGGERS (los de la 0217 escuchan la columna), pero SI se
--      salta el MOTIVO y el RASTRO: el CHECK exige motivo, y sin fila de auditoria la respuesta a "¿por
--      que esta venta no cuenta?" en seis meses seria "porque alguien la marco".
--   2. Y A MANO, FILA POR FILA, es como se olvida una. Aqui el criterio es uno y se aplica entero.
--
-- COMO SE ENSAYA ANTES (contra la base local, revierte al final):
--   pnpm db:probar scripts/ARRANQUE_A_PRODUCCION_2026-10-14.sql
--
-- COMO SE CORRE DE VERDAD: pegarlo en el SQL editor de Supabase de PRODUCCION, leyendo los `select` de
-- verificacion ANTES del `commit`.
--
-- ⚠ TRES COSAS QUE HAY QUE REVISAR ANTES DE CORRERLO, y estan marcadas con PARA_REVISAR:
--   · la FECHA de arranque (aqui 2026-10-14; Santiago dijo "14 o 15, depende de como avancemos");
--   · el CORREO del actor, que es quien queda como autor de las marcas;
--   · y la CONCILIACION FISICA del inventario, que NO se puede inventar: va en su propio bloque al final,
--     con las cifras que el cuente de verdad.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── (0) LOS PARAMETROS, en un solo sitio ─────────────────────────────────────────────────────────
--
-- PARA_REVISAR: la fecha y el correo.
--
-- LA FECHA ES EL PRIMER DIA QUE CUENTA. Todo lo OPERADO ANTES de este dia se marca como prueba; lo de ese
-- dia en adelante es operacion real. Se eligio frontera de dia y no de corte quincenal porque la plata de
-- Distribucion ya se netea por periodo y el corte del 01-15 se va a anular entero en el paso (3).
create temporary table _arranque(fecha date, correo text, motivo text) on commit drop;
insert into _arranque values (
  '2026-10-14',
  'gilurgi69@gmail.com',
  -- EL MISMO MOTIVO PARA TODAS, y es lo que pidio Santiago: un motivo generico que se pueda buscar despues.
  -- Cumple el minimo de diez caracteres del CHECK de la 0217.
  'Smoke anterior a produccion: operacion de prueba previa al arranque del 2026-10-14'
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
create temporary table _antes on commit drop as
select
  (select count(*) from transactions)                                            as ventas,
  (select count(*) from transactions where cuenta_como_de_prueba)                as ventas_de_prueba,
  (select count(*) from transactions t join _arranque a on true
    where coalesce(t.operated_at, t.created_at) < a.fecha::timestamptz
      and not t.cuenta_como_de_prueba)                                           as ventas_reales_antes_del_corte,
  (select count(*) from distribucion_statements where superseded_at is null)     as cuentas_distribucion_vivas,
  (select count(*) from patients where cuenta_como_de_prueba)                    as pacientes_de_prueba,
  (select count(*) from evaluations)                                             as consultas,
  (select count(*) from patient_consents)                                        as consentimientos,
  (select count(*) from clinical_audit_log)                                      as filas_de_auditoria;

select 'ANTES' as momento, * from _antes;

-- ── (2) LAS VENTAS ANTERIORES AL ARRANQUE SE MARCAN COMO PRUEBA ──────────────────────────────────
--
-- ESTE ES EL PASO QUE RESUELVE EL CASO QUE NUNCA SE PUDO OCULTAR: la venta de LUVIA a una paciente real.
-- Integrante real, paciente real, producto real. Textual de Santiago: *"nunca lo habiamos podido borrar ni
-- ocultar"*. La marca por venta de la 0217 es exactamente la familia que ese caso necesitaba, y aqui se
-- aplica sin nombrarla: cae por su fecha, como todas las demas.
--
-- SE MARCA POR FECHA DE OPERACION, no de creacion: una venta retroactiva registrada ayer sobre un hecho de
-- la semana pasada pertenece a la semana pasada, y es el mismo criterio con el que se arma cada corte.
--
-- SOLO LAS QUE TODAVIA CUENTAN (`not cuenta_como_de_prueba`): las 45 que ya son de prueba por su paciente,
-- su profesional o su producto no necesitan una marca mas, y ponersela haria creer que alguien decidio algo
-- sobre ellas. La derivacion ya respondio.
--
-- LA COLUMNA DERIVADA NO SE TOCA AQUI: la escribe el trigger de la 0217 al ver `marcada_como_prueba_at`.
update transactions t
   set marcada_como_prueba_at = now(),
       marcada_como_prueba_por = (select p.id from profiles p join _arranque a on true
                                   where lower(p.email) = lower(a.correo)),
       marcada_como_prueba_motivo = (select motivo from _arranque)
  from _arranque a
 where coalesce(t.operated_at, t.created_at) < a.fecha::timestamptz
   and not t.cuenta_como_de_prueba
   and t.marcada_como_prueba_at is null;

-- ── (2b) Y CADA UNA DEJA SU RASTRO ───────────────────────────────────────────────────────────────
--
-- UNA FILA POR VENTA, no una por el lote, y es la diferencia que importa: el rastro se consulta por la
-- entidad (`entity_id`), asi que un unico registro del lote seria invisible desde la venta, que es donde
-- alguien va a preguntar. Son unas decenas de filas.
--
-- `clinical_audit_log` es append-only POR TRIGGER: insertar esta permitido (describe algo que paso), y es
-- editar o borrar lo que la base prohibe. O sea que esto no desarma ningun candado.
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
   );

-- ── (3) LAS CUENTAS DE DISTRIBUCION DE LOS CORTES DE PRUEBA SE ANULAN ────────────────────────────
--
-- POR QUE HACEN FALTA ANULARLAS Y NO BASTA MARCAR LAS VENTAS: una cuenta emitida es un documento con el que
-- CNV le COBRA a una persona. Marcar sus ventas la deja en cero pero la cuenta sigue viva, visible y
-- esperando pago, y el Integrante la seguiria viendo en su pantalla.
--
-- LA ANULACION ES LA PIEZA QUE LA 0215 ABRIO: antes no habia ninguna forma de retirar una cuenta emitida.
-- Sus ventas vuelven al pozo sin facturar, que es lo correcto: si la venta era real, alguien tendra que
-- facturarla; si era de prueba, su marca la saca de las cifras.
--
-- UNA PAGADA NO SE ANULA (lo impide el trigger de la 0215): la plata ya se movio. Si hubiera alguna, el
-- `select` de verificacion de abajo la muestra y hay que decidirla a mano, con contabilidad.
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
       jsonb_build_object('motivo', a.motivo, 'ventasLiberadas', 0, 'arranque', a.fecha::text)
  from distribucion_statements s
  join _arranque a on true
 where s.superseded_reason = 'anulada'
   and not exists (
     select 1 from clinical_audit_log l
      where l.entity_type = 'distribucion_statements' and l.entity_id = s.id::text
        and l.event = 'distribucion.cuenta_anulada'
   );

-- ── (4) LA FECHA DE ARRANQUE, QUE RECORTA LAS CIFRAS DE RESUMEN ──────────────────────────────────
--
-- YA EXISTE desde la 0198 y hace exactamente lo que esta opcion necesita: recorta el bruto, el ingreso de
-- CNV, las comisiones del periodo y los insights, y NO recorta lo que se le DEBE a alguien ni el inventario
-- (un saldo no es un flujo). Las dos reglas tienen candado.
--
-- SE PONE IGUAL que las marcas, aunque parezca redundante: la marca saca cada venta de las cifras una por
-- una, y la fecha es lo que responde "¿desde cuando cuenta la operacion?" sin depender de que ninguna marca
-- se haya olvidado. Son dos defensas de la misma pregunta, y la segunda no cuesta nada.
update commercial_config c
   set fecha_de_arranque = (select fecha from _arranque);

-- ── (5) VERIFICACION: QUE QUEDO, Y QUE SIGUE PIDIENDO ACCION ─────────────────────────────────────
select 'DESPUES' as momento,
  (select count(*) from transactions)                                        as ventas,
  (select count(*) from transactions where cuenta_como_de_prueba)            as ventas_de_prueba,
  (select count(*) from transactions t join _arranque a on true
    where coalesce(t.operated_at, t.created_at) < a.fecha::timestamptz
      and not t.cuenta_como_de_prueba)                                       as ventas_reales_antes_del_corte,
  (select count(*) from distribucion_statements where superseded_at is null) as cuentas_distribucion_vivas,
  (select count(*) from distribucion_statements
    where superseded_at is null and paid_at is not null)                      as cuentas_pagadas_que_quedan,
  -- LO CLINICO TIENE QUE DAR EXACTAMENTE LO MISMO QUE ANTES. Si alguna de estas tres se movio, este script
  -- hizo algo que no debia y hay que revertir.
  (select count(*) from evaluations)                                         as consultas,
  (select count(*) from patient_consents)                                    as consentimientos,
  (select count(*) from clinical_audit_log l
    where l.event not in ('venta.marcada_de_prueba', 'distribucion.cuenta_anulada'))
                                                                             as auditoria_sin_contar_este_script;

-- ── (5b) LO QUE VA A SEGUIR PIDIENDO ACCION, Y POR QUE ───────────────────────────────────────────
--
-- LA MARCA DE PRUEBA SI ALCANZA A LOS AVISOS: el lector de pendientes filtra por `cuenta_como_de_prueba`,
-- asi que las ventas marcadas dejan de aparecerle a admin. Verificado en `avisos-repository.ts`.
--
-- CON UNA EXCEPCION DELIBERADA: la rama "cobrada sin saldo" mira el PRODUCTO, no la marca, porque habla de
-- UNIDADES FISICAS y las unidades no entienden de marcas. Si el producto era real, la vitrina esta
-- descuadrada DE VERDAD, y esconderlo esconderia un problema fisico.
--
-- ASI QUE ESTAS FILAS SON EL TRABAJO QUE QUEDA, y su remedio es el bloque (6): cuadrar cada ubicacion con un
-- ajuste por conteo. Mientras no se haga, se pueden descartar desde "Pendientes sin salida", con su motivo.
-- SOLO LAS QUE MARCO ESTE SCRIPT, por su motivo. Listar todas las ventas de prueba de la historia (que en
-- una base con años de pruebas son miles) mezclaria lo que este arranque dejo pendiente con lo que ya
-- estaba, y ademas convierte este `select` en un barrido de la tabla de movimientos: en el ensayo contra la
-- base local, con 20.030 transacciones, se llevaba el script entero por delante.
select 'SIGUEN PIDIENDO ACCION (cobrada sin saldo)' as que,
       t.id as venta,
       (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date as dia,
       coalesce(l.name, 'sin ubicacion') as ubicacion,
       (select string_agg(n.name || ' x' || ti.quantity, ', ')
          from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
         where ti.transaction_id = t.id) as productos
  from transactions t
  join _arranque a on t.marcada_como_prueba_motivo = a.motivo
  left join inventory_locations l on l.id = t.location_id
 where exists (
     select 1 from transaction_items ti
       join nutraceutical_stock_movements m on m.transaction_item_id = ti.id
      where ti.transaction_id = t.id
   )
 order by dia;

-- ── (6) EL INVENTARIO FISICO: NO SE PUEDE INVENTAR ──────────────────────────────────────────────
--
-- PARA_REVISAR, y es el unico paso que este script NO puede hacer solo.
--
-- POR QUE: marcar una venta como prueba NO devuelve la unidad al estante, y es a proposito. Los movimientos
-- de inventario son inmutables porque describen algo que PASO: la unidad salio de verdad, aunque el acto
-- fuera una prueba. Un script que "devolviera" las unidades estaria afirmando que nunca salieron.
--
-- LO CORRECTO es un movimiento de `conciliacion` por ubicacion, con su motivo, igual al que se registra tras
-- un conteo fisico: el saldo del sistema se ajusta a lo que hay DE VERDAD en la vitrina. Esa cifra la tiene
-- que contar una persona, y ninguna consulta la puede adivinar.
--
-- EL SALDO DE HOY, para que Santiago lo coteje contra lo que cuente:
select 'SALDO DE HOY, PARA COTEJAR CONTRA EL CONTEO FISICO' as que,
       l.name as ubicacion, n.name as producto, lt.code as lote, i.stock_quantity as sistema
  from nutraceutical_inventory i
  join inventory_locations l on l.id = i.location_id
  join nutraceuticals n on n.id = i.nutraceutical_id
  join lots lt on lt.id = i.lot_id
 where i.stock_quantity <> 0
 order by l.name, n.name, lt.code;
--
-- Y CUANDO TENGA LAS CIFRAS, un movimiento por diferencia (una linea por cada una, con su delta con signo):
--
--   insert into nutraceutical_stock_movements
--     (professional_id, nutraceutical_id, location_id, lot_id, type, delta, reason)
--   values (<profesional de la ubicacion>, <producto>, <ubicacion>, <lote>, 'conciliacion', <+/- diferencia>,
--           'Arranque a produccion 2026-10-14: ajuste al conteo fisico');
--
-- SE DEJA COMENTADO Y NO SE GENERA SOLO: un ajuste de inventario con una cifra que nadie conto es
-- exactamente la clase de numero del que despues nadie sabe de donde salio.

-- ⚠ LEER LOS `select` DE ARRIBA ANTES DE CONFIRMAR.
-- rollback;
commit;
