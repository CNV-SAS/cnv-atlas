-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL MAPEO DE ALERGENOS COBRE TAMBIEN LAS VERSIONES VIEJAS DE LA ENCUESTA
-- Bloque 1  ·  2026-09-11
--
-- ── EL HUECO, Y COMO SE ENCONTRO ─────────────────────────────────────────────────────────────────
--
-- La migracion 0123 mapeo las opciones de P43 y P44 a sus alergenos buscandolas POR SU TEXTO. Y el texto
-- de P44 CAMBIO entre versiones de encuesta:
--
--   · v2, v3 y v5:  "Gluten"                        "Lactosa"                     "Fructosa"
--   · v6 (vigente): "Gluten (trigo, pan, pasta)"    "Lactosa (leche y lácteos)"   "Fructosa (frutas, miel)"
--
-- Los ejemplos entre parentesis los añadio Direccion Cientifica el 3 de septiembre, con su motivo escrito:
-- "la P44 pregunta por sustancias y el paciente responde con alimentos".
--
-- CONSECUENCIA: quedaron mapeadas SOLO las opciones de la v6. Un paciente que respondio P44 en v2, v3 o v5
-- declarando "Gluten" no habria sido reconocido, y el bloqueo NO habria saltado para el. Y eso afecta
-- justamente a los pacientes MAS ANTIGUOS, que es donde nadie iba a mirar.
--
-- P43 no lo sufre: sus opciones no cambiaron de texto entre versiones.
--
-- ── LA LECCION, porque es una que este proyecto ya conocia ───────────────────────────────────────
--
-- La fila mapeada SE ANCLA al id de la opcion, que es lo correcto y se decidio a proposito. Pero el INSERT
-- que ENCUENTRA esas filas buscaba por texto, y el texto es justo lo que se mueve entre versiones. Anclar
-- bien el resultado no sirve si la busqueda que lo produce usa la cosa inestable.
--
-- Lo destapo un cotejo de conteos entre local y la nube (31 contra 38): las cifras no cuadraban por el
-- numero de versiones, y al desglosarlas por version aparecio que d6_44 solo mapeaba en una.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

INSERT INTO "survey_option_allergens" ("survey_option_id", "allergen_id")
SELECT so."id", a."id"
  FROM "survey_options" so
  JOIN "survey_questions" sq ON sq."id" = so."question_id"
  JOIN (VALUES
    -- Los textos PLANOS de v2, v3 y v5. Los de v6 ya los mapeo la 0123.
    ('d6_44', 'Lactosa',  'lactosa'),
    ('d6_44', 'Gluten',   'gluten'),
    ('d6_44', 'Fructosa', 'fructosa')
  ) AS m("field_key", "option_text", "allergen_code")
    ON m."field_key" = sq."field_key" AND m."option_text" = so."option_text"
  JOIN "allergens" a ON a."code" = m."allergen_code"
ON CONFLICT ("survey_option_id", "allergen_id") DO NOTHING;
