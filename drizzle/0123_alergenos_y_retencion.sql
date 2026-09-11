-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- ALERGENOS (SE CONSTRUYE, NO SE ENCIENDE) Y LO QUE FALTABA DEL PERFIL TRIBUTARIO
-- Bloque 1  ·  2026-09-11
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. EL PERFIL TRIBUTARIO: NO HACIA FALTA UNA TABLA, FALTABA UN CAMPO ──────────────────────────
--
-- El plan decia "professional_tax_profiles" como pieza pendiente. Al ir a construirla resulta que el
-- perfil YA EXISTE, repartido en catorce columnas de `professional_profiles` (tipo de persona, documento
-- con DV, responsable de IVA, obligado a facturar, RUT con su verificacion, y la cuenta bancaria con el
-- documento de su titular). Crear una tabla nueva habria sido crear una SEGUNDA fuente del mismo dato.
--
-- De lo que pide la seccion 9 del modelo comercial faltaba UNA cosa: si el Integrante es AGENTE DE
-- RETENCION. Importa bajo modalidad Distribucion, donde es EL quien le retiene a CNV (§4.1), asi que sin
-- este dato no se puede anticipar el neto de su factura.
ALTER TABLE "professional_profiles"
  ADD COLUMN IF NOT EXISTS "tax_is_withholding_agent" boolean;--> statement-breakpoint

-- EL ACUMULADO ANUAL NO ENTRA AQUI, y conviene decir por que en vez de dejar el hueco mudo.
--
-- El modelo lo pide para controlar el umbral de tarifa de retencion, y la adicion (d) fijo que se reinicia
-- por AÑO CALENDARIO. Pero el acumulado es "comisiones PAGADAS", y hoy no existe el concepto de pago: las
-- liquidaciones son el Bloque 4. Guardarlo ahora seria un contador que nadie incrementa, o peor, que
-- alguien incrementa a mano.
--
-- Cuando exista la liquidacion, el acumulado se DERIVA de ella por año (`sum` de lo liquidado entre el 1
-- de enero y la fecha), no se guarda: un contador y su fuente son dos cifras que pueden discrepar, y esta
-- gobierna cuanto se le retiene a una persona.

-- ── 2. ALERGENOS: LA ESTRUCTURA ENTERA, SIN ENCENDER ─────────────────────────────────────────────
--
-- POR QUE HACE FALTA. LUVIA declara AVENA; el paciente declara "Gluten (trigo, pan, pasta)" o "Trigo".
-- Ninguna de esas cadenas contiene a la otra, asi que cotejar textos deja pasar a un celiaco. Es el mismo
-- fallo que "lactosa" contra "lacteos" en el menu, con una consecuencia peor.
--
-- Y LA RELACION NO ES BINARIA, que fue la correccion de Santiago: la avena por si sola no tiene gluten,
-- pero arrastra contaminacion cruzada con trigo salvo que este certificada. La regla correcta es
-- "avena implica gluten SALVO certificacion", no "avena = gluten".

