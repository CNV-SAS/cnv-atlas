-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ¿HAY VENTAS QUE MEZCLEN UN PRODUCTO REAL CON UNO DE PRUEBA?  ·  SOLO LECTURA
--
-- PARA QUE: desde hoy un guard lo impide, pero las que ya existen siguen ahi. Una venta mezclada es el unico
-- caso donde el filtro nuevo tiene un costo: al excluir la venta ENTERA, tambien deja fuera su linea REAL.
--
-- QUE HACER CON LA QUE SALGA, y la respuesta corta es nada:
--
--   · NO SE PUEDE BORRAR si ya descontó inventario (su rastro de custodia quedaria suelto). Se corregiria con
--     una devolucion, que es mas trabajo del que vale para un dato de smoke.
--   · Y NO HACE FALTA: desde el filtro de hoy deja de contar en todas las cifras, asi que no ensucia nada.
--     Lo unico que se pierde es su linea real, que tambien era de una prueba.
--
-- SI SALIERA MAS DE UNA, O ALGUNA CON DINERO QUE IMPORTA, entonces si hay que decidir: avisame y lo miramos.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

SELECT t.id AS venta,
       t.created_at::date AS dia,
       t.amount AS total,
       string_agg(n.name || CASE WHEN coalesce(n.is_test, false) THEN ' (de prueba)' ELSE '' END, ', '
                  ORDER BY n.name) AS lineas,
       coalesce(p.full_name, '(sin profesional)') AS vendio
  FROM transactions t
  JOIN transaction_items ti ON ti.transaction_id = t.id
  JOIN nutraceuticals n ON n.id = ti.nutraceutical_id
  LEFT JOIN professional_profiles pp ON pp.id = t.professional_id
  LEFT JOIN profiles p ON p.id = pp.profile_id
 WHERE t.status = 'paid'
 GROUP BY t.id, t.created_at, t.amount, p.full_name
HAVING count(*) FILTER (WHERE coalesce(n.is_test, false)) > 0
   AND count(*) FILTER (WHERE NOT coalesce(n.is_test, false)) > 0
 ORDER BY t.created_at DESC;
