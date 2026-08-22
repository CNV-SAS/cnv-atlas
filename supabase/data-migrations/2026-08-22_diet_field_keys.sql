-- MIGRACION ADITIVA DE METADATO: field_key para los 5 campos del parrafo de dieta del Resumen Clinico (1b),
-- sobre la encuesta v5 YA SEMBRADA. NO es un bump de version: no cambia lo que el paciente ve ni responde,
-- solo marca field_key para que esos campos (que el paciente ya contesta) LLEGUEN al Resumen Clinico de
-- Tratamiento. Sin field_key, el reader los filtraba y el parrafo salia incompleto en silencio.
--
-- APLICACION: a MANO contra la nube (Supabase -> SQL Editor -> pegar -> Run), NO por `pnpm db:migrate`
-- (drizzle migra SCHEMA, no datos). Idempotente por `field_key is null`: re-correrlo no hace nada.
--
-- SEGURIDAD (d7_agua): el frozen LEE d7_agua, pero SOLO con LE8_MAPEO_CORREGIDO=true; hoy esta en false
-- (P-04), asi que d7_agua entra al input del motor SIN efecto en el diagnostico (probado en
-- diet-fields-engine-inert.test: dfi/indicadores/le8Total identicos). Los otros cuatro el frozen no los lee.
-- OJO: cuando Gildardo active Q26 y flipee el switch a true, d7_agua empezara a alimentar el motor y eso
-- SERA un cambio de diagnostico: baja la EB-BIS (edad bioelectrica) 1-8 años (su propio comentario, vigente
-- L6520-6528). El field_key ya existe, asi que el dato fluira solo al voltear el switch. Ver la nota en
-- src/clinical-engine/frozen/engine.dfi.js y DECISIONES_ANIBISE P-01.
--
-- used_in_diagnosis queda en false (default): estos campos NO gatean dfi.complete.

update survey_questions set field_key = 'd8_59'
  where survey_version_id = '55555555-5555-5555-5555-555555555555'
    and question_text = '¿Quién prepara sus alimentos habitualmente?' and field_key is null;

update survey_questions set field_key = 'd8_60'
  where survey_version_id = '55555555-5555-5555-5555-555555555555'
    and question_text = '¿Con qué frecuencia come fuera de casa?' and field_key is null;

update survey_questions set field_key = 'd7_agua'
  where survey_version_id = '55555555-5555-5555-5555-555555555555'
    and question_text = 'Agua (vasos de 200 ml por día)' and field_key is null;

update survey_questions set field_key = 'd7_55'
  where survey_version_id = '55555555-5555-5555-5555-555555555555'
    and question_text = 'Gaseosas (vasos por día)' and field_key is null;

update survey_questions set field_key = 'd7_56'
  where survey_version_id = '55555555-5555-5555-5555-555555555555'
    and question_text = 'Bebidas energéticas (latas por día)' and field_key is null;
