import { z } from "zod";

// Validacion de la config de IA que edita el admin (B14). El proveedor es un enum cerrado
// (los que sabe hablar el provider); el modelo es texto libre (cada proveedor tiene su
// catalogo). Las API keys NUNCA viajan por aqui: viven solo en el entorno.

export const AI_PROVIDERS = ["groq", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

// Catalogo curado de modelos por proveedor. Acota la eleccion del admin a modelos que
// pertenecen al proveedor: evita el footgun de guardar gemini con un modelo de groq (o al
// reves), que hace fallar la llamada y caer al fallback en silencio. El modelo del entorno se
// agrega ademas en el servidor (modelsForProvider), asi el modelo desplegado siempre es valido
// aunque este catalogo se quede corto.
export const AI_MODEL_CATALOG: Record<AiProviderId, readonly string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
};

export const saveAiConfigSchema = z.object({
  activeProvider: z.enum(AI_PROVIDERS),
  activeModel: z
    .string()
    .trim()
    .min(1, "Indica el modelo.")
    .max(100, "El nombre del modelo es demasiado largo."),
});

export type SaveAiConfigInput = z.infer<typeof saveAiConfigSchema>;

// Prompts versionados que el admin puede editar. Hoy solo el de menu; enum cerrado para no
// crear claves arbitrarias. El contenido es SOLO el bloque de instrucciones de sistema
// (barrera PII: el mensaje de usuario con los objetivos se arma en codigo, no aqui).
export const AI_PROMPT_KEYS = ["menu.generate"] as const;

export const savePromptSchema = z.object({
  promptKey: z.enum(AI_PROMPT_KEYS),
  content: z
    .string()
    .trim()
    .min(20, "Las instrucciones son demasiado cortas.")
    .max(20000, "Las instrucciones son demasiado largas."),
});

export type SavePromptInput = z.infer<typeof savePromptSchema>;
