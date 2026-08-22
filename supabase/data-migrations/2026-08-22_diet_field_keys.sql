-- MIGRACION ADITIVA DE METADATO: field_key para los 5 campos del parrafo de dieta del Resumen Clinico (1b).
--
-- ALCANCE DE VERSION (DECISION EXPLICITA, 2026-08-22): se aplica a TODAS las versiones de encuesta que tengan
-- estas preguntas (hoy v2, v3, v5; y cualquier v4). El match es por question_text SIN filtro de version, a
-- proposito: la primera version de esta migracion filtraba solo v5 y dejaba fuera las evaluaciones existentes
-- (Nico es v3), asi que el parrafo salia incompleto en todas las evals viejas -- el alcance v5-only fue un
-- efecto NO intencional del filtro, no una decision. Aqui el alcance "todas las versiones" es la decision.
--
-- POR QUE ES SEGURO EN VERSIONES VIEJAS (diagnosticos SELLADOS): el field_key es metadato de LECTURA, no dato
-- clinico. Los diagnosticos son snapshots inmutables en BD: dar field_key a una pregunta vieja NO re-corre el
-- motor sobre esas evals, asi que la salida sellada queda byte-identica. Y aunque algo re-corriera el motor:
-- los 5 campos entran SIN cambiar el diagnostico (before-after en diet-fields-engine-inert.test; el motor es
-- agnostico de version, la prueba cubre v2/v3/v4/v5). Lo unico que cambia es que el parrafo de dieta (computo
-- EN VIVO, nuevo) ahora aparece completo tambien en las evals viejas -- que es el fix.
--
-- APLICACION: a MANO contra la nube (Supabase -> SQL Editor -> pegar -> Run), NO por `pnpm db:migrate`
-- (drizzle migra SCHEMA, no datos). Idempotente por `field_key is null`: re-correrlo no hace nada.
--
-- SEGURIDAD (d7_agua): el frozen LEE d7_agua, pero SOLO con LE8_MAPEO_CORREGIDO=true; hoy false (P-04), asi
-- que entra al input SIN efecto. OJO: cuando Gildardo flipee el switch a true (Q26), d7_agua alimentara el
-- motor y bajara la EB-BIS 1-8 años (su comentario L6520-6528): sera un cambio de diagnostico. El field_key ya
-- existe, el dato fluira solo al voltear el switch. Ver seed.ts, engine.dfi.js y DECISIONES_ANIBISE P-01.
--
-- used_in_diagnosis queda en su valor (false para estos): NO gatean dfi.complete.

update survey_questions set field_key = 'd8_59'
  where question_text = '¿Quién prepara sus alimentos habitualmente?' and field_key is null;

update survey_questions set field_key = 'd8_60'
  where question_text = '¿Con qué frecuencia come fuera de casa?' and field_key is null;

update survey_questions set field_key = 'd7_agua'
  where question_text = 'Agua (vasos de 200 ml por día)' and field_key is null;

update survey_questions set field_key = 'd7_55'
  where question_text = 'Gaseosas (vasos por día)' and field_key is null;

update survey_questions set field_key = 'd7_56'
  where question_text = 'Bebidas energéticas (latas por día)' and field_key is null;
