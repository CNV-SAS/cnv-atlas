-- CATALOGO DE CONDICIONES DE LA TOMA BIS v2: ADITIVO Y FORWARD-ONLY.
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
  ('bd64caea-8fde-424f-89ab-e564ace308f9', 2, 'v2 (2026-09-07): se retiran las dos condiciones de validez que Gildardo senalo en el cotejo (edema_anasarca, febril_deshidratacion). No estaban en su HTML. Quedan 8 generales + 1 validez (amputacion, declarada como divergencia) + 3 femeninas. La v1 se conserva intacta: las evaluaciones ya emitidas la tienen sellada.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bis_conditions (id, bis_condition_version_id, key, label, scope, kind, input_type, requires_detail, detail_label, detail_type, compromises_validity, order_index) VALUES
  ('a5e9a009-3922-4a70-81aa-84f3abca21c2', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'placas_metalicas', '¿Cuenta con placas metálicas?', 'general', 'calidad', 'boolean', false, null, null, false, 1),
  ('ec35d6c7-e35b-42cc-83c2-7c9edeb447df', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'protesis_manos_pies', '¿Tiene prótesis de manos o pies?', 'general', 'calidad', 'boolean', false, null, null, false, 2),
  ('38e6eee5-429e-44fd-8ccf-a2fd1d91c2a4', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'marcapasos', '¿Tiene marcapasos o equipos de soporte vital?', 'general', 'contraindicacion', 'boolean', false, null, null, false, 3),
  ('c2f95484-c5ef-4c54-81ae-d6ff167c6162', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'cafe_alimentos_3h', '¿Tomó café o alimentos hace menos de 3 horas?', 'general', 'calidad', 'boolean', false, null, null, false, 4),
  ('6b37a206-d18b-4e51-86f7-60d451ac66d0', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'bano_previo', '¿Fue al baño antes de ingresar a la consulta?', 'general', 'calidad', 'boolean', false, null, null, false, 5),
  ('790acd2d-9907-4b52-8e39-e4a9e88d9210', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'ejercicio_intenso_4h', '¿Hizo ejercicio intenso hace menos de 4 horas?', 'general', 'calidad', 'boolean', false, null, null, false, 6),
  ('552df615-ca7c-4849-81a4-9bc75480e06c', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'diuretico', '¿Consume algún medicamento diurético?', 'general', 'calidad', 'boolean', true, '¿Cuál?', 'text', false, 7),
  ('c499a185-215f-44f3-8014-ced81c203412', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'accesorios_metalicos_retirados', '¿Se retiraron los accesorios metálicos en contacto con la piel antes de la BIA?', 'general', 'calidad', 'boolean', false, null, null, false, 8),
  ('f3ab199e-32f4-4fb3-8018-eeeea6774560', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'amputacion', '¿Tiene amputación de algún segmento corporal?', 'general', 'validez', 'boolean', false, null, null, true, 9),
  ('cbd50344-0660-4ea5-8582-77c398d5c93a', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'embarazo', '¿Está en embarazo?', 'mujeres', 'advertencia', 'boolean', true, 'Mes de gestación', 'number', true, 10),
  ('bef8229a-fcd9-4a19-8718-64228f79a6e0', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'menstruacion', '¿Está menstruando?', 'mujeres', 'calidad', 'boolean', true, 'Día del periodo', 'number', false, 11),
  ('ec0809be-aa10-4602-84bc-6fa7d8b0af92', 'bd64caea-8fde-424f-89ab-e564ace308f9', 'semana_ciclo', '¿En qué semana de su ciclo se encuentra?', 'mujeres', 'calidad', 'number', false, null, null, false, 12)
ON CONFLICT (id) DO NOTHING;

-- 12 condiciones: 9 generales + 3 femeninas.
