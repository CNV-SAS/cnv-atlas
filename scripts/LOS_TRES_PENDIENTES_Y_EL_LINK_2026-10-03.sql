-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- QUE SON LOS 3 PENDIENTES DE LA FRANJA, Y DE QUIEN ES EL LINK ABIERTO
--
-- SOLO LECTURA. Dos preguntas del smoke del 2026-10-03:
--   · "3 pendientes de ventas necesitan accion (2 vencidos)" no bajo al marcar al paciente.
--   · "Abiertos, sin usar: 1" en /direccion, con todo lo demas en cero.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (1) LOS PENDIENTES, uno por uno, con su tipo y si su venta esta marcada de prueba ──
--
-- COMO LEER EL RESULTADO:
--   · tipo = 'sin_saldo' con de_prueba = true  -> CORRECTO que siga: el producto es real y la unidad salio.
--   · cualquier OTRO tipo con de_prueba = true -> no deberia estar; avisame.
--   · de_prueba = false                        -> es real y pide accion de verdad.
select 'revision' as tipo, t.id, t.created_at::date as fecha, t.amount,
       t.cuenta_como_de_prueba as de_prueba, 'Pago sobre link anulado' as causa
  from transactions t
 where t.status = 'paid' and t.review_reason is not null and t.review_resolution is null
union all
select 'nota_credito', t.id, t.cash_not_received_at::date, t.amount, t.cuenta_como_de_prueba,
       'Efectivo no recibido, falta la nota credito'
  from transactions t
 where t.cash_not_received_at is not null and t.credit_note_manual_number is null
union all
select 'reversa', t.id, coalesce(r.resolved_at, r.opened_at)::date, t.amount, t.cuenta_como_de_prueba,
       'Reversa ' || r.state || ', falta la nota credito o responderle al banco'
  from sale_reversals r join transactions t on t.id = r.transaction_id
 where r.state = 'abierta' or (r.state in ('perdida', 'devuelta') and r.credit_note_manual_number is null)
union all
select 'sin_documento', t.id, t.created_at::date, t.amount, t.cuenta_como_de_prueba,
       'Cobrada sin factura o sin pago registrado'
  from transactions t
 where t.status = 'paid' and t.alegra_invoice_number is null and t.registered_retroactively_at is null
union all
select 'por_despachar', t.id, coalesce(t.operated_at, t.created_at)::date, t.amount, t.cuenta_como_de_prueba,
       'Pagada y sin entregar: sale de la bodega'
  from transactions t
  left join inventory_locations loc on loc.id = t.location_id
 where t.status = 'paid' and coalesce(t.fulfillment_state, 'pendiente') = 'pendiente'
   and t.professional_id is not null and t.location_id is not null
   and coalesce(loc.professional_id, '00000000-0000-0000-0000-000000000000'::uuid) is distinct from t.professional_id
   and t.cancelled_at is null and t.review_reason is null
union all
select 'sin_saldo', t.id, coalesce(t.registered_retroactively_at, t.operated_at, t.created_at)::date, t.amount,
       t.cuenta_como_de_prueba, 'Cobrada y el saldo no alcanzo'
  from transactions t
 where t.status = 'paid' and t.stock_state = 'sin_saldo'
   and coalesce(t.registered_retroactively_at, t.operated_at, t.created_at) > now() - interval '30 days'
order by 1, 3;

-- ── (2) EL LINK ABIERTO SIN USAR, de quien es ──
--
-- "Abiertos, sin usar" cuenta los checkouts que siguen vivos: nadie los pago ni los anulo. Si sale uno de un
-- paciente marcado de prueba, hay que decidir si esa seccion tambien debe excluirlos (hoy no lo hace, y es
-- una pregunta aparte: un link vivo de un paciente de prueba no cobra nada, pero si retiene inventario).
select t.id,
       t.created_at,
       t.amount,
       t.status,
       t.cuenta_como_de_prueba as de_prueba,
       p.document_number       as documento_paciente,
       p.cuenta_como_de_prueba as paciente_de_prueba,
       pr.full_name            as profesional,
       (select string_agg(n.name || ' x' || ti.quantity, ', ')
          from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
         where ti.transaction_id = t.id) as productos
  from transactions t
  left join patients p on p.id = t.patient_id
  left join professional_profiles pp on pp.id = t.professional_id
  left join profiles pr on pr.id = pp.profile_id
 where t.status = 'pending' and t.cancelled_at is null
 order by t.created_at desc;
