import "server-only";

import { fetchJson } from "@/core/http/fetch-json";

// Abstraccion de proveedor de IA (API_INTEGRATIONS seccion 4). La IA SOLO genera el
// menu/dieta (B13); el diagnostico es determinista, nunca IA. Aqui vive el transporte con
// timeout explicito (regla dura 10) y el fallback Groq <-> Gemini. Se usa fetch-json (no
// los SDKs, aunque esten instalados) para un unico transporte uniforme con timeout, igual
// que Wompi/Alegra. NUNCA PII al LLM: el contrato de entrada (los prompts) solo admite
// variables clinicas seudonimizadas; esa barrera vive en el builder del prompt.

export type AiProvider = "groq" | "gemini";
export type AiMessage = { role: "system" | "user"; content: string };
export type AiCompletion = {
  text: string;
  provider: AiProvider;
  model: string;
  latencyMs: number;
};

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

// La IA puede tardar mas que un pago; timeout generoso pero acotado.
const AI_TIMEOUT_MS = 20_000;

type GroqResponse = { choices?: { message?: { content?: string } }[] };
type GeminiResponse = { candidates?: { content?: { parts?: { text?: string }[] } }[] };

async function callGroq(messages: AiMessage[], model: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiError("GROQ_API_KEY ausente");
  const res = await fetchJson<GroqResponse>("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: { model, messages, temperature: 0.4 },
    timeoutMs: AI_TIMEOUT_MS,
  });
  const text = res.choices?.[0]?.message?.content;
  if (!text) throw new AiError("Groq: respuesta vacia");
  return text;
}

async function callGemini(messages: AiMessage[], model: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError("GEMINI_API_KEY ausente");
  // Gemini separa la instruccion de sistema del turno de usuario.
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const user = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n");
  const res = await fetchJson<GeminiResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      body: {
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: user }] }],
      },
      timeoutMs: AI_TIMEOUT_MS,
    },
  );
  const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AiError("Gemini: respuesta vacia");
  return text;
}

function callProvider(provider: AiProvider, messages: AiMessage[], model: string): Promise<string> {
  return provider === "groq" ? callGroq(messages, model) : callGemini(messages, model);
}

export type AiConfig = {
  provider: AiProvider;
  model: string;
  fallback?: { provider: AiProvider; model: string };
  // Procedencia de la config: "db" = eleccion explicita del admin (se honra sin fallback
  // silencioso); "env" = default por entorno (admite fallback silencioso entre proveedores).
  source?: "db" | "env";
};

// Genera texto con el proveedor primario; ante cualquier fallo, cae al secundario si hay.
// Devuelve el proveedor/modelo que efectivamente respondio (para la trazabilidad de B13).
export async function generateText(
  messages: AiMessage[],
  config: AiConfig,
): Promise<AiCompletion> {
  const started = Date.now();
  try {
    const text = await callProvider(config.provider, messages, config.model);
    return { text, provider: config.provider, model: config.model, latencyMs: Date.now() - started };
  } catch (primaryError) {
    if (!config.fallback) {
      throw primaryError instanceof AiError ? primaryError : new AiError(String(primaryError));
    }
    const text = await callProvider(config.fallback.provider, messages, config.fallback.model);
    return {
      text,
      provider: config.fallback.provider,
      model: config.fallback.model,
      latencyMs: Date.now() - started,
    };
  }
}
