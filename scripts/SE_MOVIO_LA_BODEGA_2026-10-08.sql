-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿LA VENTA DESDE LA BODEGA DESCONTO DE VERDAD?  ·  SOLO LECTURA
--
-- ═══ POR QUE HACE FALTA, Y POR QUE NO BASTA CON MI RAZONAMIENTO ═══
--
-- Al revisar el punto 10 parecio que una venta desde la bodega no habia movido inventario: el desglose de
-- /direccion salio IGUAL antes y despues. Lei el codigo y la conclusion es que SI descuenta (`descontarVenta`
-- escribe el movimiento contra la ubicacion de la venta, que es central, y el saldo es un cache que mantiene el
-- trigger de la 0040), y que el desglose no tenia por que cambiar porque es de VITRINAS.
--
-- PERO ESO ES UN ARGUMENTO, NO UN DATO. Y el dato que faltaba (el saldo de la bodega antes y despues) no quedo
-- capturado en el recorrido. Esta consulta lo saca del rastro, que si quedo: los MOVIMIENTOS son inmutables.
--
-- SI (A) DEVUELVE EL MOVIMIENTO NEGATIVO y (B) muestra que el saldo cuadra con la suma de movimientos, la venta
-- descuenta y el caso se cierra. Si (A) sale vacio, el descuento NO ocurrio y es un defecto grave: CNV habria
-- vendido unidades que no salieron de ninguna parte, y el conteo fisico no cuadraria.
--
-- NO IMPRIME PII: producto, ubicacion, cantidades y fechas.
--
-- COMO SE CORRE (contra la NUBE):
--   psql "<cadena>" -f scripts/SE_MOVIO_LA_BODEGA_2026-10-08.sql
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── (A) LOS MOVIMIENTOS DE VENTA DESDE UNA UBICACION QUE NO ES VITRINA ───────────────────────────
--
-- `type = 'venta'` y `delta < 0` es lo que escribe `descontarVenta`. Acotado a los ultimos 7 dias, que es la
-- ventana del recorrido.
select 'A · movimientos de venta fuera de las vitrinas'          as consulta,
       (m.created_at at time zone 'America/Bogota')              as cuando,
       n.name                                                    as producto,
       l.name                                                    as ubicacion,
       l.kind                                                    as clase_de_ubicacion,
       m.delta                                                   as unidades,
       m.transaction_item_id is not null                          as atada_a_una_venta
  from nutraceutical_stock_movements m
  join nutraceuticals n on n.id = m.nutraceutical_id
  join inventory_locations l on l.id = m.location_id
 where m.type = 'venta'
   and l.kind <> 'integrante'
   and m.created_at > now() - interval '7 days'
 order by m.created_at desc;

-- ── (B) Y EL SALDO CUADRA CON LA SUMA DE MOVIMIENTOS ────────────────────────────────────────────
--
-- El saldo es un CACHE (migracion 0040: `nutraceutical_inventory.stock_quantity` es la suma de los
-- movimientos, mantenida por trigger, y hay un guard que rechaza escribirlo a mano). Si alguna fila sale con
-- `cuadra = false`, el cache se desincronizo y eso es un problema aparte y mas serio que esta pregunta.
select 'B · el saldo contra sus movimientos'                     as consulta,
       n.name                                                    as producto,
       l.name                                                    as ubicacion,
       i.stock_quantity                                          as saldo,
       coalesce(sum(m.delta), 0)                                 as suma_de_movimientos,
       i.stock_quantity = coalesce(sum(m.delta), 0)              as cuadra
  from nutraceutical_inventory i
  join nutraceuticals n on n.id = i.nutraceutical_id
  join inventory_locations l on l.id = i.location_id
  left join nutraceutical_stock_movements m
         on m.nutraceutical_id = i.nutraceutical_id
        and m.location_id = i.location_id
        and m.lot_id = i.lot_id
 where l.kind <> 'integrante'
 group by n.name, l.name, i.stock_quantity
 order by 6, 2;

-- ── (C) Y EL ESTADO DE INVENTARIO DE LAS VENTAS DEL RECORRIDO ───────────────────────────────────
--
-- `stock_state` dice lo que Atlas cree que hizo con el inventario de cada venta. 'descontado' es el camino
-- feliz; 'sin_saldo' significa que descontó lo que había y faltó (se registra y se avisa); 'reservado' o
-- 'pendiente' en una venta PAGADA es el caso que habria que mirar: cobrada y sin descontar.
select 'C · estado de inventario de las ventas pagadas'          as consulta,
       (t.created_at at time zone 'America/Bogota')              as cuando,
       t.stock_state                                             as estado_de_inventario,
       l.kind                                                    as salio_de,
       t.amount                                                  as monto,
       t.stock_last_error                                         as nota
  from transactions t
  left join inventory_locations l on l.id = t.location_id
 where t.status = 'paid'
   and t.created_at > now() - interval '7 days'
 order by t.created_at desc;
