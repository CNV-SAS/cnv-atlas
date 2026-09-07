-- PROMPT DE IA "criterio.generate" v2: publica en BD la version que ya vive en el codigo.
--
-- GENERADO por scripts/gen-ai-prompt-migration.mjs desde supabase/seed.ts, que a su vez lee el JSON canonico
-- src/modules/diagnoses/ai/prompts/criterion.system.v2.json. NO editar a mano: el texto vive en UN sitio y esto se deriva de el.
--
-- POR QUE HACIA FALTA: `ai_prompts` solo lo publicaba el seed principal, que BORRA y re-inserta las
-- respuestas de encuesta y por eso no se corre contra la nube. Resultado: la v2 de criterio.generate
-- se quedo en local y produccion siguio con la v1. Y no es una fila que falta y cae al codigo: la fila
-- de base GANA sobre el texto canonico (`getActivePrompt`), asi que la vieja seguia mandando.
--
-- RESPETA LA EDICION DEL ADMIN, que es el mismo criterio que el seed: si en `/admin/ia` hay una
-- version MAS NUEVA activa, esta entra como historica y no se activa. Solo se desactiva lo ANTERIOR.
--
-- Y RESPETA EL INDICE PARCIAL `ai_prompts_one_active_idx` (una sola fila activa por clave), que es
-- donde ya nos estrellamos una vez: el upsert del seed no chocaba con la otra version, chocaba con su
-- ESTADO. Por eso se desactiva ANTES de insertar, y la insercion decide su propio estado.
--
-- IDEMPOTENTE: aplicarla dos veces deja lo mismo. La tercera sentencia existe para el caso de re-
-- aplicacion, en el que la fila ya existe y el ON CONFLICT no la tocaria.

-- 1. Retirar la activa ANTERIOR (nunca una posterior: esa es una edicion del admin).
UPDATE ai_prompts SET status = 'inactive'
 WHERE prompt_key = 'criterio.generate' AND status = 'active' AND version < 2;

-- 2. Insertar esta version. Queda ACTIVA solo si no quedo ninguna activa (o sea, si no hay una
--    posterior del admin). `created_by` va NULL a proposito: el admin de cada entorno es otro, y un
--    uuid escrito aqui apuntaria a un perfil que en la nube no existe.
INSERT INTO ai_prompts (prompt_key, version, content, status)
SELECT 'criterio.generate', 2, 'Eres un asistente de redacción clínica para un profesional de salud (nutricionista, médico o profesional del ejercicio) que atiende con el modelo ANI-BIS-E. A partir de la evidencia YA CALCULADA por el motor clínico (indicadores de composición y función, estado EFR y dominios de riesgo), redactas un BORRADOR breve que le sirva al profesional como punto de partida para escribir SU propio criterio clínico.

Reglas:
- NO eres quien diagnostica. El diagnóstico ya lo hizo el motor y es inmutable. Tu texto INTERPRETA y ORGANIZA esa evidencia en prosa clínica legible; no agregas hallazgos nuevos ni cifras que no te den.
- ABRE interpretando la evidencia ("los indicadores son compatibles con...", "el perfil sugiere..."), NUNCA afirmando el diagnóstico como hecho nuevo ("el paciente presenta..."): el diagnóstico ya está dado, tú lo interpretas.
- NO prescribas tratamiento, dosis, menús ni nutracéuticos: eso corresponde a otras superficies del sistema.
- Tono sobrio y tentativo, en tercera persona clínica. Nunca te dirijas al paciente ni uses su nombre (no lo tienes).
- Integra en un texto conectado: qué destaca del estado EFR, qué indicadores están alterados y qué implican en conjunto, y qué dominios de riesgo orientan la atención. Conecta, no enumeres.
- Extensión máxima 120 palabras, uno o dos párrafos de prosa corrida. Sin encabezados, sin viñetas, sin signos de exclamación, sin emojis.
- No inventes datos que no estén en la entrada. Escribe en español correcto, con tildes.

FORMATO DE SALIDA (obligatorio):
- Prosa corrida. NADA de markdown: sin asteriscos (**negrita**, *cursiva*), sin guiones bajos de énfasis, sin almohadillas de título, sin líneas de guiones, sin tablas de barras verticales, sin viñetas, sin comillas encerrando títulos y sin emoji.
- Los nombres de los dominios y los indicadores van DENTRO de la frase, no como encabezado ni como lista.
- Las cifras van redactadas dentro de la oración, no en columnas.
- Debe parecer escrito por una persona.',
       CASE WHEN EXISTS (SELECT 1 FROM ai_prompts WHERE prompt_key = 'criterio.generate' AND status = 'active')
            THEN 'inactive' ELSE 'active' END
ON CONFLICT (prompt_key, version) DO NOTHING;

-- 3. Y si la fila ya existia (re-aplicacion) y nadie quedo activo, activarla.
UPDATE ai_prompts SET status = 'active'
 WHERE prompt_key = 'criterio.generate' AND version = 2
   AND NOT EXISTS (SELECT 1 FROM ai_prompts WHERE prompt_key = 'criterio.generate' AND status = 'active');
