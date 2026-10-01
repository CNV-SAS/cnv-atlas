-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- DE QUE PACIENTE ES UNA VENTA, Y SI YA ESTA MARCADO COMO DE PRUEBA  ·  SOLO LECTURA
--
-- PARA QUE: la devolucion de LUVIA de 90.000 sigue en /direccion. No es que el arreglo falle: es que el
-- PACIENTE todavia no esta marcado. Esta consulta dice quien es.
--
-- Trae nombre y documento porque es lo que permite reconocerlo; es PII, asi que se mira y no se pega en
-- ningun sitio. Sin RLS (editor SQL), que es la unica forma de verlo todo de una vez.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- 1. LAS DEVOLUCIONES, CON SU PACIENTE Y SU MARCA.
SELECT r.debited_amount AS dinero_que_volvio,
       n.name AS producto,
       r.note AS motivo,
       coalesce(nullif(btrim(pp.first_name || ' ' || pp.last_name), ''), '(sin perfil)') AS paciente,
       pa.document_number AS documento,
       pa.is_test AS paciente_ya_marcado,
       prof.full_name AS vendio,
       ppr.is_test AS profesional_ya_marcado,
       t.id AS venta
  FROM sale_reversals r
  JOIN transactions t ON t.id = r.transaction_id
  LEFT JOIN transaction_items ti ON ti.id = r.transaction_item_id
  LEFT JOIN nutraceuticals n ON n.id = ti.nutraceutical_id
  LEFT JOIN patients pa ON pa.id = t.patient_id
  LEFT JOIN patient_profiles pp ON pp.patient_id = pa.id
  LEFT JOIN professional_profiles ppr ON ppr.id = t.professional_id
  LEFT JOIN profiles prof ON prof.id = ppr.profile_id
 WHERE r.kind = 'devolucion'
 ORDER BY r.opened_at DESC;

-- 2. Y SI RESULTA QUE ES UN PACIENTE DE PRUEBA, se marca aqui mismo (o desde la pantalla de admin).
--    Cambiar el documento por el que salio arriba.
--
-- UPDATE patients
--    SET is_test = true, test_marked_at = now(),
--        test_marked_by = (SELECT id FROM profiles WHERE email = 'hola@cnvsystem.com')
--  WHERE document_number = 'CAMBIAR';

-- 3. COMPROBAR que quedo marcado. Despues de esto, su venta sale de /direccion.
-- SELECT document_number, is_test, test_marked_at FROM patients WHERE document_number = 'CAMBIAR';
