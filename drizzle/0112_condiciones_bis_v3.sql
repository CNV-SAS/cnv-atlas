-- CATALOGO DE CONDICIONES DE LA TOMA BIS v3: ADITIVO Y FORWARD-ONLY.
--
-- GENERADO por scripts/gen-bis-conditions-migration.mjs desde supabase/seed-bis-conditions.ts. NO editar a mano: el seed es
-- la fuente unica del contenido y esto se deriva de el. Editarlo aqui hace que los dos canales
-- (local por seed, nube por migracion) digan cosas distintas sin que nada de error.
--
-- POR QUE UNA MIGRACION Y NO CORRER EL SEED CONTRA LA NUBE: el seed es seguro (su delete esta acotado
-- a su propia version), pero un comando manual no es un despliegue. El 2026-09-07 la v2 se sembro en
-- local y la nube se quedo en la v1 sin que nada lo dijera. Una migracion la aplica el despliegue y
-- queda registrada en la tabla de migraciones.
--
-- POR QUE LAS VERSIONES ANTERIORES QUEDAN INTACTAS: los ids se derivan de (VERSION_NUMBER, clave), asi
-- que una version nueva produce filas NUEVAS. Las capturas ya hechas guardan su respuesta en
-- evaluation_bis_intake.condition_answers (JSONB por clave) SELLADA contra su bis_condition_version_id,
-- y la vista de solo lectura saca los rotulos del catalogo de ESA version. Sin esa propiedad, publicar
-- una version nueva dejaria a las evaluaciones emitidas mostrando respuestas sin su pregunta.
--
-- CUAL QUEDA ACTIVA: la de mayor published_at (getActiveBisConditionCatalog). La columna es NOT NULL
-- con DEFAULT now(), asi que insertar esta fila la vuelve la activa en el momento de aplicarla.
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING en las dos tablas. Aplicarla dos veces deja lo mismo.

INSERT INTO bis_condition_versions (id, version_number, notes) VALUES
  ('53b6e8db-9c55-44d6-8ed5-bd363b54260b', 3, 'v2 (2026-09-07): se retiran las dos condiciones de validez que Gildardo senalo en el cotejo (edema_anasarca, febril_deshidratacion). No estaban en su HTML. Quedan 8 generales + 1 validez (amputacion, declarada como divergencia) + 3 femeninas. La v1 se conserva intacta: las evaluaciones ya emitidas la tienen sellada.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bis_conditions (id, bis_condition_version_id, key, label, scope, kind, input_type, requires_detail, detail_label, detail_type, compromises_validity, order_index) VALUES
  ('9c3ee9d1-262b-4ba6-8dff-3198b122cc9e', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'placas_metalicas', '¿Cuenta con placas metálicas?', 'general', 'calidad', 'boolean', false, null, null, false, 1),
  ('ec49716c-658c-4646-8d9c-e83e83401e8c', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'protesis_manos_pies', '¿Tiene prótesis de manos o pies?', 'general', 'calidad', 'boolean', false, null, null, false, 2),
  ('626e73f6-1ba9-46d9-8457-43daf19ec2a6', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'marcapasos', '¿Tiene marcapasos o equipos de soporte vital?', 'general', 'contraindicacion', 'boolean', false, null, null, false, 3),
  ('deb587c0-cc81-414a-8e4b-26d1aac00aa5', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'cafe_alimentos_3h', '¿Tomó café o alimentos hace menos de 3 horas?', 'general', 'calidad', 'boolean', false, null, null, false, 4),
  ('736d2813-aee9-4832-82bf-b772e3b2f741', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'bano_previo', '¿Fue al baño antes de ingresar a la consulta?', 'general', 'calidad', 'boolean', false, null, null, false, 5),
  ('c8eb96aa-7b4e-4242-802c-cc6ac4da096d', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'ejercicio_intenso_4h', '¿Hizo ejercicio intenso hace menos de 4 horas?', 'general', 'calidad', 'boolean', false, null, null, false, 6),
  ('cfd495a2-d160-4367-89e3-bd98eb186610', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'diuretico', '¿Consume algún medicamento diurético?', 'general', 'calidad', 'boolean', true, '¿Cuál?', 'text', false, 7),
  ('6d0a37e5-a502-4bbd-8f57-f0081a2fa6ae', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'accesorios_metalicos_retirados', '¿Se retiraron los accesorios metálicos en contacto con la piel antes de la BIA?', 'general', 'calidad', 'boolean', false, null, null, false, 8),
  ('e1c50fc4-5537-499f-891d-da91a2ed4b21', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'amputacion', '¿Tiene amputación de algún segmento corporal?', 'general', 'validez', 'boolean', false, null, null, true, 9),
  ('80e8a118-0074-45ec-804c-406a8fe9afd0', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'discapacidad', '¿Tiene alguna discapacidad diagnosticada?', 'general', 'calidad', 'boolean', true, '¿Cuál?', 'text', false, 10),
  ('632a2e21-0079-4707-84dc-f1fd8a762c38', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'embarazo', '¿Está en embarazo?', 'mujeres', 'advertencia', 'boolean', true, 'Mes de gestación', 'number', true, 11),
  ('44a46c4b-858d-4002-874e-afcdf01da8f5', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'menstruacion', '¿Está menstruando?', 'mujeres', 'calidad', 'boolean', true, 'Día del periodo', 'number', false, 12),
  ('500f409a-d82f-49fd-83fa-d2619a6e115e', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'semana_ciclo', '¿En qué semana de su ciclo se encuentra?', 'mujeres', 'calidad', 'number', false, null, null, false, 13),
  ('49b2db58-931f-42fd-8b86-0f2c4b0ae5be', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'anticonceptivo', '¿Usa algún dispositivo anticonceptivo?', 'mujeres', 'calidad', 'boolean', true, '¿Cuál?', 'text', false, 14),
  ('19274549-79a2-49bd-807b-c1e3013f6bf3', '53b6e8db-9c55-44d6-8ed5-bd363b54260b', 'menopausia', '¿Está en menopausia?', 'mujeres', 'calidad', 'boolean', false, null, null, false, 15)
ON CONFLICT (id) DO NOTHING;

-- 15 condiciones: 10 generales + 5 femeninas.
