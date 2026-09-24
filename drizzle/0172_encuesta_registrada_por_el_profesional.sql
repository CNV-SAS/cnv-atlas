-- ══════════════════════════════════════════════════════════════════════════════════════════════════
-- QUIEN CERRO LA ENCUESTA  ·  2026-09-24
--
-- LA NECESIDAD ES DE UNA INTEGRANTE, y es real: hay pacientes que firman el consentimiento y dejan la
-- encuesta sin responder (no hay conexion, o la llenan con ella en consulta). La evaluacion queda esperando
-- y la profesional NO TENIA COMO ABRIRLA: el enlace de reanudacion solo se le muestra al paciente, y la
-- unica accion disponible en ese estado era CERRAR la evaluacion, o sea archivar un consentimiento ya
-- firmado y empezar de cero.
--
-- ── POR QUE HACE FALTA LA COLUMNA, Y NO SOLO EL BOTON ─────────────────────────────────────────────
--
-- Una encuesta que llena el profesional NO ES LA MISMA EVIDENCIA que una autodiligenciada: la seccion S de
-- la HC esta rotulada "lo que el paciente refiere", y la presencia del profesional cambia lo que la gente
-- responde, sobre todo en alcohol, tabaco y habitos. Sin esta columna las dos quedan indistinguibles, que es
-- exactamente lo que no se puede permitir.
--
-- NULA = LA RESPONDIO EL PACIENTE, que es lo que hay hoy y lo que sigue siendo el caso normal.
--
-- ── Y LA PROCEDENCIA SALE DEL CAMINO, NO DE UNA CASILLA ───────────────────────────────────────────
--
-- No hay un "marca aqui si la llenaste tu": eso puede mentir, y ademas se olvida. Se escribe desde la RUTA
-- AUTENTICADA del profesional, asi que el dato dice lo que de verdad paso. Si la encuesta la cierra el
-- paciente por su enlace, la columna queda nula sin que nadie decida nada.
--
-- ── SE ESCRIBE AL ENVIAR, NO AL GUARDAR ───────────────────────────────────────────────────────────
--
-- El caso mixto existe (el paciente responde parte en casa y ella la termina en consulta), y el envio es el
-- acto que SELLA el conjunto: las respuestas se reemplazan enteras con lo que hay en pantalla al enviar. Por
-- eso la columna significa QUIEN CERRO la encuesta, que es un hecho y no una interpretacion. Repartir la
-- autoria respuesta por respuesta seria mas fino y tambien mas facil de volver falso.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "survey_responses"
  ADD COLUMN IF NOT EXISTS "captured_by" uuid REFERENCES "profiles"("id");--> statement-breakpoint

COMMENT ON COLUMN "survey_responses"."captured_by" IS
  'Quien CERRO la encuesta cuando no fue el paciente: el profesional que la registro en consulta. Nulo = la autodiligencio el paciente.';
