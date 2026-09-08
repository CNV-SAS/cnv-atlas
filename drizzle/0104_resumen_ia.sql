-- RESUMEN DEL DIAGNOSTICO (IA). Aditiva, forward-only.
--
-- POR QUE. El campo del criterio del profesional estaba haciendo DOS trabajos y por eso salto el limite
-- de 2.000 caracteres al portar el paso 4 de su Analisis IA: se diseño para una nota corta del
-- profesional y ahora recibia un resumen del modelo. El limite no era el defecto, era la señal.
--
-- VERIFICADO EN SU ARCHIVO (v8 del 4 de septiembre) antes de separarlo:
--   · su "Resumen del Diagnostico" se pinta en un <div>, NO en un textarea: el profesional no lo edita;
--   · y SI SE GUARDA (`onUpdate({ analisisIA })`, rehidratado con `enc.analisisIA`), asi que no se
--     regenera al volver a la pantalla. Por eso tiene columna propia y no se recalcula al leer.
--
-- REEMPLAZABLE: regenerar sustituye. No es append-only como `diagnosis_notes`, porque no es un acto del
-- profesional que alguien asume, es la salida de una herramienta. La traza de cada generacion (proveedor,
-- modelo, version de prompt, texto crudo, latencia) sigue viviendo en `ai_criterion_suggestions`, que es
-- inmutable; aqui solo vive el VIGENTE.
--
-- Y `diagnosis_notes` NO SE TOCA NI SE MIGRA. Guarda criterios que un profesional escribio y ASUMIO al
-- guardar (3 filas en produccion, 2 con asistencia de IA). Mover su contenido aqui seria reescribir el
-- acto de otro, y ademas son append-only por diseño. Se conservan y se muestran en solo lectura.
--
-- LO QUE ESTA MIGRACION NO TRAE, y conviene que quede escrito porque estuvo dentro y se saco: una columna
-- `treatments.observaciones`. Las observaciones del profesional YA EXISTEN en Atlas, y mejor de lo que yo
-- las iba a hacer: `treatment_notes`, por consulta, APPEND-ONLY, con la profesion sellada en el acto
-- (Gildardo 2026-08-30 §8) y visibles en la historia clinica desde su §8.3 del 2026-08-26 ("deben
-- aparecer en la historia, y POR CONSULTA, NO POR PACIENTE"). Una columna suelta y mutable habria sido
-- una CUARTA superficie de nota que ademas reintroducia el defecto que el mismo diagnostico en su
-- archivo: una nota que pisa a la anterior.
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS ai_summary text;

COMMENT ON COLUMN diagnoses.ai_summary IS
  'Resumen del diagnostico generado por IA (porte del paso 4 de su Analisis IA). Lo escribe el modelo, el profesional NO lo edita, y regenerar lo REEMPLAZA. Sin limite de longitud: no es una nota, es un documento. La traza de cada generacion vive aparte, en ai_criterion_suggestions.';
