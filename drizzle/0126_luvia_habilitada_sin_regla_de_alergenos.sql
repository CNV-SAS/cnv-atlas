-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LUVIA SE HABILITA, Y LAS EQUIVALENCIAS DE ALERGENOS SE RETIRAN  ·  Bloque 1  ·  2026-09-11
--
-- ── POR QUE, Y POR QUE ES UNA CORRECCION NUESTRA ────────────────────────────────────────────────
--
-- La 0124 dejo LUVIA en `no_disponible` "hasta que Direccion Cientifica firme las equivalencias". No hay
-- nada que firmar: la decision se tomo el 27 de agosto ("nada de tablas de alergenos, ni de equivalencias,
-- ni de filtros"), la ejecutamos el 28, y la pregunta volvio el 11 de septiembre con otro producto de
-- ejemplo. Es la TERCERA vez que vuelve la misma pieza cerrada.
--
-- Su respuesta del 11 de septiembre, punto 4: "La retencion de LUVIA estaba atada a esta firma. Sin firma
-- pendiente, no hay nada que esperar: se porta como esta en mi archivo, con `disponible: true` y el
-- alergeno que declara su ficha."
--
-- ── LO QUE SE RETIRA, Y LO QUE SE QUEDA ─────────────────────────────────────────────────────────
--
-- SE RETIRAN LAS CINCO EQUIVALENCIAS. Las cinco son contenido clinico que escribimos nosotros y que su
-- archivo no tiene. Dos las nego por su nombre: la avena ("no hay regla, ni directa ni con certificacion")
-- y leche/lactosa ("son dos preguntas distintas y el paciente contesta cada una; la distincion es del
-- paciente, no de un cruce entre la encuesta y la ficha de un producto"). Las otras tres son de la misma
-- clase: traducir un ingrediente a una alergia. Precedente del 27 de agosto, aplicado tal cual: una
-- propuesta nuestra que su archivo no tiene se RETIRA, no se defiende.
--
-- SE QUEDAN LAS TABLAS, VACIAS DE REGLAS. `allergens` es un catalogo de nombres, no una regla.
-- `survey_option_allergens` dice "esta opcion de la encuesta es este alergeno", que es una etiqueta sobre
-- lo que el paciente eligio, no una deduccion sobre lo que un producto contiene. Y `allergen_relations`
-- queda como estructura sin filas: el dia que exista una regla, tendra donde vivir, con firma.
--
-- SE QUEDA `nutraceutical_allergens` con LUVIA declarando avena, porque es lo que dice la ficha del
-- fabricante. Lo que se le quita es la NOTA, que anadia la deduccion ("se trata como gluten").
--
-- ── EL CONFLICTO QUE ESTA MIGRACION NO RESUELVE ─────────────────────────────────────────────────
--
-- La §7.7 del modelo comercial, que paso revision legal, exige lo contrario: bloqueo activo con
-- confirmacion y registro. No es una decision cientifica, es de responsabilidad de CNV frente al
-- consumidor, y va al asesor legal (`docs/entregas/RESUMEN_LEGAL_ALERGENO_LUVIA.md`). Mientras tanto
-- manda su instruccion, que es la que gobierna el contenido clinico.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LUVIA SE VENDE ────────────────────────────────────────────────────────────────────────────
--
-- `en_consultorio` es el unico valor que abre las dos puertas: el checkout de /pagos y el despacho. Las
-- dos las cerraba la misma bandera, asi que esta linea las abre juntas y no queda media puerta.
UPDATE "nutraceuticals"
   SET "commercial_availability" = 'en_consultorio'
 WHERE "name" = 'LUVIA';--> statement-breakpoint

-- ── 2. LA NOTA DEL ALERGENO PIERDE LA DEDUCCION ─────────────────────────────────────────────────
--
-- Queda lo que declara la ficha y nada mas. El texto que se muestra es "Contiene avena", como en su
-- archivo, sin el "(gluten)" que el mismo retiro del suyo: "el error era de mi archivo; el (gluten) y el
-- todavia sugerian un cruce pendiente que nunca aprobe".
UPDATE "nutraceutical_allergens"
   SET "notes" = 'Declarado en la ficha del fabricante. Se muestra tal como ella lo declara.',
       "absence_certified_for" = NULL
 WHERE "nutraceutical_id" = (SELECT "id" FROM "nutraceuticals" WHERE "name" = 'LUVIA');--> statement-breakpoint

-- ── 3. LAS EQUIVALENCIAS SE RETIRAN ─────────────────────────────────────────────────────────────
--
-- Un DELETE sin WHERE seria mas corto y diria menos: estas cinco filas son las que sembro la 0123, y
-- borrar "todo lo que haya" taparia una fila que alguien hubiera anadido despues.
DELETE FROM "allergen_relations" ar
 USING "allergens" o, "allergens" d
 WHERE ar."source_id" = o."id" AND ar."target_id" = d."id"
   AND (o."code", d."code") IN (
     ('trigo', 'gluten'), ('cebada', 'gluten'), ('centeno', 'gluten'),
     ('avena', 'gluten'), ('leche', 'lactosa')
   );
