-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿HAY ALGUNA VENTA REAL QUE HAYA COBRADO FLETE?  ·  SOLO LECTURA
--
-- PARA QUE: el 2026-10-05 el flete salio de CNV y las columnas `shipping_fee` / `shipping_cost` se
-- conservaron (migracion 0206) con UN argumento concreto: que una venta ANTERIOR si cobro flete y si puede
-- retractarse, y en esa CNV lo tiene que devolver.
--
-- ESE ARGUMENTO DEPENDE DE UN HECHO, y es el que esto comprueba. Si ninguna venta REAL cobro flete, las
-- columnas no protegen nada y se pueden borrar. Si alguna si, se queda y se dice cual.
--
-- "REAL" = `cuenta_como_de_prueba = false`. Esa columna la mantienen los triggers de la 0202/0203 desde las
-- TRES marcas (profesional, paciente, producto); escribir las condiciones a mano aqui crearia una segunda
-- definicion, que es como se termina con dos conteos que no cuadran.
--
-- NO IMPRIME DATOS DE PACIENTE: ni nombre, ni documento, ni direccion, ni telefono.
--
-- COMO SE CORRE (contra la NUBE, en el SQL editor de Supabase, o con psql):
--   psql "<cadena de la nube>" -f scripts/HAY_ALGUNA_VENTA_REAL_CON_FLETE_2026-10-06.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) LA RESPUESTA EN UNA FILA ──────────────────────────────────────────────────────────────────
-- Si `reales_con_flete` sale en 0, las columnas se pueden borrar.
select 'A · el conteo' as consulta,
       count(*) filter (where shipping_fee is not null)                                   as con_flete_en_total,
       count(*) filter (where shipping_fee is not null and not cuenta_como_de_prueba)     as reales_con_flete,
       count(*) filter (where shipping_fee is not null and cuenta_como_de_prueba)         as de_prueba_con_flete,
       count(*) filter (where shipping_cost is not null and not cuenta_como_de_prueba)    as reales_con_costo
  from transactions;

-- ── (B) Y SI HAY ALGUNA REAL, CUAL ES Y SI SU RETRACTO SIGUE VIVO ─────────────────────────────────
--
-- LO QUE DECIDE NO ES SOLO QUE EXISTA: es si TODAVIA puede retractarse. El plazo son cinco dias HABILES
-- desde la ENTREGA (Ley 1480 art. 47), asi que una venta real con flete entregada hace meses tampoco
-- protege nada: su ventana esta cerrada y CNV ya no le debe ese envio a nadie.
--
-- El calculo de dias habiles de aqui es APROXIMADO a proposito (cuenta de lunes a viernes, ignora festivos):
-- sirve para decidir si hay que mirar con cuidado, no para fijarle una fecha a un paciente. La fecha que
-- manda la calcula `estadoDelRetracto` en el codigo, con el calendario de festivos de Colombia.
select 'B · las reales con flete' as consulta,
       t.id                                                             as venta,
       (coalesce(t.operated_at, t.created_at) at time zone 'America/Bogota')::date as dia_de_la_venta,
       t.status,
       t.delivery_mode,
       t.shipping_fee::numeric                                          as flete_cobrado,
       t.shipping_cost::numeric                                         as costo_del_domiciliario,
       t.fulfillment_state,
       (t.delivered_at at time zone 'America/Bogota')::date             as entregada_el,
       t.retracto_ejercido_at is not null                               as ya_se_retracto,
       case
         when t.delivered_at is null then 'sin entregar: el reloj del retracto NO ha arrancado'
         when (current_date - (t.delivered_at at time zone 'America/Bogota')::date) > 10
           then 'ventana CERRADA (mas de 10 dias calendario desde la entrega)'
         else 'ATENCION: la ventana puede estar ABIERTA, mirala con cuidado'
       end                                                              as retracto
  from transactions t
 where t.shipping_fee is not null
   and not t.cuenta_como_de_prueba
 order by t.delivered_at desc nulls last;

-- ── (C) EL CONTEXTO: TODOS LOS DOMICILIOS, con flete o sin el ─────────────────────────────────────
-- Para que la respuesta de (A) se pueda leer sin dudar: cuantos envios hay en total y cuantos cobraron algo.
select 'C · todos los domicilios' as consulta,
       count(*)                                                            as envios,
       count(*) filter (where not cuenta_como_de_prueba)                   as envios_reales,
       count(*) filter (where shipping_fee is not null)                    as con_flete,
       min((coalesce(operated_at, created_at) at time zone 'America/Bogota')::date) as el_primero,
       max((coalesce(operated_at, created_at) at time zone 'America/Bogota')::date) as el_ultimo
  from transactions
 where delivery_mode = 'domicilio';
