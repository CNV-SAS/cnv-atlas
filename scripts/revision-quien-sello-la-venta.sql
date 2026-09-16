-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿QUIEN SELLO ESA VENTA: EL AVISO DE WOMPI O EL COTEJO?  ·  consulta de REVISION  ·  2026-09-16
--
-- SOLO LEE. Esta pensada para PEGARSE EN EL EDITOR SQL DE SUPABASE (no es un script de los que se corren con
-- --commit). Responde la duda del smoke del 3b: el pago aparecio sellado sin que el boton dijera "recuperado",
-- y la explicacion probable es que Wompi REINTENTO su aviso cuando el secreto ya estaba bien.
--
-- COMO SE LEE EL RESULTADO:
--   · origen = 'aviso de Wompi'  -> lo sello el webhook (el reintento entro). El cotejo no tenia nada que hacer.
--   · origen = 'cotejo'          -> lo sello el cotejo, que es lo que el smoke queria probar.
--   · Y la columna `sellada_en` contra la hora en que se pulso el boton termina de decidirlo.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. Las ventas con link de pago de los ultimos 3 dias, y quien las sello.
select t.created_at              as creada,
       t.updated_at              as sellada_en,
       t.status,
       t.wompi_transaction_id,
       t.alegra_invoice_number   as factura,
       e.created_at              as evento_en,
       e.processed_at            as evento_procesado,
       case
         when e.id is null then 'sin evento: nadie la sello'
         when e.payload ? 'origen' then 'cotejo'
         else 'aviso de Wompi'
       end                       as origen
  from transactions t
  left join payment_webhook_events e
    on e.provider = 'wompi'
   and (e.payload->>'transactionId' = t.id::text
        or e.payload->'data'->'transaction'->>'reference' = t.id::text)
 where t.payment_method = 'wompi'
   and t.created_at > now() - interval '3 days'
 order by t.created_at desc, e.created_at;

-- 2. Las corridas del cotejo, para cruzar las horas.
select ran_at, origin as origen, checked as revisadas, recovered as recuperadas, mismatched as discrepancias, failed_reason
  from payment_reconciliation_runs
 order by ran_at desc
 limit 5;
