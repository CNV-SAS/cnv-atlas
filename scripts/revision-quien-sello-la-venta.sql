-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿QUIEN SELLO ESA VENTA: EL AVISO DE WOMPI O EL COTEJO?  ·  consulta de REVISION  ·  2026-09-16
--
-- SOLO LEE. Se pega en el EDITOR SQL DE SUPABASE (no es de los que se corren con --commit).
--
-- OJO, Y POR ESO ES UNA SOLA CONSULTA (corregido el 2026-09-16): el editor de Supabase muestra el resultado de
-- la ULTIMA sentencia, asi que la version anterior, con dos, devolvia el historial de corridas y escondia
-- justamente lo que el nombre promete. Aqui todo viene en un resultado, con una columna `seccion`.
--
-- COMO SE LEE:
--   · seccion = 'venta'  -> una venta con link de pago de los ultimos 3 dias, y en `origen` quien la sello:
--       'aviso de Wompi'          el webhook (llego, o llego en un reintento);
--       'cotejo'                  la recupero el cotejo;
--       'sin evento: nadie la sello'  todavia no la sello nadie.
--   · seccion = 'corrida' -> las ultimas corridas del cotejo, para cruzar las horas con `sellada_en`.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

with ventas as (
  select 'venta'                                    as seccion,
         t.created_at                               as cuando,
         t.id::text                                 as venta,
         t.status::text                             as estado,
         case
           when e.id is null then 'sin evento: nadie la sello'
           when e.payload->>'origen' is not null then 'cotejo'
           else 'aviso de Wompi'
         end                                        as origen,
         t.updated_at::text                         as sellada_en,
         e.created_at::text                         as evento_en,
         coalesce(t.alegra_invoice_number, '-')     as factura
    from transactions t
    left join payment_webhook_events e
      on e.provider = 'wompi'
     and (e.payload->>'transactionId' = t.id::text
          or e.payload->'data'->'transaction'->>'reference' = t.id::text)
   where t.payment_method = 'wompi'
     and t.created_at > now() - interval '3 days'
),
corridas as (
  select 'corrida'                                  as seccion,
         r.ran_at                                   as cuando,
         '-'                                        as venta,
         r.origin                                   as estado,
         concat(r.checked, ' revisadas, ', r.recovered, ' recuperadas, ', r.mismatched, ' sin cuadrar') as origen,
         r.ran_at::text                             as sellada_en,
         '-'                                        as evento_en,
         coalesce(r.failed_reason, '-')             as factura
    from payment_reconciliation_runs r
   order by r.ran_at desc
   limit 5
)
select seccion, cuando, venta, estado, origen, sellada_en, evento_en, factura
  from (select * from ventas union all select * from corridas) todo
 order by seccion, cuando desc;
