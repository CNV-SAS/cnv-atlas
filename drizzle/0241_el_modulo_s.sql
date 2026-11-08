-- MODULO S E INSTRUMENTO DE SEGUIMIENTO (CNV-S 1.0), ADITIVO Y FORWARD-ONLY.
--
-- GENERADO por scripts/gen-cnvs-migration.mjs desde supabase/seed.ts. NO editar a mano: el seed es la
-- fuente unica del contenido y esto se deriva de el.
--
-- NO ACTIVA NADA. `CNVS_ACTIVA` esta en false, asi que ningun paciente ve este instrumento: lo que
-- esta migracion hace es dejar el contenido en la base para que el smoke pueda encenderlo en local.
--
-- POR QUE EL MODULO S VA EN SU PROPIA VERSION: cuatro lectores enumeran las preguntas POR VERSION
-- para medir completitud, el gate del diagnostico entre ellos. Siete preguntas mas en la version del
-- cuestionario le habrian sumado siete huecos a TODAS las encuestas de linea base, y el gate habria
-- dicho "faltan 7" a todo el mundo sin que nada fallara.
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING en todas las tablas.

-- LA SECCION DEL ITEM: lo UNICO que un instrumento cambia de una pregunta. En el seguimiento los ocho
-- items que se confirman van juntos en su propio paso ("Confirmar") y no repartidos por sus dominios,
-- que es el orden de su anexo A. NULL = se usa la seccion de la pregunta, que es el caso de la linea
-- base y por eso la columna es nula y no tiene valor por defecto.
ALTER TABLE "survey_instrument_items" ADD COLUMN IF NOT EXISTS "seccion" text;

