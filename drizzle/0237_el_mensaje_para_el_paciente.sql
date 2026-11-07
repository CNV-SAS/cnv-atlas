-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- EL MENSAJE PARA EL PACIENTE SE SEPARA DE LA NOTA CLINICA  ·  0237
--
-- ═══ EL DEFECTO, Y ESTABA ESCRITO EN EL CODIGO DESDE EL 6 DE NOVIEMBRE ═══
--
-- `treatment_notes.note` hacia DOS trabajos a la vez: era la nota clinica (sale en la historia clinica y
-- la leen los otros profesionales) y era ademas el texto que viajaba al PACIENTE con su informe. De ahi
-- salieron dos consecuencias malas:
--
--   1. SE LE PUSO UN TOPE DE 200 CARACTERES A UN REGISTRO CLINICO por una razon de papel: el informe
--      inicial tiene que caber en una hoja. El comentario de `MAXIMO_DE_LA_OBSERVACION` lo decia con todas
--      las letras: *"Topar un registro clinico por una razon de papel es una decision incomoda... Si algun
--      dia estorba, la salida NO es subir el tope hasta que el informe se parta: es separar la observacion
--      PARA EL PACIENTE de la nota clinica, que son dos cosas distintas. Queda en BACKLOG."*
--   2. Y LA NOTA CLINICA LE LLEGABA AL PACIENTE TAL CUAL, en el correo del informe. Se escribe para otro
--      profesional ("vigilar adherencia, sospecha de restriccion"), no para la persona.
--
-- Santiago lo cerro el 2026-11-07 (punto i de su ronda del informe): *"La nota clinica SIN tope. Campo
-- nuevo y opcional, 'Mensaje para el paciente', de 200 caracteres y con contador. Es el unico texto de la
-- profesional que va al informe. La nota clinica sigue en la HC."*
--
-- ═══ POR QUE UNA COLUMNA AQUI Y NO UNA TABLA NUEVA ═══
--
-- Las dos se escriben EN EL MISMO ACTO (la profesional cierra la consulta: anota lo clinico y, si quiere,
-- le deja una linea al paciente), asi que comparten fila, fecha y profesion. Y `treatment_notes` ya tiene
-- las tres propiedades que este dato necesita: es POR CONSULTA, es APPEND-ONLY (corregirse es escribir
-- otra, decision de Gildardo §8 del 2026-08-30) y sella la profesion con la que se escribio.
--
-- Una tabla aparte duplicaria esas tres cosas y abriria la posibilidad de que el mensaje y la nota de la
-- misma consulta terminaran con fechas distintas, que es precisamente lo que no se quiere poder explicar.
--
-- ═══ EL TOPE VIVE EN LA COLUMNA, no solo en Zod ═══
--
-- 200 caracteres es una MEDICION: es lo que cabe al final del informe con el nombre mas largo de la
-- cohorte y las cinco areas en el nivel peor (candado `el-informe-maquetado`). Declararlo en la columna
-- significa que ninguna via de escritura futura (un script, una importacion) puede dejar un mensaje que
-- parta el informe en dos hojas sin que la base lo rechace.
--
-- NULLABLE Y SIN DEFAULT: es opcional por diseño. `NULL` significa "no le dejo mensaje", y entonces el
-- informe sale solo, que es lo que ya hacia cuando no habia nota.
--
-- Forward-only y aditiva: no toca ninguna fila existente. Las notas ya escritas quedan con el mensaje en
-- NULL, y eso es lo correcto: nadie escribio nunca un mensaje para el paciente, asi que inventarles uno
-- (copiando la nota clinica) seria mandarle al paciente un texto que no se escribio para el. El efecto
-- practico es que los informes que se envien desde hoy dejan de arrastrar la nota clinica.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "treatment_notes"
  ADD COLUMN "mensaje_para_el_paciente" varchar(200);--> statement-breakpoint

COMMENT ON COLUMN "treatment_notes"."mensaje_para_el_paciente" IS
  'Opcional. El UNICO texto de la profesional que viaja al informe del paciente (0237). Tope de 200 caracteres porque es lo que cabe al final del informe sin partirlo en dos hojas, medido renderizando. La nota clinica (note) no tiene tope y no sale hacia el paciente: vive en la historia clinica. NULL = no le dejo mensaje, y el informe sale solo.';
