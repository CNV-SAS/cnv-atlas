-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- SE RETIRA `allergen_relations`  ·  2026-09-11
--
-- ── LA PREGUNTA ERA SI TIENE SENTIDO VACIA, Y NO LO TIENE ───────────────────────────────────────
--
-- La 0126 le borro las cinco filas y dejo la estructura "por si algun dia hay una regla, con firma". Ese
-- dia ya no puede llegar por la via que la tabla imagina, y por eso se retira entera.
--
-- SU UNICO PROPOSITO ES INFERIR una alergia a partir de un ingrediente, y ahora hay DOS instrucciones que
-- lo prohiben, cada una con su razon y ninguna de las dos reversible por preferencia:
--
--   · DIRECCION CIENTIFICA (27-ago, 11-sep): traducir un ingrediente a una alergia es contenido clinico
--     que el modelo ANI-BIS-E no tiene.
--   · ASESOR LEGAL (11-sep): bloquear obliga a Atlas a AFIRMAR que la alergia y el alergeno son
--     incompatibles, o sea a inferir clinicamente, y eso contradice el Anexo 3 y el consentimiento que
--     los pacientes YA FIRMARON, donde dice que Atlas no diagnostica. Esa razon no se revierte sin
--     re-consentir a todos los pacientes.
--
-- Y LO QUE SE CONSTRUYE EN SU LUGAR NO LA NECESITA: la yuxtaposicion muestra las dos declaraciones
-- textuales una al lado de la otra. No compara, asi que no tiene de donde leer una equivalencia.
--
-- ── POR QUE RETIRAR Y NO DEJARLA VACIA, que era la otra opcion ──────────────────────────────────
--
-- Una tabla vacia con un enum de tipos de equivalencia (`directa`, `por_contaminacion_cruzada`) no es
-- neutral: es un formulario. El dia que alguien quiera "solo dejar anotado que la avena arrastra gluten",
-- la tabla le dice como hacerlo y el candado de la aplicacion no la mira, porque nadie la lee. Una
-- ausencia se sostiene mejor con un documento que con una estructura vacia que invita a llenarla.
--
-- ── LO QUE SE QUEDA, Y NO ES LO MISMO ───────────────────────────────────────────────────────────
--
-- · `nutraceutical_allergens`: es lo que el producto DECLARA, y es justo el dato que la yuxtaposicion
--   muestra. Se queda y ahora si tiene lector.
-- · `allergens`: vocabulario controlado para que "avena" no se escriba de cinco formas entre productos.
--   Es higiene de catalogo, no inferencia.
-- · `survey_option_allergens`: se queda, y HOY NO TIENE LECTOR. La yuxtaposicion lee la respuesta cruda
--   de la encuesta, no su normalizacion. Se conserva porque es una IDENTIDAD (la opcion "Gluten (trigo,
--   pan, pasta)" ES el alergeno gluten: la misma cosa nombrada dos veces), no una equivalencia entre dos
--   cosas distintas, que es lo prohibido. Queda anotado como decision, no como olvido.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS "allergen_relations";--> statement-breakpoint

-- El enum queda huerfano al irse su unica tabla. Se retira con ella: un tipo `directa` /
-- `por_contaminacion_cruzada` sin nada que lo use es el mismo formulario, en otra forma.
DROP TYPE IF EXISTS "public"."allergen_relation_kind";--> statement-breakpoint

COMMENT ON TABLE "survey_option_allergens" IS
  'Identidad entre una opcion de la encuesta y el alergeno que nombra. NO es una equivalencia entre alergenos distintos: esas estan prohibidas (Direccion Cientifica 2026-08-27 y 2026-09-11; asesor legal 2026-09-11) y su tabla se retiro. SIN LECTOR hoy: la yuxtaposicion lee la respuesta cruda del paciente, no esta normalizacion.';--> statement-breakpoint

COMMENT ON TABLE "nutraceutical_allergens" IS
  'Lo que el producto DECLARA, textual, como lo dice la ficha del fabricante. Se muestra COMPLETO junto a lo que declaro el paciente, sin compararlos (modelo comercial 7.7, texto del asesor legal 2026-09-11).';
