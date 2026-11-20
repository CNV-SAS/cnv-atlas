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
-- ASI QUE HACE FALTA UNO NUEVO, y es mucho mas pequeno que el primero. Los otros dos pasos se quedan
-- porque entre hoy y ese dia va a haber un smoke, y un smoke deja ventas: si alguna queda sin marcar, este
-- script la atrapa.
--
-- ═══ Y SON DOS FECHAS, NO UNA (Santiago, 2026-11-18) ═══
--
-- La version anterior de este script usaba UNA sola fecha para dos cosas distintas, y Santiago lo vio
-- antes de que mordiera:
--
--   · EL CORTE DE PRUEBAS = el dia del arranque (2026-11-20). Todo lo registrado ANTES es de prueba.
--   · EL INICIO DE LA OPERACION PARA LAS CIFRAS = 2026-08-08, la PRIMERA VENTA REAL (la hizo CNV, la
--     vendio Gildardo, sin comision y con descuento al paciente). La primera venta de un Integrante fue
--     de Angela, el 2026-09-03; manda la del 8 de agosto.
--
-- POR QUE NO PUEDEN SER LA MISMA: las ventas atrasadas que entran por el xlsx antes del 30 de noviembre
-- tienen fechas de AGOSTO A NOVIEMBRE, anteriores al arranque. Si la ventana de las cifras empezara el 20,
-- esas ventas NO CONTARIAN NINGUNA, y la proporcion entre lo prescrito y lo comprado que mira Direccion
-- saldria falsa por el lado que mas importa.
--
-- POR QUE NO HACE FALTA UNA COLUMNA NUEVA: porque el corte de pruebas NUNCA se expreso con esta fecha. Se
-- expresa con `cuenta_como_de_prueba` (0203 y 0217), que los lectores de cifras ya miran por separado
-- (`esOperacion` en `dashboard-reader`). O sea que los dos mecanismos ya estaban separados en el sistema; lo
-- que estaba confundido era el NOMBRE. `commercial_config.fecha_de_arranque` es, y siempre fue, "desde
-- cuando cuentan las cifras".
--
-- ═══ EL CRITERIO PARA MARCAR NO ES LA FECHA, ES EL AMBIENTE (Santiago, 2026-11-20) ═══
--
-- EL HUECO QUE LO OBLIGA: el smoke y el arranque son el MISMO dia. Toda venta que un profesional REAL
-- registre hoy ANTES de cambiar las llaves nace con `wompi_env = 'test'`, porque el ambiente se deduce de
-- la llave publica que tenga el sistema en ese momento (`wompiEnvDeLaLlave`: si no empieza por `pub_prod_`,
-- es test). Esa venta NUNCA SE PODRA FACTURAR (el candado de `ambiente.ts` exige que el pago y la factura
-- sean del mismo mundo) y aun asi contaria como REAL en las cifras de Direccion y en las comisiones del
-- Integrante. Con el criterio viejo el script no la atrapaba, porque es del dia 20 y el corte era el 20.
--
-- ASI QUE EL FILTRO PASA A SER: `wompi_env = 'test' and not cuenta_como_de_prueba`. SIN FECHA.
--
-- SE EVALUARON LAS DOS OPCIONES. La otra era poner el corte en `now()`, el momento de ejecucion. Se
-- descarto, y hay TRES razones, en orden de peso:
--
--   1. ESTE SCRIPT AHORA SE CORRE DOS VECES (antes de las llaves y despues del redespliegue), y con `now()`
--      la segunda pasada marcaria como prueba una venta REAL hecha justo despues del redespliegue. El
--      criterio tiene que poder correrse de nuevo sin morder lo bueno. Con el ambiente no puede: una venta
--      posterior al cambio de llaves nace `produccion` y este filtro no la ve.
--
--   2. LA FECHA SE VUELVE UNA TRAMPA EN CUANTO ENTRE EL XLSX. Las ventas atrasadas se registran con su
--      `operated_at` HISTORICO (agosto a noviembre), o sea ANTERIOR al corte, y son REALES. Si alguien
--      vuelve a correr este script despues de cargarlas, y esta escrito para volverse a correr, el criterio
--      de fecha marcaria las 175 como de prueba de un golpe. El del ambiente las deja en paz, porque nacen
--      con las llaves de produccion.
--
--   3. EL AMBIENTE SIGUE AL HECHO, EL RELOJ NO. Un link creado en la ventana pero PAGADO despues del cambio
--      de llaves lo corrige el evento de Wompi a `produccion` (ver el comentario de `wompi_env` en el
--      esquema), y esa venta SI es real. El reloj la condenaria; el ambiente la respeta.
--
-- Y HAY UN REGALO: con este criterio, el cuadro (1b) de la segunda pasada es ADEMAS la comprobacion de que
-- el redespliegue tomo las llaves nuevas. Si sale una venta nueva en `test` despues de redesplegar, no es
-- que alguien vendiera en la ventana: es que las variables no entraron.
--
-- NO HAY AGUJERO DE NULOS: `wompi_env` es NOT NULL en el esquema y solo toma 'test' o 'produccion'.
--
-- EL CORTE NO DESAPARECE, pero ya no decide a quien se marca. Le quedan dos usos, y los dos son correctos:
-- anular las cuentas de Distribucion de cortes anteriores (paso 3) y ser la etiqueta del rastro (paso 2b).
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
-- NO TOCA EL INVENTARIO. Eso lo hace `CARGAR_EL_INVENTARIO_AL_ARRANQUE_2026-11-20.sql`, que va DESPUES de
-- este y es otra decision (ahi se declara el punto de partida de cada vitrina).
--
-- ═══ COMO SE CORRE ═══
--
--   1. PARA_REVISAR el bloque (0): las DOS fechas y el correo del actor. El corte viene en 2026-11-20 y el
--      inicio de la operacion en 2026-08-08; si cambia alguno, se cambia AHI y en ningun otro sitio.
--   2. Pegarlo en el editor SQL de Supabase de PRODUCCION y correrlo TAL CUAL: termina en `rollback`, asi
--      que no guarda nada y muestra los cuadros de verificacion.
--   3. Leer los cuadros (1), (5) y (5c). Lo clinico tiene que dar EXACTAMENTE lo mismo antes y despues.
--   4. Solo entonces, cambiar `rollback` por `commit` y volver a correr.
--
-- ═══ Y SE CORRE DOS VECES, A PROPOSITO ═══
--
-- Porque entre la primera pasada y el momento en que las llaves nuevas quedan vivas hay una VENTANA, y una
-- venta registrada en esa ventana nace en sandbox igual que las del smoke.
--
--   · PRIMERA PASADA: JUSTO ANTES de montar las variables de Vercel. Simulacion, leer (1b), y commit.
--   · SEGUNDA PASADA: DESPUES del redespliegue, en `rollback`. El cuadro (1b) tiene que salir VACIO.
--     Si no sale vacio, se corre otra vez con `commit` (y se mira `registrada_a_las` de cada venta).
--
-- CONVIENE AVISAR A LOS INTEGRANTES de que no registren ventas mientras dura esa ventana. No es obligatorio
-- (para eso esta la segunda pasada), pero una venta marcada de prueba hay que desmarcarla a mano desde
-- /pagos, y es mas barato no tener que hacerlo.
--
-- ⚠ EL ORDEN DEL DIA DEL ARRANQUE ESTA EN `docs/SMOKE_COMERCIAL_FINAL.md`. Este script es un paso de esa
-- lista, no el arranque completo: las llaves de Wompi y de Alegra van despues.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

