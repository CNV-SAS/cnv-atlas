-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL INSTRUMENTO DE LA ENCUESTA, SEPARADO DE SU VERSION  ·  v15 §2, 2026-11-07
--
-- ═══ EL PROBLEMA QUE RESUELVE, QUE ES EL UNICO DE DISEÑO DE LA CNV-S ═══
--
-- Su v15 §2.2, textual: *"En ATLAS CNV, como las preguntas salen de la base de datos (supabase/seed.ts),
-- la CNV-S debe **apuntar a las mismas preguntas** y no duplicarlas con otro texto."* Y su §7.4 dice por
-- que: INVARIANCIA. Un item que se repite se presenta con el mismo enunciado, las mismas opciones y el
-- mismo puntaje que la linea base, o lo que se compara entre dos consultas deja de ser lo mismo.
--
-- En Atlas una pregunta es una fila de `survey_questions` que pertenece a UNA `survey_version`. Hacer de
-- la CNV-S una version nueva obligaria a COPIAR las 64 preguntas con sus opciones, y entonces:
--
--   · hay dos textos para la misma pregunta, que se separan en cuanto alguien edite uno;
--   · el `field_key` se repite en dos filas, y el motor congelado lee por `field_key`;
--   · el candado `patron-coupling` pasaria a vigilar una copia en vez del instrumento que corre.
--
-- ═══ LA SALIDA: EL INSTRUMENTO ES UNA CAPA SOBRE LA VERSION, NO OTRA VERSION ═══
--
-- Se separan dos cosas que hoy son una sola:
--
--   `survey_versions`      QUE preguntas hay, con su texto y sus opciones. No cambia.
--   `survey_instruments`   COMO se aplican esas preguntas en una consulta. Nueva.
--
-- Las dos filas de instrumento (`CNV v2.0` y, cuando llegue, `CNV-S 1.0`) apuntan A LAS MISMAS PREGUNTAS,
-- y `survey_instrument_items` dice, por instrumento y por pregunta, que hace esa pregunta. Un solo texto
-- por pregunta y un solo `field_key`: la invariancia deja de ser una regla que alguien tiene que recordar
-- y pasa a ser que NO HAY dos textos que se puedan separar.
--
-- ═══ ESTA MIGRACION NO CAMBIA NADA DE LO QUE HOY CORRE ═══
--
-- Crea las dos tablas y siembra el instrumento de la LINEA BASE con TODAS las preguntas de la version
-- vigente, en su mismo orden. Nadie lo lee todavia. El lector pasa a usarlo en el commit siguiente, y su
-- candado compara la lista de preguntas por los dos caminos: tienen que salir identicas.
--
-- OJO AL DESPLEGAR: va a la nube ANTES del push, como todas. Aqui con una razon extra, que es la de
-- DEPLOY.md: en cuanto el lector pase a leer por instrumento, una base sin estas filas deja la encuesta
-- del paciente sin preguntas.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "survey_instruments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- EL CODIGO ES EL QUE SE GUARDA EN LOS DATOS, y es suyo: "CNV v2.0" y "CNV-S 1.0". Su propia nota dice
  -- que en pantalla se lee "Encuesta CNV v3.0" y en los datos se guarda "CNV v2.0"; por eso son dos
  -- columnas y no una.
  "codigo" text NOT NULL,
  "nombre" text NOT NULL,
  "descripcion" text,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "survey_instruments_codigo_unique" UNIQUE("codigo")
);--> statement-breakpoint

COMMENT ON TABLE "survey_instruments" IS
  'COMO se aplica un cuestionario en una consulta, separado de QUE preguntas tiene (survey_versions). Dos instrumentos (CNV v2.0 de linea base y CNV-S 1.0 de seguimiento) apuntan a LAS MISMAS filas de survey_questions, que es lo que hace estructural la invariancia que pide la v15 §7.4: no hay dos textos de la misma pregunta que se puedan separar.';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "survey_instrument_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instrument_id" uuid NOT NULL REFERENCES "survey_instruments"("id") ON DELETE CASCADE,
  "question_id" uuid NOT NULL REFERENCES "survey_questions"("id") ON DELETE CASCADE,
  -- LOS CINCO COMPORTAMIENTOS DE SU TABLA 3, con sus nombres. `propio` es el quinto y no esta en su
  -- tabla: es el Modulo S y el filtro digestivo, que PERTENECEN al instrumento de seguimiento y no
  -- existen en la linea base.
  --
  -- CHECK Y NO ENUM: un enum de Postgres no se puede quitar un valor, y esta lista todavia puede moverse
  -- mientras la CNV-S no este activa. El CHECK la cierra igual contra un valor inventado.
  "comportamiento" text NOT NULL,
  -- LA PREGUNTA FILTRO de un `repetir_con_filtro`. Su §7.2: los sintomas digestivos (45 a 51) van detras
  -- de una pregunta de si/no. Va por FK y no por una bandera: el filtro es UNA pregunta concreta, y
  -- escribirla como booleano obligaria a buscarla por su texto.
  "filtro_question_id" uuid REFERENCES "survey_questions"("id"),
  "order_index" integer NOT NULL,
  CONSTRAINT "survey_instrument_items_comportamiento_check" CHECK (
    "comportamiento" IN ('repetir', 'repetir_con_filtro', 'confirmar', 'retirar', 'propio')
  ),
  -- UNA FILA POR PREGUNTA EN CADA INSTRUMENTO: sin esto, una pregunta podria ser a la vez `confirmar` y
  -- `retirar`, y el lector elegiria una de las dos sin que nada fallara.
  CONSTRAINT "survey_instrument_items_question_unique" UNIQUE("instrument_id", "question_id"),
  CONSTRAINT "survey_instrument_items_order_unique" UNIQUE("instrument_id", "order_index")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "survey_instrument_items_instrument_idx"
  ON "survey_instrument_items" ("instrument_id", "order_index");--> statement-breakpoint

