-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿LLEGO EL AVISO DE LA ANULACION?  ·  consulta de REVISION  ·  2026-09-17
--
-- SOLO LEE. Se pega en el EDITOR SQL DE SUPABASE. Sale del smoke del 3b: Santiago anulo dos transacciones desde
-- Wompi y en Atlas no paso nada. Esto dice si el aviso llego y con que estado, que es lo que decide el arreglo.
--
-- COMO SE LEE:
--   · seccion 'venta'  -> las ventas de Wompi de los ultimos 3 dias, con su estado en Atlas, si tienen reversa
--                         abierta, y CUANTOS avisos de Wompi se recibieron de esa venta.
--   · seccion 'aviso'  -> cada evento recibido, con el estado que traia (APPROVED, VOIDED, DECLINED...).
--                         Si de la anulada no hay ninguna fila VOIDED, Wompi no aviso, y el camino que queda es
--                         el cotejo diario.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

with ventas as (
  select 'venta'                                                         as seccion,
         t.created_at                                                    as cuando,
         t.id::text                                                      as venta,
         t.status::text                                                  as estado,
         coalesce(t.wompi_transaction_id, '-')                           as transaccion_wompi,
         coalesce((select r.state from sale_reversals r where r.transaction_id = t.id order by r.opened_at desc limit 1), 'sin reversa') as reversa,
         (select count(*) from payment_webhook_events e
           where e.payload->'data'->'transaction'->>'reference' = t.id::text)::text as avisos_recibidos
    from transactions t
   where t.payment_method = 'wompi' and t.created_at > now() - interval '3 days'
),
avisos as (
  select 'aviso'                                                         as seccion,
         e.created_at                                                    as cuando,
         coalesce(e.payload->'data'->'transaction'->>'reference', e.payload->>'transactionId', '-') as venta,
         coalesce(e.payload->'data'->'transaction'->>'status', 'sin estado')                        as estado,
         e.external_id                                                   as transaccion_wompi,
         case when e.processed_at is null then 'sin procesar' else 'procesado' end                  as reversa,
         coalesce(e.payload->>'origen', 'webhook')                       as avisos_recibidos
    from payment_webhook_events e
   where e.provider = 'wompi' and e.created_at > now() - interval '3 days'
)
select seccion, cuando, venta, estado, transaccion_wompi, reversa, avisos_recibidos
  from (select * from ventas union all select * from avisos) todo
 order by cuando desc;
