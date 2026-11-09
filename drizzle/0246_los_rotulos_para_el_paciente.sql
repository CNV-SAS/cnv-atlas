-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- LOS DOS ROTULOS QUE EL PACIENTE LEE  ·  Santiago, 2026-11-09 (de su smoke de la CNV-S)
--
-- Textual: *"«Modulo S» pasa a «Seguimiento» y «Confirmar» pasa a «Confirmación». Solo el rotulo: los
-- field_key y el instrumento no cambian."*
--
-- ═══ POR QUE ═══
--
-- "Módulo S" es el nombre que el instrumento tiene en el documento de Gildardo, o sea nomenclatura
-- INTERNA: a quien contesta la encuesta no le dice nada, y leer "Módulo S" sobre un paso de la encuesta
-- se parece a ver el nombre de una variable en pantalla. "Confirmar" era un VERBO donde las otras siete
-- secciones son sustantivos ("Alimentación", "Hábitos", "Cierre"), asi que en la tira de pasos se leia
-- como un boton.
--
-- ═══ LO QUE **NO** CAMBIA, Y ES LA MITAD QUE IMPORTA ═══
--
-- Ni un `field_key` (`cnvs_s1` a `cnvs_s6` siguen igual), ni el codigo del instrumento ("CNV-S 1.0"), ni
-- el comportamiento de ningun item, ni el orden. Esto toca UNA columna de rotulo. El nombre del documento
-- de Gildardo sigue vivo donde tiene que estar: en el codigo de las preguntas, en los comentarios y en
-- `docs/`, que es donde se coteja contra su archivo.
--
-- ═══ SE CAMBIA EN LOS DOS SITIOS DONDE VIVE ═══
--
-- El rotulo que se pinta sale de `survey_instrument_items.seccion` con respaldo en
-- `survey_questions.section` (`f.seccion ?? q.section`, en `survey-reader`). Cambiar solo uno deja la
-- pantalla bien y la respuesta mal agrupada en cuanto alguien lea por version, que es justo lo que pasaba
-- con la pantalla de completar la encuesta antes de hoy.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

UPDATE survey_instrument_items SET seccion = 'Seguimiento' WHERE seccion = 'Módulo S';
UPDATE survey_instrument_items SET seccion = 'Confirmación' WHERE seccion = 'Confirmar';

-- Las preguntas PROPIAS del Modulo S llevan tambien su seccion (es el respaldo del rotulo). Se acota a
-- esa version para no tocar ninguna pregunta del cuestionario de linea base.
UPDATE survey_questions
   SET section = 'Seguimiento'
 WHERE section = 'Módulo S'
   AND survey_version_id = '55555555-5555-5555-5555-5555555555a2';
