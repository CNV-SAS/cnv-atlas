-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- MARCAR A PROFESIONAL DEMO COMO DE DEMOSTRACION  ·  requiere la migracion 0199
--
-- ⚠ NO CORRER ANTES DEL SMOKE. La migracion 0199 solo añade la columna, y nace en false: hoy no hay nadie
-- marcado. Si se marca a Demo antes del recorrido, sus ventas dejan de contar en el bruto y en las
-- comisiones, y el smoke de numeros no puede verificar nada: todo da cero y no se distingue el filtro de un
-- defecto. EL ORDEN ES: smoke primero, fecha de arranque despues, esta marca al final.
--
-- SI YA SE CORRIO Y HAY QUE VOLVER AL RECORRIDO, se desmarca con la linea del final y se vuelve a marcar
-- cuando se termine. No hay nada que reconstruir: la marca no transforma datos, solo decide que se cuenta.
--
-- QUE HACE: lo suyo deja de contar en las cifras de resumen de la organizacion (el bruto, el ingreso de
-- CNV, las comisiones, lo que se deshizo y los insights). La lista de usuarios lo sigue mostrando, marcado.
--
-- QUE NO HACE, y son decisiones, no olvidos:
--
--   · NO saca su inventario de la vitrina. Sus unidades son REALES y estan en su bodega; sacarlas daria un
--     numero que no cuadra con ningun conteo fisico.
--   · NO cambia la facturacion. Esa la decide el PACIENTE: si Demo le vende a un paciente real, esa venta
--     se factura igual, porque ocurrio. El caso malo no es una factura de mas, es una venta real sin
--     factura.
--   · NO le vacia su propio tablero de Inicio. Esa pantalla responde "¿como voy yo?", y vaciarsela le
--     quitaria justo lo que tiene que poder demostrar.
--
-- SE PUEDE DESHACER en cualquier momento: la marca no borra ni transforma nada.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. VER A QUIEN SE LE VA A PONER. Revisar el correo antes de correr el UPDATE.
SELECT pp.id, p.email, p.full_name, pp.is_test
  FROM professional_profiles pp
  JOIN profiles p ON p.id = pp.profile_id
 ORDER BY p.email;

-- 2. MARCARLO. Cambiar el correo por el de la cuenta de demostracion.
UPDATE professional_profiles pp
   SET is_test = true
  FROM profiles p
 WHERE p.id = pp.profile_id
   AND p.email = 'demo@cnvsystem.com';

-- 3. COMPROBAR cuanto deja de contar.
--
-- OJO CON COMPARAR ESTA CIFRA CON LA DE LA PANTALLA (Santiago, 2026-10-01): la primera version sumaba
-- `t.amount` a secas y daba 3.589.600, mientras "Lo que has vendido" decia 3.530.100. Los 59.500 de
-- diferencia eran las devoluciones: la pantalla las resta y este SELECT no. Dos cifras del mismo hecho que
-- no cuadran se leen como un defecto, asi que ahora dice LAS DOS, cada una con su nombre.
SELECT count(*)::int AS ventas_que_salen,
       coalesce(sum(t.amount), 0) AS facturado_bruto,
       coalesce((SELECT sum(r.debited_amount)
                   FROM sale_reversals r
                   JOIN transactions t2 ON t2.id = r.transaction_id
                   JOIN professional_profiles pp2 ON pp2.id = t2.professional_id
                  WHERE pp2.is_test AND r.state = 'devuelta'), 0) AS menos_lo_devuelto,
       coalesce(sum(t.amount), 0)
         - coalesce((SELECT sum(r.debited_amount)
                       FROM sale_reversals r
                       JOIN transactions t2 ON t2.id = r.transaction_id
                       JOIN professional_profiles pp2 ON pp2.id = t2.professional_id
                      WHERE pp2.is_test AND r.state = 'devuelta'), 0)
         AS igual_a_lo_que_dice_la_pantalla
  FROM transactions t
  JOIN professional_profiles pp ON pp.id = t.professional_id
 WHERE t.status = 'paid' AND pp.is_test;

-- PARA DESHACERLO: UPDATE professional_profiles SET is_test = false WHERE is_test;
