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

// La IA puede tardar mas que un pago; timeout generoso pero acotado. 45s da margen a la
// latencia variable de Gemini (Groq responde en <1s). Medido: Gemini 2.5 Flash sin thinking
// ~2s, con thinking hasta ~25s; con thinkingBudget:0 (abajo) baja a ~2s y este margen cubre
// picos. Nota: en Vercel, el tope de duracion de la funcion serverless tambien aplica.
const AI_TIMEOUT_MS = 45_000;

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
        // Desactiva el "thinking" de Gemini 2.5 (thinkingBudget:0): para un menu no aporta y
        // dispara la latencia (~9s con thinking vs ~2s sin el; picos >20s). Los modelos sin
        // thinking (ej. 2.0-flash) aceptan el formato y lo ignoran, asi que es seguro enviarlo.
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
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
