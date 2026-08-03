-- Field_keys de los campos que leen los motores de TRATAMIENTO (d3_29 estres, d5_40 medicamentos,
-- d7_57 sed). Ya existen como preguntas de la encuesta; se les setea field_key para que lleguen a los
-- motores medico/ejercicio/psico/nutricional. NO se toca used_in_diagnosis (queda false, como se
-- sembraron con engine=false): asi reciben field_key pero NO entran a expectedFieldKeys ni gatean
-- dfi.complete (que mide la completitud del DIAGNOSTICO, no de la encuesta; verificado que el frozen
-- de diagnostico no los lee). Ver docs/PLAN_FIELDKEYS_TRATAMIENTO.md.
--
-- Idempotente (solo donde field_key es null) y forward-only, sin DROP. Se identifican por
-- question_text exacto (contenido estable de la encuesta), no por un id derivado.
update survey_questions set field_key = 'd3_29'
  where question_text = 'Nivel de estrés en el último mes (1 = sin estrés, 10 = máximo)' and field_key is null;--> statement-breakpoint
update survey_questions set field_key = 'd5_40'
  where question_text = '¿Qué medicamentos toma actualmente?' and field_key is null;--> statement-breakpoint
update survey_questions set field_key = 'd7_57'
  where question_text = '¿Siente sed con frecuencia?' and field_key is null;