CREATE TABLE IF NOT EXISTS "allergens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clave canonica en minusculas y sin tildes: 'gluten', 'lactosa', 'mani'. Es la que compara el motor.
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "allergen_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id" uuid NOT NULL REFERENCES "allergens"("id") ON DELETE cascade,
  "target_id" uuid NOT NULL REFERENCES "allergens"("id") ON DELETE cascade,
  -- 'directa': siempre implica (trigo -> gluten).
  -- 'por_contaminacion_cruzada': implica SALVO que el producto declare certificacion de ausencia
  -- (avena -> gluten). Es el matiz que una equivalencia binaria no podia expresar.
  "kind" text NOT NULL,
  "notes" text,
  -- ═══ LA FIRMA ES DATO, NO UN INTERRUPTOR ═══
  --
  -- El bloqueo solo considera relaciones FIRMADAS. Una fila sin firma es una PROPUESTA: existe, se puede
  -- revisar y no gobierna nada. Asi "construido pero no encendido" es una propiedad de cada fila y no una
  -- bandera global que alguien pueda voltear entera por error.
  --
  -- Y LA RAZON DE PEDIR LA FIRMA ES DURA: si un celiaco recibe LUVIA porque la tabla decia que la avena no
  -- implica gluten, el problema es de CNV, que lo prescribio y lo facturo.
  "signed_at" timestamp with time zone,
  "signed_by" uuid REFERENCES "profiles"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "allergen_relations_kind_valido" CHECK ("kind" IN ('directa', 'por_contaminacion_cruzada')),
  CONSTRAINT "allergen_relations_no_refleja" CHECK ("source_id" <> "target_id"),
  CONSTRAINT "allergen_relations_unica" UNIQUE ("source_id", "target_id"),
  -- Firmar es un acto de alguien: no se puede tener fecha sin firmante ni al reves.
  CONSTRAINT "allergen_relations_firma_completa" CHECK (
    ("signed_at" IS NULL AND "signed_by" IS NULL) OR ("signed_at" IS NOT NULL AND "signed_by" IS NOT NULL)
  )
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "nutraceutical_allergens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nutraceutical_id" uuid NOT NULL REFERENCES "nutraceuticals"("id") ON DELETE cascade,
  "allergen_id" uuid NOT NULL REFERENCES "allergens"("id") ON DELETE restrict,
  -- VERBATIM DE LA FICHA DEL FABRICANTE. Se guarda aparte del alergeno canonico porque lo que el producto
  -- DICE y lo que eso IMPLICA son dos cosas, y la primera no la decidimos nosotros.
  "declared_as" text NOT NULL,
  -- CERTIFICACION DE AUSENCIA del alergeno destino, p. ej. "avena sin gluten certificada". Cuando esta,
  -- las relaciones por contaminacion cruzada dejan de implicar. Nulo = no certificado.
  "absence_certified_for" uuid REFERENCES "allergens"("id"),
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "nutraceutical_allergens_unica" UNIQUE ("nutraceutical_id", "allergen_id")
);--> statement-breakpoint

-- ── EL PUENTE CON LA ENCUESTA, ANCLADO AL ID DE LA OPCION ───────────────────────────────────────
--
-- NO A LA ETIQUETA. Si Gildardo reescribe "Gluten (trigo, pan, pasta)", un cotejo por texto se apagaria en
-- silencio; el id de la opcion no cambia por una reescritura, y ademas ya lleva su version de encuesta
-- dentro (las opciones cuelgan de la pregunta, y la pregunta de la version).
CREATE TABLE IF NOT EXISTS "survey_option_allergens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "survey_option_id" uuid NOT NULL REFERENCES "survey_options"("id") ON DELETE cascade,
  "allergen_id" uuid NOT NULL REFERENCES "allergens"("id") ON DELETE restrict,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "survey_option_allergens_unica" UNIQUE ("survey_option_id", "allergen_id")
);--> statement-breakpoint

-- ── 3. EL CATALOGO PROPUESTO, SIN FIRMAR ────────────────────────────────────────────────────────
--
-- Es la tabla que va en la consulta a Direccion Cientifica (docs/entregas/CONSULTA_GILDARDO_ALERGENOS.md).
-- Entra SIN FIRMA: existe para revisarse, y hasta que se firme no bloquea nada.
INSERT INTO "allergens" ("code", "name") VALUES
  ('gluten',   'Gluten'),
  ('trigo',    'Trigo'),
  ('avena',    'Avena'),
  ('cebada',   'Cebada'),
  ('centeno',  'Centeno'),
  ('leche',    'Leche'),
  ('lactosa',  'Lactosa'),
  ('huevo',    'Huevo'),
  ('mani',     'Maní'),
  ('soya',     'Soya'),
  ('pescado',  'Pescado'),
  ('mariscos', 'Mariscos'),
  ('fructosa', 'Fructosa')
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint

