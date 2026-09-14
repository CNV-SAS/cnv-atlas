-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CERRAR LOS CHECKOUTS PENDIENTES ANTES DE CAMBIAR DE AMBIENTE  ·  Bloque 2b
--
-- ── EL HUECO QUE CIERRA (encontrado el 2026-09-13, preparando el 2b) ────────────────────────────
--
-- `transactions.wompi_env` se escribe al CREAR el checkout, con la llave de ese momento. Pero la llave con
-- la que el paciente PAGA la pone la pagina de checkout al abrirse, con la llave desplegada ENTONCES. Un
-- link creado antes del cambio y abierto despues cruza de ambiente:
--
--   · creado en PRUEBAS, pagado con la llave de PRODUCCION: dinero real, venta marcada 'test'. En
--     produccion queda `rechazada` para siempre ("pago de prueba") y nunca se factura.
--   · creado en PRODUCCION, pagado tras una vuelta atras con la llave de PRUEBAS: dinero de juguete,
--     venta marcada 'produccion'. Al volver a produccion, la cola le emitiria una FACTURA REAL.
--
-- El link vale 24 horas y solo abre si la venta sigue `pending`. Cerrarlas antes del cambio hace que el
-- link diga "Link no disponible" y el profesional genere uno nuevo, que nace con el ambiente correcto.
--
-- El arreglo de fondo es de codigo (sellar el ambiente desde el evento de Wompi, que trae `environment`),
-- y va DESPUES del 2b: no se toca el codigo de pagos el dia antes de salir.
--
-- REQUIERE LA 0140 aplicada (usa `cancelled_at`).
--
-- COMO SE CORRE, en los dos momentos que dice la guia (antes de encender y antes de una vuelta atras):
--   En una ventana de PowerShell con $env:DATABASE_URL de la nube (ver la guia del 2b, A2):
--     node scripts/aplicar-migracion.mjs scripts/cerrar-checkouts-pendientes.sql
--   ... y con --commit al final. El ensayo ya dice cuantas cerraria.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int; u int;
begin
  create temp table cerrados on commit drop as
    select id from transactions where status = 'pending' and payment_method = 'wompi';

  -- Todas las pendientes de Wompi, no solo las de menos de 24 horas: una mas vieja ya no abre, y cerrarla
  -- no cambia nada; dejar fuera una de 23 horas y 59 minutos si.
  -- CON `cancelled_at` (Bloque 3, sesion 2, 0140): un link cerrado aqui es un link ANULADO, no uno que Wompi
  -- rechazo. Si una pagina de Wompi ya abierta lo paga despues, el pago queda sellado y EN REVISION, sin
  -- factura, en vez de facturarse solo: justo alrededor de un cambio de ambiente es cuando no se sabe con que
  -- llaves se cobro. Sin actor (`cancelled_by` nulo): lo corre un script.
  update transactions t
     set status = 'failed', cancelled_at = now(), updated_at = now()
    from cerrados c
   where t.id = c.id;
  get diagnostics n = row_count;

  -- Y SE SUELTAN SUS RESERVAS (Bloque 3, 0139). Un checkout cerrado a mano que conservara su reserva
  -- retendria las unidades hasta que venciera el link, 24 horas, sin que nadie las pueda vender. Es lo mismo
  -- que hace el webhook cuando un pago falla (liberarReservasDeVenta).
  update inventory_reservations r
     set released_at = now()
    from transaction_items ti
    join cerrados c on c.id = ti.transaction_id
   where r.transaction_item_id = ti.id
     and r.released_at is null and r.consumed_at is null;
  get diagnostics u = row_count;
  update transactions t set stock_state = 'liberado'
    from cerrados c where t.id = c.id and t.stock_state = 'reservado';

  raise notice 'Checkouts pendientes cerrados: %. Reservas liberadas: %.', n, u;
end $$;

commit;
