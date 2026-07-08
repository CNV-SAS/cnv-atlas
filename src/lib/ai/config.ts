import "server-only";

import { AiError, type AiConfig, type AiProvider } from "./provider";

// Resuelve el proveedor/modelo de IA activos. En B12 la fuente es el entorno (GROQ_MODEL /
// GEMINI_MODEL): Groq primario con Gemini de fallback si ambas keys existen, o el que este
// configurado. El override por BD (tabla ai_config, admin) se cablea en B14 con su UI; esa
// tabla es admin-only por RLS, asi que no se lee desde el flujo del profesional aqui.

export function resolveAiConfig(): AiConfig {
  const groqModel = process.env.GROQ_MODEL;
  const geminiModel = process.env.GEMINI_MODEL;
  const hasGroq = Boolean(process.env.GROQ_API_KEY && groqModel);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && geminiModel);

  if (hasGroq) {
    return {
      provider: "groq" as AiProvider,
      model: groqModel as string,
      fallback: hasGemini ? { provider: "gemini", model: geminiModel as string } : undefined,
    };
  }
  if (hasGemini) {
    return { provider: "gemini" as AiProvider, model: geminiModel as string };
  }
  throw new AiError(
    "IA no configurada: falta GROQ_API_KEY+GROQ_MODEL o GEMINI_API_KEY+GEMINI_MODEL.",
  );
}
