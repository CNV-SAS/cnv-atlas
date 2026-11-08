-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- CON QUE INSTRUMENTO SE LE PIDIO LA ENCUESTA A ESTA CONSULTA  ·  2026-11-08
--
-- ═══ EL DEFECTO QUE CIERRA, Y NO ES TEORICO ═══
--
-- La encuesta publica se sirve en UNA sola carga: la pagina trae las preguntas y el formulario pasa de
-- la firma a la encuesta SIN volver al servidor. Asi que el instrumento queda decidido en el momento en
-- que se pinta la pagina.
--
-- Y hay un camino en el que la pagina NO PUEDE saberlo: el enlace del consultorio (generico y
-- reusable). Ahi el paciente escribe su cedula DESPUES, y si resulta ser uno que ya existe, Atlas crea
-- un SEGUIMIENTO. La pagina ya habia pintado la encuesta completa.
--
-- Si la accion de envio resolviera el instrumento por su cuenta (tipo de la consulta + paciente de
-- prueba), diria CNV-S sobre un formulario que nunca mostro el Modulo S: la respuesta quedaria con la
-- ETIQUETA de un instrumento que no se aplico. Un dato falso, no un dato que falta.
--
-- ═══ LA SALIDA: SE DECIDE UNA VEZ Y SE SELLA ═══
--
-- El instrumento es una propiedad de la CONSULTA, no algo que cada lector deduzca. Se decide cuando se
-- crea el shell (que es el momento en que ya se sabe que se le pinto al paciente) y se sella aqui. Las
-- cuatro acciones y las tres pantallas lo LEEN.
--
-- NULL = la linea base. Es el valor de todas las consultas anteriores a hoy y el de todo lo que no
-- resuelva otra cosa: el peor caso tiene que ser "se le aplica la encuesta completa", que es lo que
-- siempre es correcto. Un paciente que responde de mas no pierde ningun dato; uno al que se le aplica la
-- CNV-S sin poder confirmar su linea base pierde cuatro items para siempre.
--
-- NO SE RELLENA HACIA ATRAS, por la razon de siempre: poner "CNV v2.0" en 652 consultas afirmaria que
-- alguien eligio ese instrumento para cada una, y nadie eligio nada. NULL dice lo que pasa: no habia
-- instrumentos cuando se hicieron.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "evaluations"
  ADD COLUMN IF NOT EXISTS "survey_instrument_id" uuid REFERENCES "survey_instruments"("id");--> statement-breakpoint

COMMENT ON COLUMN "evaluations"."survey_instrument_id" IS
  'Con que instrumento se le pidio la encuesta a esta consulta (0243). Se decide y se sella al crear el shell, porque la encuesta publica se sirve en una sola carga y el instrumento queda fijado al pintar la pagina. NULL = linea base (todas las anteriores a 2026-11-08, y todo lo que no resuelva otra cosa).';
