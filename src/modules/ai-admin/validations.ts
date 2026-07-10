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
