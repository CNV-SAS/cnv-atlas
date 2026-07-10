import { z } from "zod";

// Validacion de la config de IA que edita el admin (B14). El proveedor es un enum cerrado
// (los que sabe hablar el provider); el modelo es texto libre (cada proveedor tiene su
// catalogo). Las API keys NUNCA viajan por aqui: viven solo en el entorno.

export const AI_PROVIDERS = ["groq", "gemini"] as const;

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