COMMENT ON TABLE "survey_instrument_items" IS
  'Que hace cada pregunta en cada instrumento (tabla 3 de la CNV-S): repetir, repetir_con_filtro, confirmar, retirar o propio del instrumento. El orden de presentacion sale de aqui y no del order_index de la pregunta, porque la CNV-S presenta el Modulo S antes de D1.';--> statement-breakpoint

-- ── LAS COLUMNAS DE TRAZABILIDAD DE LA RESPUESTA (su §2.7) ────────────────────────────────────────
--
-- SOLO LAS QUE NO SE PUEDEN DERIVAR. Su lista nombra tambien `cnvs_s1`…`cnvs_s6`, `cnvs_gi_filtro`,
-- `cnvsNoComparable` y `cnvsAdherenciaAdecuada`. Las cuatro primeras son RESPUESTAS, y en Atlas una
-- respuesta vive en `survey_answers`: darles columna seria el mismo dato en dos sitios que pueden
-- divergir. Las dos ultimas son DERIVADAS de esas respuestas con una regla suya, y se calculan con una
-- sola funcion al leerlas, que es la regla de la casa (una definicion por hecho).
--
-- Y `instrumentoEncuesta` tampoco es columna: se deriva de `instrument_id`, que es quien lo sabe.
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "instrument_id" uuid REFERENCES "survey_instruments"("id");--> statement-breakpoint
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "minutos_de_diligenciamiento" integer;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "confirmacion" jsonb;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "reconfirmacion_anual_at" timestamp with time zone;--> statement-breakpoint

COMMENT ON COLUMN "survey_responses"."instrument_id" IS
  'Con que instrumento se aplico esta encuesta. NULL en las anteriores a la 0240: son todas de linea base, y no se rellenan hacia atras porque eso afirmaria sobre una encuesta pasada algo que nadie decidio entonces.';--> statement-breakpoint
COMMENT ON COLUMN "survey_responses"."confirmacion" IS
  'Por cada item de la CNV-S que se presenta para confirmar: su estado (sin_cambios, editado, sin_marcar). v15 §2.7.';--> statement-breakpoint
COMMENT ON COLUMN "survey_responses"."reconfirmacion_anual_at" IS
  'Cuando se hizo la reconfirmacion anual completa en esta encuesta. NULL = no se hizo. Es la fecha y no un booleano porque lo que la regla anual necesita saber es CUANDO fue la ultima confirmacion completa, no si hubo alguna.';--> statement-breakpoint

-- ── EL INSTRUMENTO DE LA LINEA BASE, SEMBRADO DE LO QUE YA HAY ────────────────────────────────────
--
-- SE DERIVA DE LA BASE Y NO SE ESCRIBE A MANO: los 64 ids de pregunta son deterministas pero dependen de
-- la version vigente, y una lista pegada aqui se desincroniza en el primer bump sin que nada falle. El
-- INSERT ... SELECT no se puede desincronizar: toma lo que haya.
--
-- `repetir` para las 64 porque en la linea base no hay nada que confirmar ni que retirar: toda pregunta
-- se presenta. Es el mismo verbo de su tabla 3 y no un sinonimo nuestro, para que haya una sola lista de
-- comportamientos y no dos vocabularios.
INSERT INTO "survey_instruments" ("id", "codigo", "nombre", "descripcion")
VALUES (
  'aa000000-0000-4000-8000-000000000001',
  'CNV v2.0',
  'Encuesta CNV v3.0',
  'La encuesta completa de la primera consulta (linea base). El codigo es el que se guarda en los datos y el nombre el que se lee en pantalla: su propia nota del 30 de octubre pide las dos cosas distintas.'
)
ON CONFLICT ("codigo") DO NOTHING;--> statement-breakpoint

INSERT INTO "survey_instrument_items" ("instrument_id", "question_id", "comportamiento", "order_index")
SELECT 'aa000000-0000-4000-8000-000000000001', q."id", 'repetir', q."order_index"
  FROM "survey_questions" q
 WHERE q."survey_version_id" = (
         SELECT v."id" FROM "survey_versions" v ORDER BY v."published_at" DESC, v."id" DESC LIMIT 1
       )
ON CONFLICT ("instrument_id", "question_id") DO NOTHING;