-- ── (0) LOS PARAMETROS, en un solo sitio ─────────────────────────────────────────────────────────
--
-- PARA_REVISAR: las dos fechas y el correo. Ver la cabecera para por que son dos.
--
--   · `corte` ES EL DIA DEL ARRANQUE. YA NO DECIDE A QUIEN SE MARCA (eso lo decide el ambiente de la
--     venta: ver la cabecera, "el criterio para marcar no es la fecha"). Le quedan dos usos: anular las
--     cuentas de Distribucion de cortes ANTERIORES a este dia (paso 3), y quedar como etiqueta en el rastro
--     de auditoria para saber de que arranque fue cada marca (paso 2b).
--
--   · `inicio_operacion` ES DESDE CUANDO CUENTAN LAS CIFRAS, y es lo unico que usa el paso (4). Desde el
--     2026-11-17 ese valor tiene tres estados: sin fecha o con una fecha futura, las pantallas dicen que
--     la operacion no ha empezado y NO cuentan nada; con una fecha de hoy o anterior, cuentan desde ahi
--     (ver `src/modules/payments/arranque.ts`). O sea que ponerlo es el acto que ENCIENDE las cifras.
--
-- NO SE INTERCAMBIAN. Poner el corte en el 8 de agosto marcaria como prueba tres meses de nada y dejaria
-- las ventas del smoke contando como reales; poner el inicio en el 20 dejaria fuera todas las ventas
-- atrasadas del xlsx.
create temporary table _arranque(corte date, inicio_operacion date, correo text, motivo text) on commit drop;
insert into _arranque values (
  '2026-11-20',
  '2026-08-08',
  'gilurgi69@gmail.com',
  -- EL MISMO MOTIVO PARA TODAS: un motivo generico que se pueda buscar despues. Cumple el minimo de diez
  -- caracteres del CHECK de la 0217.
  'Sellada con llaves de sandbox: no se puede facturar, arranque del 2026-11-20'
);

