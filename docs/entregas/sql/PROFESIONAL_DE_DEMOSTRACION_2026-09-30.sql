-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- MARCAR A PROFESIONAL DEMO COMO DE DEMOSTRACION  ·  requiere la migracion 0199
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
SELECT count(*)::int AS ventas_que_salen_de_las_cifras,
       coalesce(sum(t.amount), 0) AS dinero_que_sale
  FROM transactions t
  JOIN professional_profiles pp ON pp.id = t.professional_id
 WHERE t.status = 'paid' AND pp.is_test;

-- PARA DESHACERLO: UPDATE professional_profiles SET is_test = false WHERE is_test;