INSERT INTO survey_templates (id, name, description) VALUES
  ('55555555-5555-5555-5555-5555555555a1', 'Módulo S de la Encuesta CNV-S', 'Las siete preguntas PROPIAS de la encuesta de seguimiento (S1 a S6 y el filtro digestivo). Viven en su propia version para que los lectores que enumeran por version no las cuenten como huecos de la linea base.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_versions (id, template_id, version_number) VALUES
  ('55555555-5555-5555-5555-5555555555a2', '55555555-5555-5555-5555-5555555555a1', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (id, survey_version_id, question_text, question_type, field_key, hint, section, order_index, data_class, used_in_diagnosis) VALUES
  ('33fd1c49-138c-5998-8313-476d121084f4', '55555555-5555-5555-5555-5555555555a2', '¿Con qué frecuencia lo tomó?', 'opcion_por_producto', 'cnvs_s1', 'Una respuesta por cada producto que se le indicó en la consulta anterior.', 'Módulo S', 1, 'clinical', false),
  ('79f73b4f-96da-5aa4-8011-924d72612486', '55555555-5555-5555-5555-5555555555a2', 'Si no lo tomó como se indicó, ¿por qué?', 'opcion_por_producto', 'cnvs_s2', 'Solo para los productos que no tomó todos los días ni 5 o más días por semana.', 'Módulo S', 2, 'clinical', false),
  ('2d9c30f1-4f0e-5f10-87d7-7c2135c0341d', '55555555-5555-5555-5555-5555555555a2', '¿En qué medida siguió el plan de alimentación indicado?', 'opcion', 'cnvs_s3', null, 'Módulo S', 3, 'clinical', false),
  ('7894ad41-595a-5a60-8186-4db9ae7a9ae5', '55555555-5555-5555-5555-5555555555a2', 'Desde la última consulta, ¿ha tenido alguno de estos eventos?', 'opcion_multiple', 'cnvs_s4', null, 'Módulo S', 4, 'clinical', false),
  ('bd0ce779-f181-577c-8955-8603915ab82f', '55555555-5555-5555-5555-5555555555a2', '¿Ha intentado cambiar su peso desde la última consulta?', 'opcion', 'cnvs_s5', null, 'Módulo S', 5, 'clinical', false),
  ('1c292ae0-f212-578d-8632-5989c573f8ad', '55555555-5555-5555-5555-5555555555a2', 'Desde la última consulta, ¿cómo describiría el cambio en su estado de salud general?', 'opcion', 'cnvs_s6', null, 'Cierre', 6, 'clinical', false),
  ('9ff45201-4ac4-587c-844c-7c803674b034', '55555555-5555-5555-5555-5555555555a2', 'En las últimas dos semanas, ¿ha tenido algún síntoma digestivo (hinchazón, gases, dolor, diarrea, estreñimiento, reflujo o náuseas)?', 'opcion', 'cnvs_gi_filtro', null, 'Alergias y digestión', 7, 'clinical', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_options (id, question_id, option_text, value, order_index) VALUES
  ('a046f315-2d2f-5b11-884a-d080464baf1f', '33fd1c49-138c-5998-8313-476d121084f4', 'Todos los días', null, 1),
  ('48af4854-c4a7-505d-8a95-a84eaca64d60', '33fd1c49-138c-5998-8313-476d121084f4', '5 o más días por semana', null, 2),
  ('1e083280-5816-525f-87a6-bd0ac3e6d55f', '33fd1c49-138c-5998-8313-476d121084f4', 'Menos de 5 días por semana', null, 3),
  ('3ef6e169-2471-5451-8a18-dfb5e4b4989b', '33fd1c49-138c-5998-8313-476d121084f4', 'No lo tomó', null, 4),
  ('2d18f2e2-92cd-5778-8456-629d9a4a1b44', '33fd1c49-138c-5998-8313-476d121084f4', 'Lo suspendió', null, 5),
  ('16e11996-2df9-523d-8c28-db648af2a616', '79f73b4f-96da-5aa4-8011-924d72612486', 'Olvido', null, 1),
  ('87f901a2-a5c6-5d32-8e7b-11cf06c86b00', '79f73b4f-96da-5aa4-8011-924d72612486', 'Costo', null, 2),
  ('bf169868-a7c3-5012-8081-9c8f89f6fae9', '79f73b4f-96da-5aa4-8011-924d72612486', 'Molestia digestiva u otro efecto', null, 3),
  ('887b88cf-3001-5938-8e70-ab81323c9b42', '79f73b4f-96da-5aa4-8011-924d72612486', 'No vio cambios', null, 4),
  ('16c26a72-81f2-5afa-8ecc-bf75ab90859f', '79f73b4f-96da-5aa4-8011-924d72612486', 'Otro', null, 5),
  ('75339ab0-50fe-510c-864b-3921b2104fb6', '2d9c30f1-4f0e-5f10-87d7-7c2135c0341d', 'Nada', null, 1),
  ('92322e46-52aa-54e6-8c92-80a909bdc975', '2d9c30f1-4f0e-5f10-87d7-7c2135c0341d', 'Poco', null, 2),
  ('9b6625ef-4c18-5ce9-88c9-08ec0f3a7da6', '2d9c30f1-4f0e-5f10-87d7-7c2135c0341d', 'La mitad', null, 3),
  ('45e5b36a-e591-56bc-85ed-ced1b70d38f7', '2d9c30f1-4f0e-5f10-87d7-7c2135c0341d', 'Casi todo', null, 4),
  ('c8e07064-1373-58e7-8b08-6cc848e1e9cb', '2d9c30f1-4f0e-5f10-87d7-7c2135c0341d', 'Todo', null, 5),
  ('bd9cf7a6-989d-52c8-85cb-211a85fa185f', '7894ad41-595a-5a60-8186-4db9ae7a9ae5', 'Enfermedad aguda (fiebre, infección, diarrea)', null, 1),
  ('9fb4958f-b53d-5d2b-8cc0-8aa3332b7cb9', '7894ad41-595a-5a60-8186-4db9ae7a9ae5', 'Hospitalización o cirugía', null, 2),
  ('8cd8f21b-fc85-51e0-824b-8712c8294912', '7894ad41-595a-5a60-8186-4db9ae7a9ae5', 'Medicamento nuevo', null, 3),
  ('5ae4d196-9e21-5658-824f-6af2666ec3e5', '7894ad41-595a-5a60-8186-4db9ae7a9ae5', 'Embarazo o lactancia', null, 4),
  ('528ada8b-a409-527b-85d1-be900eee9615', '7894ad41-595a-5a60-8186-4db9ae7a9ae5', 'Cambio de turno o de trabajo', null, 5),
  ('5ebfc134-0690-5977-883e-61f724485191', '7894ad41-595a-5a60-8186-4db9ae7a9ae5', 'Evento estresante mayor', null, 6),
  ('1acfc688-4dd6-5dbb-8846-2e3f91dd15b1', '7894ad41-595a-5a60-8186-4db9ae7a9ae5', 'Ninguno', null, 7),
  ('2917ef5d-7937-583b-8caf-06140b8e4b49', 'bd0ce779-f181-577c-8955-8603915ab82f', 'No', null, 1),
  ('41c3ea14-7339-59b4-8538-2eee2b918b55', 'bd0ce779-f181-577c-8955-8603915ab82f', 'Sí, bajar', null, 2),
  ('96f8556b-b4d3-508c-8db8-6fe0208d53cd', 'bd0ce779-f181-577c-8955-8603915ab82f', 'Sí, subir', null, 3),
  ('74fa4ab3-c50f-56ac-8a92-f9918f9ee95f', '1c292ae0-f212-578d-8632-5989c573f8ad', 'Muchísimo mejor', null, 1),
  ('b0d16095-d308-536e-825f-0c0c736af0c8', '1c292ae0-f212-578d-8632-5989c573f8ad', 'Mucho mejor', null, 2),
  ('cb591ee0-0e87-5f22-8f89-1cf63670e2e4', '1c292ae0-f212-578d-8632-5989c573f8ad', 'Un poco mejor', null, 3),
  ('4f1251cf-bfce-5c05-8c4c-6215ffcdd38b', '1c292ae0-f212-578d-8632-5989c573f8ad', 'Sin cambios', null, 4),
  ('4236aa9c-ac9b-547f-8caa-ebf8afa968a0', '1c292ae0-f212-578d-8632-5989c573f8ad', 'Un poco peor', null, 5),
  ('1d5d7898-b747-5500-8d06-7e536de569dc', '1c292ae0-f212-578d-8632-5989c573f8ad', 'Mucho peor', null, 6),
  ('d03f68ef-ef45-5a0c-87a9-224afa901b43', '1c292ae0-f212-578d-8632-5989c573f8ad', 'Muchísimo peor', null, 7),
  ('58634f2f-fa6d-516f-8339-004b15b33663', '9ff45201-4ac4-587c-844c-7c803674b034', 'Sí', null, 1),
  ('84bfb3a6-51a8-517e-8ad9-b941b4299473', '9ff45201-4ac4-587c-844c-7c803674b034', 'No', null, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_instruments (id, codigo, nombre, descripcion) VALUES
  ('aa000000-0000-4000-8000-000000000002', 'CNV-S 1.0', 'Encuesta CNV-S (seguimiento)', 'La version de seguimiento: repite, confirma, retira y añade el Módulo S. Apunta a LAS MISMAS preguntas de la línea base, que es la invariancia de su §7.4.')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO survey_instrument_items (instrument_id, question_id, comportamiento, filtro_question_id, seccion, order_index) VALUES
  ('aa000000-0000-4000-8000-000000000002', '33fd1c49-138c-5998-8313-476d121084f4', 'propio', null, 'Módulo S', 1),
  ('aa000000-0000-4000-8000-000000000002', '79f73b4f-96da-5aa4-8011-924d72612486', 'propio', null, 'Módulo S', 2),
  ('aa000000-0000-4000-8000-000000000002', '2d9c30f1-4f0e-5f10-87d7-7c2135c0341d', 'propio', null, 'Módulo S', 3),
  ('aa000000-0000-4000-8000-000000000002', '7894ad41-595a-5a60-8186-4db9ae7a9ae5', 'propio', null, 'Módulo S', 4),
  ('aa000000-0000-4000-8000-000000000002', 'bd0ce779-f181-577c-8955-8603915ab82f', 'propio', null, 'Módulo S', 5),
  ('aa000000-0000-4000-8000-000000000002', '94ef4be3-08cd-5aa2-88e3-0f079fd1d06a', 'confirmar', null, 'Confirmar', 6),
  ('aa000000-0000-4000-8000-000000000002', '6de5236e-9c20-5446-84c7-04df86f849de', 'confirmar', null, 'Confirmar', 7),
  ('aa000000-0000-4000-8000-000000000002', 'c2af638d-68bf-592b-86e7-78db8b9e9353', 'confirmar', null, 'Confirmar', 8),
  ('aa000000-0000-4000-8000-000000000002', '044fc357-67ae-59ad-8440-89df652bc9bc', 'confirmar', null, 'Confirmar', 9),
  ('aa000000-0000-4000-8000-000000000002', 'db2b13c5-03fc-52f8-8b10-8de50f3bdc04', 'confirmar', null, 'Confirmar', 10),
  ('aa000000-0000-4000-8000-000000000002', '93a29b28-5edb-5462-8fc8-bca7d4193c24', 'confirmar', null, 'Confirmar', 11),
  ('aa000000-0000-4000-8000-000000000002', '78011837-5ddc-59f2-855c-bb6bc5003996', 'confirmar', null, 'Confirmar', 12),
  ('aa000000-0000-4000-8000-000000000002', '53957c7b-76c0-5ce4-87fb-a17a50d9aef7', 'confirmar', null, 'Confirmar', 13),
  ('aa000000-0000-4000-8000-000000000002', '0c62c754-4b7d-5d67-8168-1b98f3bf92df', 'repetir', null, 'Alimentación', 14),
  ('aa000000-0000-4000-8000-000000000002', '1e54221a-aa62-54c4-8d83-d7abe266c426', 'repetir', null, 'Alimentación', 15),
  ('aa000000-0000-4000-8000-000000000002', '0a5e5582-f2b5-573e-8769-d8166bb734f3', 'repetir', null, 'Alimentación', 16),
  ('aa000000-0000-4000-8000-000000000002', '23aed6bf-c7dc-5194-8783-5f43be6a7585', 'repetir', null, 'Alimentación', 17),
  ('aa000000-0000-4000-8000-000000000002', '904477df-44c1-5f4d-8367-64ee0794defc', 'repetir', null, 'Alimentación', 18),
  ('aa000000-0000-4000-8000-000000000002', 'fe4df98c-4b9c-5ada-8a89-1d0373c7dbb5', 'repetir', null, 'Alimentación', 19),
  ('aa000000-0000-4000-8000-000000000002', '0bb094ef-fe2e-514e-8f4b-98cf9d9e4b0e', 'repetir', null, 'Alimentación', 20),
  ('aa000000-0000-4000-8000-000000000002', 'cfdac03e-9e60-5c50-8368-6173524c9fe4', 'repetir', null, 'Alimentación', 21),
  ('aa000000-0000-4000-8000-000000000002', 'ffebdf3c-20f4-5d87-8bd7-421d01622a68', 'repetir', null, 'Alimentación', 22),
  ('aa000000-0000-4000-8000-000000000002', '73dc09b2-6a33-5191-81ac-a366f8648d96', 'repetir', null, 'Alimentación', 23),
  ('aa000000-0000-4000-8000-000000000002', 'cc94bde5-6791-52f6-840a-bc4a8e89ff78', 'repetir', null, 'Alimentación', 24),
  ('aa000000-0000-4000-8000-000000000002', '1d2728f4-ec2d-5613-8046-6e6990cb08c1', 'repetir', null, 'Alimentación', 25),
  ('aa000000-0000-4000-8000-000000000002', 'c31ac552-a1ad-51cf-89f2-e4aff5411ee2', 'repetir', null, 'Alimentación', 26),
  ('aa000000-0000-4000-8000-000000000002', '74a1c7e7-7769-5254-867b-7910540b9129', 'repetir', null, 'Alimentación', 27),
  ('aa000000-0000-4000-8000-000000000002', 'f8e469be-5fb9-5f01-8d45-1a4d62a17644', 'repetir', null, 'Alimentación', 28),
  ('aa000000-0000-4000-8000-000000000002', '92d582fe-64bf-5200-8c39-9c68e170f072', 'repetir', null, 'Alimentación', 29),
  ('aa000000-0000-4000-8000-000000000002', '643edaaf-76e9-5850-84cd-4d8a2b957fe6', 'repetir', null, 'Alimentación', 30),
  ('aa000000-0000-4000-8000-000000000002', 'fabd570b-2056-5d56-8955-08283b815af9', 'repetir', null, 'Alimentación', 31),
  ('aa000000-0000-4000-8000-000000000002', '996d18be-a1f1-5507-8a25-5ee4dc023714', 'repetir', null, 'Percepción corporal', 32),
  ('aa000000-0000-4000-8000-000000000002', '96f81ae2-eeb7-5e63-824a-bd4868b42764', 'repetir', null, 'Percepción corporal', 33),
  ('aa000000-0000-4000-8000-000000000002', 'ddeffd59-d0b0-51bf-8147-e2d691ea8d62', 'repetir', null, 'Percepción corporal', 34),
  ('aa000000-0000-4000-8000-000000000002', '0119a87e-6993-59b1-890d-10c5557fe651', 'repetir', null, 'Percepción corporal', 35),
  ('aa000000-0000-4000-8000-000000000002', '2e068f64-a3f3-57c4-874a-c3df6f7b3c8a', 'repetir', null, 'Hábitos', 36),
  ('aa000000-0000-4000-8000-000000000002', 'eaf9d2e1-bce6-5694-8196-73b8b1bed767', 'repetir', null, 'Hábitos', 37),
  ('aa000000-0000-4000-8000-000000000002', 'f7a430d2-fe39-5033-8efb-b6d34e580031', 'repetir', null, 'Hábitos', 38),
  ('aa000000-0000-4000-8000-000000000002', '61ca6f95-98b6-5e35-8096-ed6f8b7af6ee', 'repetir', null, 'Hábitos', 39),
  ('aa000000-0000-4000-8000-000000000002', 'a7616156-b727-530f-881d-8c48a41c7325', 'repetir', null, 'Hábitos', 40),
  ('aa000000-0000-4000-8000-000000000002', '74837f79-6452-5a0c-8ba8-9bc44b47ec4f', 'repetir', null, 'Hábitos', 41),
  ('aa000000-0000-4000-8000-000000000002', '5cede2f7-e275-5a0a-80c3-27575062fdb9', 'repetir', null, 'Hábitos', 42),
  ('aa000000-0000-4000-8000-000000000002', '39aa398d-2cf6-52fe-8b3c-28405d082195', 'repetir', null, 'Hábitos', 43),
  ('aa000000-0000-4000-8000-000000000002', 'e80b5209-b729-547d-83d1-c667ae5d3017', 'repetir', null, 'Conductas alimentarias', 44),
  ('aa000000-0000-4000-8000-000000000002', 'bcf08aaf-6640-5bba-86ad-827254265cb9', 'repetir', null, 'Conductas alimentarias', 45),
  ('aa000000-0000-4000-8000-000000000002', '9cf45ec4-a774-5d01-8739-338516768026', 'retirar', null, 'Conductas alimentarias', 46),
  ('aa000000-0000-4000-8000-000000000002', '04692285-22e1-58ee-833b-ccfd3bde0b7a', 'repetir', null, 'Antecedentes y estilo de vida', 47),
  ('aa000000-0000-4000-8000-000000000002', '39daceba-0cb7-5e05-8a06-8486e8cc00da', 'repetir', null, 'Antecedentes y estilo de vida', 48),
  ('aa000000-0000-4000-8000-000000000002', 'e9970fb1-05af-5243-80dd-2d67e915a7a7', 'retirar', null, 'Antecedentes y estilo de vida', 49),
  ('aa000000-0000-4000-8000-000000000002', 'e9ff97c7-213e-5d6e-8fbc-04629e9172df', 'retirar', null, 'Antecedentes y estilo de vida', 50),
  ('aa000000-0000-4000-8000-000000000002', '2717667f-2bb8-5232-844e-2df252301d2a', 'retirar', null, 'Alergias y digestión', 51),
  ('aa000000-0000-4000-8000-000000000002', '9ff45201-4ac4-587c-844c-7c803674b034', 'propio', null, 'Alergias y digestión', 52),
  ('aa000000-0000-4000-8000-000000000002', '63ff9256-7b52-5590-8148-88a4ccffcafd', 'repetir_con_filtro', '9ff45201-4ac4-587c-844c-7c803674b034', 'Alergias y digestión', 53),
  ('aa000000-0000-4000-8000-000000000002', 'b59dae06-06a2-5d10-879d-31e7b7b33755', 'repetir_con_filtro', '9ff45201-4ac4-587c-844c-7c803674b034', 'Alergias y digestión', 54),
  ('aa000000-0000-4000-8000-000000000002', '3ad892e7-62c8-5093-8353-593b33f01a6d', 'repetir_con_filtro', '9ff45201-4ac4-587c-844c-7c803674b034', 'Alergias y digestión', 55),
  ('aa000000-0000-4000-8000-000000000002', '6ccd36b0-0e39-5c7b-884a-a5420c85d395', 'repetir_con_filtro', '9ff45201-4ac4-587c-844c-7c803674b034', 'Alergias y digestión', 56),
  ('aa000000-0000-4000-8000-000000000002', 'a1d1864e-96e0-57bd-8e6e-e816f7e34497', 'repetir_con_filtro', '9ff45201-4ac4-587c-844c-7c803674b034', 'Alergias y digestión', 57),
  ('aa000000-0000-4000-8000-000000000002', '2c3169d1-e783-5de9-8705-d0211f345c65', 'repetir_con_filtro', '9ff45201-4ac4-587c-844c-7c803674b034', 'Alergias y digestión', 58),
  ('aa000000-0000-4000-8000-000000000002', '31391e49-92c4-59cc-873d-e8ceb7f04671', 'repetir_con_filtro', '9ff45201-4ac4-587c-844c-7c803674b034', 'Alergias y digestión', 59),
  ('aa000000-0000-4000-8000-000000000002', 'cd210ad6-077d-5db8-8f39-f51435217e11', 'repetir', null, 'Hidratación', 60),
  ('aa000000-0000-4000-8000-000000000002', '637a29fb-82a9-5a8b-8533-c30b5a7be0e7', 'repetir', null, 'Hidratación', 61),
  ('aa000000-0000-4000-8000-000000000002', 'abca68d8-3342-5cb8-813f-9853b0b22dfc', 'repetir', null, 'Hidratación', 62),
  ('aa000000-0000-4000-8000-000000000002', 'f28c9b5d-b8f3-58e1-8ac9-56026bc54fce', 'repetir', null, 'Hidratación', 63),
  ('aa000000-0000-4000-8000-000000000002', '5555f7d2-61b9-5dc1-8253-47f7db39d041', 'repetir', null, 'Hidratación', 64),
  ('aa000000-0000-4000-8000-000000000002', '9ecfc24e-d5fb-5181-87c7-c20695b64e35', 'repetir', null, 'Hidratación', 65),
  ('aa000000-0000-4000-8000-000000000002', '82156324-8590-5fba-886c-0d9529b33465', 'repetir', null, 'Hidratación', 66),
  ('aa000000-0000-4000-8000-000000000002', 'ef5f26e7-fbc7-59f5-83a0-b57331734293', 'repetir', null, 'Hidratación', 67),
  ('aa000000-0000-4000-8000-000000000002', '94d04490-f9e8-51cd-8b98-8ce48181a192', 'repetir', null, 'Contexto social', 68),
  ('aa000000-0000-4000-8000-000000000002', '522243c5-6111-50fa-8a23-1cd41dd9ddec', 'repetir', null, 'Contexto social', 69),
  ('aa000000-0000-4000-8000-000000000002', '729a5c86-ea13-5515-82ce-b7d56910348d', 'repetir', null, 'Contexto social', 70),
  ('aa000000-0000-4000-8000-000000000002', '1c292ae0-f212-578d-8632-5989c573f8ad', 'propio', null, 'Cierre', 71)
ON CONFLICT (instrument_id, question_id) DO NOTHING;

-- 7 preguntas propias, 34 opciones, 71 items (propio: 7, confirmar: 8, repetir: 45, retirar: 4, repetir_con_filtro: 7).
