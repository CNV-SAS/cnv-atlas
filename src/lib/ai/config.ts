import "server-only";

import { desc } from "drizzle-orm";

import { db } from "@/db";
import { aiConfig } from "@/db/schema";

import { AiError, type AiConfig, type AiProvider } from "./provider";

// Resuelve el proveedor/modelo de IA activos. Prioridad (B14): la config en BD (tabla
// ai_config, editable por admin) manda; si no hay fila, o el proveedor elegido no tiene su
// API key en el entorno, se cae a la resolucion por entorno. Las API keys viven SIEMPRE en el
// entorno, nunca en la BD. Se lee via Drizzle owner: el flujo del profesional necesita saber
// el proveedor sin ser admin (la RLS admin-only aplica al cliente anon, no al owner); es
// config global, no PII.
//
// Politica de fallback (Fix B14): una eleccion EXPLICITA del admin (fila en ai_config) se
// honra SIN fallback cruzado (source "db"): si su proveedor falla, debe reflejarse como fallo,
// no substituirse en silencio por el otro proveedor. El fallback silencioso queda solo para el
// default por entorno (source "env"), donde no hubo eleccion del admin.

function providerHasKey(provider: AiProvider): boolean {
  return provider === "groq"
    ? Boolean(process.env.GROQ_API_KEY)
    : Boolean(process.env.GEMINI_API_KEY);
}

function resolveFromEnv(): AiConfig {
  const groqModel = process.env.GROQ_MODEL;
  const geminiModel = process.env.GEMINI_MODEL;
  const hasGroq = Boolean(process.env.GROQ_API_KEY && groqModel);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && geminiModel);

  if (hasGroq) {
    return {
      provider: "groq",
      model: groqModel as string,
      fallback: hasGemini ? { provider: "gemini", model: geminiModel as string } : undefined,
      source: "env",
    };
  }
  if (hasGemini) {
    return { provider: "gemini", model: geminiModel as string, source: "env" };
  }
  throw new AiError(
    "IA no configurada: falta GROQ_API_KEY+GROQ_MODEL o GEMINI_API_KEY+GEMINI_MODEL.",
  );
}

async function readActiveConfig(): Promise<{ provider: AiProvider; model: string } | null> {
  const [row] = await db
    .select({ provider: aiConfig.activeProvider, model: aiConfig.activeModel })
    .from(aiConfig)
    .orderBy(desc(aiConfig.updatedAt))
    .limit(1);
  if (!row) return null;
  const provider: AiProvider | null =
    row.provider === "groq" ? "groq" : row.provider === "gemini" ? "gemini" : null;
  if (!provider) return null;
  return { provider, model: row.model };
}

export async function resolveAiConfig(): Promise<AiConfig> {
  const override = await readActiveConfig();
  // El override solo se honra si su proveedor tiene API key en el entorno; si no, se cae al
  // entorno para no dejar la IA rota por una config invalida. Sin fallback cruzado: si el
  // proveedor elegido por el admin falla, se refleja como fallo (no se substituye en silencio).
  if (override && providerHasKey(override.provider)) {
    return { provider: override.provider, model: override.model, source: "db" };
  }
  return resolveFromEnv();
}
