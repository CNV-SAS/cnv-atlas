-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA VENTA AL PACIENTE DE PRUEBA QUE DESCONTO INVENTARIO Y NO SE VE
--
-- SOLO LECTURA. Responde la pregunta de la parte 3 del smoke (2026-10-03): se vendio ADAPTO-STRESS
-- (producto REAL) a un paciente marcado de prueba, salio toast de exito, el inventario bajo de 5 a 4, y
-- la venta no aparecia donde Santiago miro.
--
-- LO QUE EL CODIGO YA DICE, y por eso esta consulta es para CONFIRMAR, no para descubrir:
--   · /pagos la oculta a proposito (`listTransactions` filtra por `cuenta_como_de_prueba`), pero DEJA EL
--     AVISO "N ventas de prueba ocultas · Verlas". Si ese aviso no salio, eso SI es un defecto.
--   · "Sus ventas" desde admin NO filtra: deberia estar ahi.
--   · El historial de movimientos NO filtra: el movimiento de venta deberia estar ahi.
--   · Las cifras de dinero la excluyen, y eso es lo correcto.
--
-- Cambia el documento si el paciente de prueba es otro.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) ¿LA VENTA EXISTE? Y si existe, como esta marcada ──
select t.id,
       t.created_at,
       t.status,
       t.payment_method,
       t.amount,
       t.stock_state                     as inventario,
       t.cuenta_como_de_prueba           as cuenta_como_de_prueba,
       t.treatment_id is not null        as atada_a_una_consulta,
       t.alegra_invoice_number           as factura,
       p.document_number                 as documento_paciente,
       p.is_test                         as paciente_marcado_a_mano,
       p.cuenta_como_de_prueba           as paciente_cuenta_como_de_prueba,
       (select string_agg(n.name || ' x' || ti.quantity, ', ')
          from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
         where ti.transaction_id = t.id) as productos,
       (select bool_or(coalesce(n.is_test, false))
          from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
         where ti.transaction_id = t.id) as algun_producto_de_prueba
  from transactions t
  join patients p on p.id = t.patient_id
 where p.cuenta_como_de_prueba
 order by t.created_at desc
 limit 20;

-- ── (B) ¿QUE DESCONTO EL INVENTARIO? El movimiento, con la venta que lo causo ──
--
-- Si (A) no devuelve la venta pero esto SI devuelve el movimiento, entonces algo descontó sin dejar venta,
-- que seria mucho mas grave. Si los dos aparecen y coinciden por `transaction_id`, todo esta en su sitio y
-- lo unico que paso es que la pantalla la escondio.
-- OJO CON EL ENLACE: el movimiento NO guarda `transaction_id`, guarda `transaction_item_id` (la LINEA de la
-- venta). Se pasa por `transaction_items` para llegar a la venta.
select m.created_at,
       n.name                       as producto,
       m.type                       as movimiento,
       m.delta,
       m.reason,
       t.id                         as venta,
       t.id is not null             as la_venta_existe,
       t.cuenta_como_de_prueba      as la_venta_cuenta_como_de_prueba
  from nutraceutical_stock_movements m
  join nutraceuticals n on n.id = m.nutraceutical_id
  left join transaction_items ti on ti.id = m.transaction_item_id
  left join transactions t on t.id = ti.transaction_id
 where n.name = 'ADAPTO-STRESS'
 order by m.created_at desc
 limit 20;

-- ── (C) EL CONTEO QUE DEBERIA SALIR EN EL AVISO DE /pagos ──
--
-- Es exactamente lo que cuenta `contarVentasDePrueba`. Si da 1 o mas y el aviso no aparecio en la pantalla,
-- el defecto esta en la pantalla y no en el filtro.
select count(*)::int as ventas_de_prueba_ocultas
  from transactions
 where cuenta_como_de_prueba;

-- ── (D) Y LA LUVIA DE "ventas por revisar", para cerrar la otra duda ──
--
-- Deberia ser la retroactiva de Maria Camila. Sigue ahi A PROPOSITO: su paciente es de prueba, asi que su
-- DINERO no cuenta en ninguna cifra, pero LUVIA es un producto REAL y esa unidad salio de verdad de una
-- vitrina. La bandeja mira el PRODUCTO, no la venta. Se cierra descartandola en "Pendientes sin salida".
select t.id,
       t.created_at,
       t.amount,
       t.stock_state,
       t.cuenta_como_de_prueba,
       pr.full_name              as profesional,
       p.document_number         as documento_paciente,
       p.cuenta_como_de_prueba   as paciente_de_prueba,
       (select string_agg(n.name || ' x' || ti.quantity, ', ')
          from transaction_items ti join nutraceuticals n on n.id = ti.nutraceutical_id
         where ti.transaction_id = t.id) as productos
  from transactions t
  join patients p on p.id = t.patient_id
  left join professional_profiles pp on pp.id = t.professional_id
  left join profiles pr on pr.id = pp.profile_id
 where t.status = 'paid' and t.stock_state = 'sin_saldo';