INSERT INTO "allergen_relations" ("source_id", "target_id", "kind", "notes")
SELECT o."id", d."id", v."kind", v."notes"
  FROM (VALUES
    ('trigo',   'gluten',  'directa',                   'El trigo contiene gluten.'),
    ('cebada',  'gluten',  'directa',                   'La cebada contiene gluten.'),
    ('centeno', 'gluten',  'directa',                   'El centeno contiene gluten.'),
    -- EL CASO QUE ENSEÑA EL PROBLEMA, y el unico que no es una equivalencia.
    ('avena',   'gluten',  'por_contaminacion_cruzada', 'La avena por sí sola no contiene gluten, pero arrastra contaminación cruzada con trigo salvo que esté certificada. PENDIENTE DE FIRMA.'),
    ('leche',   'lactosa', 'directa',                   'La leche contiene lactosa. PENDIENTE: ¿al revés también? Ver pregunta 2 de la consulta.')
  ) AS v("origen", "destino", "kind", "notes")
  JOIN "allergens" o ON o."code" = v."origen"
  JOIN "allergens" d ON d."code" = v."destino"
ON CONFLICT ("source_id", "target_id") DO NOTHING;--> statement-breakpoint

-- El puente con las opciones VIGENTES de P43 y P44. Se resuelve por `field_key`, que es el identificador
-- estable de la pregunta, y por el texto de la opcion DENTRO de esa pregunta.
INSERT INTO "survey_option_allergens" ("survey_option_id", "allergen_id")
SELECT so."id", a."id"
  FROM "survey_options" so
  JOIN "survey_questions" sq ON sq."id" = so."question_id"
  JOIN (VALUES
    ('d6_43', 'Leche',                      'leche'),
    ('d6_43', 'Huevo',                      'huevo'),
    ('d6_43', 'Maní',                       'mani'),
    ('d6_43', 'Trigo',                      'trigo'),
    ('d6_43', 'Soya',                       'soya'),
    ('d6_43', 'Pescado',                    'pescado'),
    ('d6_43', 'Mariscos',                   'mariscos'),
    ('d6_44', 'Lactosa (leche y lácteos)',  'lactosa'),
    ('d6_44', 'Gluten (trigo, pan, pasta)', 'gluten'),
    ('d6_44', 'Fructosa (frutas, miel)',    'fructosa')
  ) AS m("field_key", "option_text", "allergen_code")
    ON m."field_key" = sq."field_key" AND m."option_text" = so."option_text"
  JOIN "allergens" a ON a."code" = m."allergen_code"
ON CONFLICT ("survey_option_id", "allergen_id") DO NOTHING;--> statement-breakpoint

-- "Ninguna" y "Otra" NO SE MAPEAN, y las dos ausencias son deliberadas y distintas:
--   · "Ninguna" no es un alergeno: es la declaracion de que no hay.
--   · "Otra" es TEXTO LIBRE y no se puede cotejar con ninguna tabla. Su tratamiento no es "no bloquea":
--     es que un paciente que respondio "Otra" EXIGE la misma confirmacion que si hubiera coincidencia,
--     aplicando la conducta de Gildardo del 30 de agosto (un dato que falta no entra al calculo como si
--     fuera una respuesta favorable). Eso vive en el codigo, no aqui.

-- ── 4. RLS ───────────────────────────────────────────────────────────────────────────────────────
--
-- LAS CUATRO SE LEEN POR CUALQUIER AUTENTICADO: el bloqueo corre mientras un profesional prescribe, asi
-- que tiene que poder leerlas. Escribirlas es de admin: son contenido clinico firmado.
ALTER TABLE "allergens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "allergen_relations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nutraceutical_allergens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "survey_option_allergens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "allergens_select" ON "allergens" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "allergens_write" ON "allergens" FOR ALL TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));--> statement-breakpoint
CREATE POLICY "allergen_relations_select" ON "allergen_relations" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "allergen_relations_write" ON "allergen_relations" FOR ALL TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));--> statement-breakpoint
CREATE POLICY "nutraceutical_allergens_select" ON "nutraceutical_allergens" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "nutraceutical_allergens_write" ON "nutraceutical_allergens" FOR ALL TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));--> statement-breakpoint
CREATE POLICY "survey_option_allergens_select" ON "survey_option_allergens" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "survey_option_allergens_write" ON "survey_option_allergens" FOR ALL TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));
