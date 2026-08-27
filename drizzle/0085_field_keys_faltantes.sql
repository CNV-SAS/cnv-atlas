-- Las 25 preguntas que el paciente responde y el motor nunca ve.
--
-- POR QUE. El `field_key` es lo que hace que una respuesta pase del formulario al objeto que
-- consumen los motores: el reader consulta POR field_key, asi que una pregunta sin el se muestra,
-- se responde, se guarda en la historia y es invisible para todo lo que calcula. Sin error, sin
-- sintoma. Hoy estan asi 25 de las 64 preguntas, incluidas las alergias y el patron alimentario:
-- el generador de menu le puede proponer mariscos a un alergico y carne a un vegano. Gildardo lo
-- aprobo en su 3.2 del 2026-08-26 (alergias a los cuatro profesionales, y como RESTRICCION en
-- nutricion). Ver DECISIONES_ANIBISE.md P-39 y P-56.
--
-- ALCANCE DE VERSIONES, EXPLICITO (leccion de la data-migration de dieta, que filtro solo v5
-- mientras el paciente real era v3): esta migracion NO filtra por version. Empareja por
-- `question_text` en TODAS las versiones donde la pregunta exista. Al escribirla habia tres:
-- v2 (24 de las 25 presentes), v3 (25) y v5 (25). Setenta y cuatro filas. Si aparece otra version
-- con esas preguntas, tambien la cubre.
--
-- IDEMPOTENTE por construccion: el `WHERE field_key IS NULL` hace que la segunda corrida no
-- encuentre nada que actualizar. Se puede correr las veces que sea.
--
-- used_in_diagnosis SE QUEDA EN false a proposito. Estas alimentan TRATAMIENTO, no el diagnostico
-- (flag `treatmentEngine` en supabase/seed.ts, no `engine`). Marcarlas como diagnosticas cambiaria
-- lo que el diagnostico dice que usa, que es una afirmacion clinica y no una consecuencia tecnica.
--
-- EFECTO SOBRE EL CALCULO: NINGUNO, y esta probado, no supuesto. src/tests/field-key-inertness.test.ts
-- corre el motor antes y despues, las 25 juntas y campo por campo, y lleva control negativo (mover
-- d3_30, que el motor si lee, TIENE que cambiar la salida). El unico matiz es d3_31: el DFI lo lee
-- en una variable muerta (`const alcohol = enc.d3_31 || ""`) que ningun calculo consume, asi que
-- conserva la intencion de Q6 (efecto cero en el diagnostico) por otro mecanismo. Dejara de ser
-- inerte cuando se porte el constructor de texto clinico de Gildardo; ver P-56b.
--
-- COMPLETITUD: dfi.complete exige que TODOS los field_key declarados esten respondidos, asi que el
-- denominador crece de 39 a 64. Medido contra la base real antes de aplicar: de 32 encuestas, 13 ya
-- estaban incompletas (no cambia nada para ellas), 19 estan completas y SIGUEN completas, y CERO
-- voltean. La razon es que el gate del intake exige las 64 respondidas, asi que toda encuesta
-- completa ya tiene contestadas estas 25.

update survey_questions
set field_key = case question_text
  -- D3 · Habitos
  when '¿Qué tipo de actividad realiza?' then 'd3_25'
  when '¿Cómo califica la calidad de su sueño?' then 'd3_27'
  when '¿Ronca durante el sueño?' then 'd3_28'
  when '¿Con qué frecuencia consume alcohol?' then 'd3_31'
  -- D4 · Conductas alimentarias (dominio entero, hoy sin un solo field_key)
  when '¿Cuántas comidas hace al día?' then 'd4_32'
  when '¿Desayuna regularmente?' then 'd4_33'
  when '¿Sigue algún patrón alimentario?' then 'd4_34'
  when '¿Qué suplementos toma actualmente?' then 'd4_35'
  -- D5 · Antecedentes
  when '¿Toma medicamentos para la presión arterial?' then 'd5_37'
  when '¿Fue amamantado/a en su infancia?' then 'd5_41'
  when '¿Exposición habitual a contaminantes?' then 'd5_42'
  -- D6 · Alergias y digestion (dominio entero, hoy sin un solo field_key)
  when '¿Alergias alimentarias diagnosticadas?' then 'd6_43'
  when '¿Intolerancias alimentarias?' then 'd6_44'
  when '¿Le han realizado alguna cirugía que afecte la digestión o el metabolismo?' then 'd6_qx'
  when 'Hinchazón abdominal' then 'd6_45'
  when 'Gases / flatulencia' then 'd6_46'
  when 'Dolor abdominal' then 'd6_47'
  when 'Diarrea' then 'd6_48'
  when 'Estreñimiento' then 'd6_49'
  when 'Reflujo / acidez' then 'd6_50'
  when 'Náuseas' then 'd6_51'
  -- D7 · Hidratacion
  when 'Café (tazas por día)' then 'd7_52'
  when 'Té (tazas por día)' then 'd7_53'
  when 'Jugos naturales (vasos por día)' then 'd7_54'
  when '¿Color de su orina habitualmente?' then 'd7_58'
end
where field_key is null
  and question_text in (
    '¿Qué tipo de actividad realiza?',
    '¿Cómo califica la calidad de su sueño?',
    '¿Ronca durante el sueño?',
    '¿Con qué frecuencia consume alcohol?',
    '¿Cuántas comidas hace al día?',
    '¿Desayuna regularmente?',
    '¿Sigue algún patrón alimentario?',
    '¿Qué suplementos toma actualmente?',
    '¿Toma medicamentos para la presión arterial?',
    '¿Fue amamantado/a en su infancia?',
    '¿Exposición habitual a contaminantes?',
    '¿Alergias alimentarias diagnosticadas?',
    '¿Intolerancias alimentarias?',
    '¿Le han realizado alguna cirugía que afecte la digestión o el metabolismo?',
    'Hinchazón abdominal',
    'Gases / flatulencia',
    'Dolor abdominal',
    'Diarrea',
    'Estreñimiento',
    'Reflujo / acidez',
    'Náuseas',
    'Café (tazas por día)',
    'Té (tazas por día)',
    'Jugos naturales (vasos por día)',
    '¿Color de su orina habitualmente?'
  );
