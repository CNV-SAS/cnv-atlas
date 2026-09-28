-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LA POSOLOGIA Y EL FABRICANTE, TAL COMO LOS TIENE SU ARCHIVO  ·  2026-09-28
--
-- Santiago: "la idea es no cambiar nada", y tiene razon: la ficha de LUVIA la escribio Gildardo con las
-- especificaciones del producto, y la posologia de los VITACELLEBIS sale de su tabla NUTR_DOSIS. Es Regla 0:
-- el software representa el archivo, y lo que teniamos era una version nuestra, recortada.
--
-- ── LO QUE FALTABA, Y DE DONDE SALE CADA COSA ──
--
-- Su archivo (ATLAS_v9.html) tiene DOS tablas y una ficha:
--
--   · `NUTR_DOSIS` / `NUTR_DOSIS_HC` (L17389, L15246): por producto, `dosis` Y `frec`. Nosotros teniamos la
--     dosis partida en `serving_size` ("30 mL") y la linea en `presentation` ("liquida"), y NO teniamos la
--     frecuencia ("1 vez al dia", "Con una comida", "Antes de comidas principales"). Sin ella, el informe del
--     paciente no puede leerse como el suyo.
--   · `OTROS_PRODUCTOS` (L1306): la ficha de LUVIA, con `fabricante: "Laboratorio Naturex S.A.S."`.
--
-- ── EL FABRICANTE NO ES EL TITULAR DE MARCA, y por eso es una columna NUEVA ──
--
-- El modelo comercial lo dice sin lugar a dudas: son TRES partes que "conviene no confundir" -FABRICANTE
-- (Naturex, el maquilador), TITULAR DE MARCA (Centro de Nutricion Integral Katherine Ruiz) y TITULAR DEL
-- REGISTRO (sin dato)-. Guardar a Naturex en `brand_owner` seria machacar un dato correcto con otro correcto y
-- perder la distincion que el propio documento pide no perder.
--
-- Y LAS DOS SE MUESTRAN, que es lo que resuelve el conflicto aparente: su ficha nombra a Naturex, y la §7.7
-- obliga a mostrar el titular de marca (doctrina del fabricante aparente: el articulo 20 presume productor a
-- quien pone su marca). Mostrar las dos no cambia nada de lo suyo: se le AGREGA lo que la ley exige.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "nutraceuticals"
  -- El FABRICANTE (maquilador). Distinto de brand_owner (titular de marca) a proposito.
  ADD COLUMN IF NOT EXISTS "manufacturer" text,
  -- La FRECUENCIA de su tabla: "1 vez al dia · linea liquida", "Con una comida · linea en polvo"...
  ADD COLUMN IF NOT EXISTS "dose_frequency" text;--> statement-breakpoint

COMMENT ON COLUMN "nutraceuticals"."manufacturer" IS
  'Fabricante (maquilador), de la ficha de Gildardo. NO es brand_owner: el modelo comercial separa fabricante, titular de marca y titular del registro, y pide no confundirlos.';--> statement-breakpoint

-- ── LA POSOLOGIA, COPIADA DE SU TABLA. Se actualiza por NOMBRE porque es lo que coincide entre las dos
-- puntas, igual que hizo la 0130 con los items de Alegra. Solo los productos reales (is_test = false).
UPDATE "nutraceuticals" SET "serving_size" = v."dosis", "dose_frequency" = v."frec"
  FROM (VALUES
    ('MULTI-CELL BASE',   '30 mL/día',                  '1 vez al día · línea líquida'),
    ('OMEGA COMPLEX',     '30 mL/día',                  '1 vez al día · línea líquida'),
    ('MITO-Q10 PLUS',     '30 mL/día',                  '1 vez al día · línea líquida'),
    ('CURCUMIN BIOACTIV', '30 mL/día',                  'Con una comida · línea líquida'),
    ('BERBERINA METABO',  '30 mL, hasta 2 veces/día',   'Antes de comidas principales · línea líquida'),
    ('SARCO-PROTECT',     '25 g en 200 mL de agua',     '1 a 2 veces al día · línea en polvo'),
    ('HEPA-DETOX',        '30 mL/día',                  '1 vez al día · línea líquida'),
    ('D3-K2 OSTEO',       '10 g en 150 mL de agua',     'Con una comida · línea en polvo'),
    ('ADAPTO-STRESS',     '30 mL/día',                  'En la mañana o la tarde · línea líquida'),
    ('GUT-IMMUNE PRO',    '20 g en 150 mL de agua',     'En ayunas · línea en polvo')
  ) AS v("nombre", "dosis", "frec")
 WHERE "nutraceuticals"."name" = v."nombre" AND coalesce("nutraceuticals"."is_test", false) = false;--> statement-breakpoint

-- ── LUVIA: su ficha completa. `presentation` pasa a "Polvo · 600 g" (traia solo "polvo", sin el envase) y la
-- dosis a la frase entera de su ficha. El fabricante entra en su columna nueva.
UPDATE "nutraceuticals"
   SET "serving_size" = '1 scoop (15 g) en un vaso con agua',
       "presentation" = 'Polvo · 600 g',
       "manufacturer" = 'Laboratorio Naturex S.A.S.',
       "dose_frequency" = NULL
 WHERE "name" = 'LUVIA' AND coalesce("is_test", false) = false;--> statement-breakpoint

-- ── EL ALERGENO, TEXTUAL. Su ficha dice "Contiene avena"; nosotros guardabamos "avena", y el rotulo de la
-- pantalla acababa leyendose "Alergenos: avena" en vez de "Alergenos: Contiene avena". El alergeno se muestra
-- TAL COMO LO DECLARA LA FICHA (decision del asesor legal, 2026-09-11), asi que el texto importa.
UPDATE "nutraceutical_allergens" SET "declared_as" = 'Contiene avena'
 WHERE "nutraceutical_id" IN (SELECT "id" FROM "nutraceuticals" WHERE "name" = 'LUVIA')
   AND btrim(lower("declared_as")) = 'avena';