-- LAS DOS FECHAS EN EL ORDEN QUE TIENEN QUE ESTAR. Si alguien las intercambia al editar el bloque de
-- arriba, el script para aqui en vez de marcar tres meses de ventas reales como prueba.
do $$
declare v_corte date; v_inicio date;
begin
  select corte, inicio_operacion into v_corte, v_inicio from _arranque;
  if v_inicio > v_corte then
    raise exception 'El inicio de la operacion (%) es posterior al corte (%). Estan intercambiados: el corte es el dia del arranque, el inicio es la primera venta real.', v_inicio, v_corte;
  end if;
end $$;

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
  -- LAS QUE ESTE SCRIPT VA A MARCAR: selladas con llaves de sandbox y contando todavia como reales.
  (select count(*) from transactions t
    where t.wompi_env = 'test' and not t.cuenta_como_de_prueba)                as sandbox_que_cuentan_como_real,
  (select count(*) from distribucion_statements where superseded_at is null)   as cuentas_distribucion_vivas,
  (select count(*) from evaluations)                                           as consultas,
  (select count(*) from patient_consents)                                      as consentimientos;

-- ── (1b) LO QUE ESTE SCRIPT VA A MARCAR, LISTADO ANTES DE MARCARLO ──────────────────────────────
--
-- ES LA RESPUESTA A LA PREGUNTA DE SANTIAGO ("¿lo marca o solo lo lista?"): LO MARCA, Y LO LISTA ANTES.
--
-- LA RECOMENDACION ES MARCAR, no solo listar, y la razon es concreta: una venta que se escape y siga
-- contando como real entra en las cifras de Direccion Y PUEDE SER FACTURADA POR LA COLA en el Alegra de
-- PRODUCCION, donde cada factura va a la DIAN y deshacerla es una nota credito con su hueco en el
-- consecutivo. Listar y dejarla viva mantiene esa puerta abierta justo el dia en que se montan las llaves
-- reales, que es el peor dia posible.
--
-- Y MARCARLA NO ES IRREVERSIBLE: la marca se quita desde /pagos y la venta vuelve a contar. Lo contrario
-- (una factura ya emitida a la DIAN) no se quita.
--
-- EN SIMULACION ESTE CUADRO SE LEE ANTES DE DECIDIR. Si trae algo que NO deberia marcarse, se para aqui:
-- la transaccion termina en rollback y no se ha escrito nada.
--
-- ⚠ Y EN LA SEGUNDA PASADA (despues del redespliegue, en rollback) ESTE CUADRO TIENE QUE SALIR VACIO. Si
-- trae algo, son dos cosas distintas y conviene distinguirlas antes de correr con commit:
--   · una venta registrada DURANTE la ventana (entre la primera pasada y el redespliegue): se vuelve a
--     correr con commit y queda marcada;
--   · una venta registrada DESPUES del redespliegue: entonces el redespliegue NO tomo las llaves nuevas, y
--     lo que hay que arreglar son las variables, no la venta.
-- La columna `registrada_a_las` es la que permite saber cual de las dos es.
select 'VA A MARCAR' as que,
       t.id as venta,
       (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date as dia,
       (t.created_at at time zone 'America/Bogota')::timestamp as registrada_a_las,
       t.status, t.payment_method, t.amount, t.wompi_env,
       coalesce(p.full_name, 'sin integrante') as integrante
  from transactions t
  left join professional_profiles pp on pp.id = t.professional_id
  left join profiles p on p.id = pp.profile_id
 where t.wompi_env = 'test'
   and not t.cuenta_como_de_prueba
 order by t.created_at;

-- ── (2) LAS VENTAS SELLADAS EN SANDBOX SE MARCAN COMO PRUEBA ─────────────────────────────────────
--
-- SE MARCA POR AMBIENTE, NO POR FECHA. El porque esta en la cabecera, y lo corto es: una venta con
-- `wompi_env = 'test'` no se puede facturar nunca (el candado de `ambiente.ts` exige que el pago y la
-- factura sean del mismo mundo), asi que dejarla contando como real es una cifra que no se puede cobrar.
--
-- SOLO LAS QUE TODAVIA CUENTAN (`not cuenta_como_de_prueba`): las que ya son de prueba por su paciente, su
-- profesional o su producto no necesitan una marca mas, y ponersela haria creer que alguien decidio algo
-- sobre ellas. La derivacion ya respondio.
--
-- LA COLUMNA DERIVADA NO SE TOCA AQUI: la escribe el trigger de la 0217 al ver `marcada_como_prueba_at`.
--
-- ESTE PASO ES IDEMPOTENTE: correrlo dos veces no vuelve a tocar lo ya marcado, porque lo ya marcado deja
-- de cumplir `not cuenta_como_de_prueba`. Por eso se puede correr otra vez despues del redespliegue.
update transactions t
   set marcada_como_prueba_at = now(),
       marcada_como_prueba_por = (select p.id from profiles p join _arranque a2 on true
                                   where lower(p.email) = lower(a2.correo)),
       marcada_como_prueba_motivo = (select motivo from _arranque)
 where t.wompi_env = 'test'
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
       jsonb_build_object('motivo', t.marcada_como_prueba_motivo, 'arranque', a.corte::text)
  from transactions t
  join _arranque a on true
 where t.marcada_como_prueba_motivo = a.motivo
   and not exists (
     select 1 from clinical_audit_log l
      where l.entity_type = 'transaction' and l.entity_id = t.id::text
        and l.event = 'venta.marcada_de_prueba'
        and l.payload->>'arranque' = a.corte::text
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
    where s.superseded_at is null and s.paid_at is null and s.corte_hasta < a.corte
 );

update distribucion_statements s
   set superseded_at = now(), superseded_reason = 'anulada'
  from _arranque a
 where s.superseded_at is null and s.paid_at is null and s.corte_hasta < a.corte;

insert into clinical_audit_log (event, entity_type, entity_id, actor_id, actor_email, payload)
select 'distribucion.cuenta_anulada',
       'distribucion_statements',
       s.id::text,
       (select p.id from profiles p join _arranque a2 on true where lower(p.email) = lower(a2.correo)),
       a.correo,
       jsonb_build_object('motivo', a.motivo, 'arranque', a.corte::text)
  from distribucion_statements s
  join _arranque a on true
 where s.superseded_reason = 'anulada'
   and not exists (
     select 1 from clinical_audit_log l
      where l.entity_type = 'distribucion_statements' and l.entity_id = s.id::text
        and l.event = 'distribucion.cuenta_anulada'
   );

-- ── (4) EL INICIO DE LA OPERACION: EL ACTO QUE ENCIENDE LAS CIFRAS ─────────────────────────────
--
-- Recorta el bruto, el ingreso de CNV, las comisiones del periodo y los insights, y NO recorta lo que se le
-- DEBE a alguien ni el inventario (un saldo no es un flujo). Las dos reglas tienen candado.
--
-- Y DESDE EL 2026-11-17 ES ADEMAS LO QUE HACE QUE LAS PANTALLAS DEJEN DE DECIR "todavia no se ha arrancado".
-- `updated_at` se toca a proposito: la version anterior no lo hacia, asi que la fila decia que se habia
-- tocado por ultima vez el 11 de septiembre cuando la fecha se habia puesto el 15 de octubre.
-- VA EL `inicio_operacion` (2026-08-08) Y NO EL CORTE. La columna se llama `fecha_de_arranque` por
-- historia, pero lo que guarda es DESDE CUANDO CUENTAN LAS CIFRAS. Ver la cabecera: el corte de pruebas es
-- otra cosa y lo expresa `cuenta_como_de_prueba`.
update commercial_config c
   set fecha_de_arranque = (select inicio_operacion from _arranque),
       updated_at = now();

-- ── (5) VERIFICACION: QUE QUEDO ─────────────────────────────────────────────────────────────────
select 'DESPUES' as momento,
  (select fecha_de_arranque::text from commercial_config limit 1)              as fecha_de_arranque_actual,
  (select count(*) from transactions)                                          as ventas,
  (select count(*) from transactions where cuenta_como_de_prueba)              as ventas_de_prueba,
  -- ESTA TIENE QUE QUEDAR EN CERO. Si no, alguna venta sellada en sandbox sigue contando como real, o
  -- sea una cifra que no se puede facturar.
  (select count(*) from transactions t
    where t.wompi_env = 'test' and not t.cuenta_como_de_prueba)                as sandbox_que_cuentan_como_real,
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
-- SOLO LAS QUE MARCO ESTE ARRANQUE, por su motivo: listar todas las de prueba de la historia mezclaria lo
-- que este arranque dejo con lo que ya estaba. Sin datos del paciente, porque esta salida se pega en un chat.
--
-- NOTA PARA LA SEGUNDA PASADA: el motivo es el mismo en las dos, asi que este cuadro las lista JUNTAS. No es
-- un defecto (lo que importa es el total del arranque), y el cuadro que distingue una pasada de la otra es
-- el (1b), que tiene que salir vacio.
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
