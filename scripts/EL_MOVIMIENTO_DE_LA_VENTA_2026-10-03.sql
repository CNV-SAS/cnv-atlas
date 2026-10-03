-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL MOVIMIENTO DE LA VENTA AL PACIENTE DE PRUEBA  ·  la (B) reescrita
--
-- SOLO LECTURA. La (B) anterior volvio vacia y eso NO distingue "no hay movimiento" de "la consulta no lo
-- encuentra". El enlace estaba bien (`transaction_item_id`, verificado en `inventario-de-venta.ts`), asi que
-- lo que fallaba era filtrar por el NOMBRE del producto: un espacio invisible en 'ADAPTO-STRESS' lo deja
-- todo fuera sin decir nada.
--
-- ESTA VERSION NO DEPENDE DEL NOMBRE. La primera busca por el ID de la venta; la segunda lista la vitrina
-- entera del Integrante y muestra el nombre ENTRE CORCHETES, para que un espacio de sobra se vea.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (B1) LOS MOVIMIENTOS DE ESA VENTA, por su id ──
--
-- ESTA ES LA QUE RESPONDE LA PREGUNTA. Si devuelve una fila con type='venta' y delta=-1, el movimiento
-- existe y apunta a la venta: todo esta en su sitio y lo unico que paso es que la pantalla la escondio.
-- Si devuelve CERO filas, entonces algo desconto el inventario sin dejar rastro ligado a la venta, y eso
-- si es grave.
select m.created_at,
       n.name                 as producto,
       m.type                 as movimiento,
       m.delta,
       m.reason,
       m.lote,
       m.transaction_item_id,
       ti.transaction_id      as venta,
       l.name                 as ubicacion
  from nutraceutical_stock_movements m
  join nutraceuticals n on n.id = m.nutraceutical_id
  left join transaction_items ti on ti.id = m.transaction_item_id
  left join inventory_locations l on l.id = m.location_id
 where ti.transaction_id = '6ad312b7-a7ef-4f5c-a83e-097abd76f0e5'
 order by m.created_at;

-- ── (B2) LA VITRINA DE PROFESIONAL PRUEBA, sus ultimos movimientos ──
--
-- Sin filtrar por producto. El nombre va ENTRE CORCHETES: si sale "[ADAPTO-STRESS ]" o "[ ADAPTO-STRESS]",
-- el nombre tiene un espacio y por eso la consulta anterior no encontraba nada.
--
-- `venta` dice a que venta pertenece cada salida. Una fila de type='venta' con `venta` en null seria lo
-- preocupante: una salida sin venta que la explique.
select m.created_at,
       '[' || n.name || ']'   as producto,
       m.type                 as movimiento,
       m.delta,
       m.lote,
       ti.transaction_id      as venta,
       t.cuenta_como_de_prueba as la_venta_es_de_prueba,
       m.reason
  from nutraceutical_stock_movements m
  join nutraceuticals n on n.id = m.nutraceutical_id
  join professional_profiles pp on pp.id = m.professional_id
  join profiles pr on pr.id = pp.profile_id
  left join transaction_items ti on ti.id = m.transaction_item_id
  left join transactions t on t.id = ti.transaction_id
 where pr.full_name ilike '%Prueba%'
 order by m.created_at desc
 limit 30;

-- ── (B3) EL CONTROL: ¿hay alguna salida de inventario SIN venta que la explique? ──
--
-- Es la pregunta de fondo, y vale para toda la operacion, no solo para este caso. Un movimiento de type
-- 'venta' tiene que apuntar siempre a una linea de venta; si alguno no apunta, ahi hay inventario que salio
-- sin registro. Lo normal es que devuelva CERO filas.
select m.created_at, n.name as producto, m.delta, m.reason, pr.full_name as integrante
  from nutraceutical_stock_movements m
  join nutraceuticals n on n.id = m.nutraceutical_id
  left join professional_profiles pp on pp.id = m.professional_id
  left join profiles pr on pr.id = pp.profile_id
 where m.type = 'venta' and m.transaction_item_id is null
 order by m.created_at desc
 limit 20;
