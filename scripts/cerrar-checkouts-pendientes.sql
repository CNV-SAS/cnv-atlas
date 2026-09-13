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
-- COMO SE CORRE, en los dos momentos que dice la guia (antes de encender y antes de una vuelta atras):
--   En una ventana de PowerShell con $env:DATABASE_URL de la nube (ver la guia del 2b, A2):
--     node scripts/aplicar-migracion.mjs scripts/cerrar-checkouts-pendientes.sql
--   ... y con --commit al final. El ensayo ya dice cuantas cerraria.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare n int;
begin
  -- Todas las pendientes de Wompi, no solo las de menos de 24 horas: una mas vieja ya no abre, y cerrarla
  -- no cambia nada; dejar fuera una de 23 horas y 59 minutos si.
  update transactions
     set status = 'failed', updated_at = now()
   where status = 'pending'
     and payment_method = 'wompi';
  get diagnostics n = row_count;
  raise notice 'Checkouts pendientes cerrados: %', n;
end $$;

commit;
