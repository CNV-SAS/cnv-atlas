import "server-only";

import { fetchJson } from "@/core/http/fetch-json";
import { HttpError } from "@/core/http/http-error";
import { conReintentoAnteTope } from "@/lib/ai/reintento-tope";

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
  /**
   * El proveedor CORTO la respuesta por el tope de salida (`finish_reason: "length"` en Groq,
   * `MAX_TOKENS` en Gemini). Distinguirlo importa: un texto cortado no es un texto MALO, y decir
   * "respuesta invalida" sobre una respuesta que venia bien y no cupo manda a buscar donde no es.
   */
  truncado: boolean;
};

/** Lo que devuelve una llamada al proveedor: el texto y si vino cortado. */
type RespuestaProveedor = { text: string; truncado: boolean };

export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

/**
 * El mensaje con el que se envuelve un error del proveedor, CONSERVANDO lo que el proveedor dijo.
 *
 * ── POR QUE (2026-09-12, barrido tras el mismo defecto en la facturacion) ───────────────────────
 *
 * Esto era `new AiError(String(primaryError))`, y `String` de un HttpError da "HttpError: HTTP 400 en
 * POST https://...": el STATUS sin el MOTIVO. El cuerpo de la respuesta viaja en `HttpError.body` y se
 * perdia justo al envolverlo, asi que el fallo quedaba grabado mudo en `ai_menu_suggestions.raw_response`.
 *
 * Es el mismo defecto que tumbo el primer smoke de facturacion: el sistema externo EXPLICA el error, lo
 * recibimos, y lo tiramos antes de escribirlo. Aqui duele menos porque casi siempre hay fallback, pero
 * cuando el admin fija un proveedor a mano NO lo hay, y entonces esa linea es todo lo que queda.
 *
 * No toca la deteccion del 429: `conReintentoAnteTope` corre DENTRO de `callGroq`, antes de este
 * envoltorio, y sigue viendo el HttpError crudo con su `body`.
 */
function mensajeDelProveedor(e: unknown): string {
  if (e instanceof HttpError) {
    const detalle = typeof e.body === "string" ? e.body : JSON.stringify(e.body ?? {});
    return `${e.message} -> ${detalle}`;
  }
  return String(e);
}

// La IA puede tardar mas que un pago; timeout generoso pero acotado. 45s da margen a la
// latencia variable de Gemini (Groq responde en <1s). Medido: Gemini 2.5 Flash sin thinking
// ~2s, con thinking hasta ~25s; con thinkingBudget:0 (abajo) baja a ~2s y este margen cubre
// picos. Nota: en Vercel, el tope de duracion de la funcion serverless tambien aplica.
const AI_TIMEOUT_MS = 45_000;

type GroqResponse = {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
};
type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
};

/**
 * Tope de salida por defecto. Lo puede subir quien llama, por llamada.
 *
 * ═══ POR QUE ES POR LLAMADA Y NO UNA CONSTANTE COMPARTIDA (smoke Santiago, 2026-09-10) ═══
 *
 * EL DEFECTO: con DOS restricciones registradas, el menu fallaba con "Respuesta invalida". El JSON del
 * modelo se veia bien formado en pantalla, y lo estaba: **llegaba CORTADO**. Verificado contra la fila de
 * produccion, no razonado: el texto termina a media cadena ("...\"mot"), 29 llaves abiertas contra 27
 * cerradas, y `JSON.parse` falla con "Unterminated string at position 4037".
 *
 * Y LA SERIE LO CONFIRMA: una restriccion daba 8 entradas y 1.371 caracteres; una compuesta, 14 y 3.683;
 * dos restricciones, 28-30 entradas y ~4.000-4.900. El trabajo crece con las restricciones y el tope no.
 *
 * NO ES DETERMINISTA, y por eso pasaba desapercibido: los modelos de razonamiento gastan del MISMO
 * presupuesto en pensar antes de escribir, asi que dos llamadas del mismo tamaño caben o no segun cuanto
 * razone cada una. Una generacion de 4.949 caracteres paso y otra de 4.037 se corto.
 *
 * Un tope unico para todas las llamadas obliga a elegir entre el borrador de criterio (parrafos) y el
 * menu (una semana entera de sustituciones), que no tienen nada que ver. Se acota por llamada.
 */
const MAX_TOKENS_POR_DEFECTO = 4096;

async function callGroq(
  messages: AiMessage[],
  model: string,
  maxTokens: number,
): Promise<RespuestaProveedor> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiError("GROQ_API_KEY ausente");
  // Los modelos de razonamiento de Groq (familia gpt-oss) gastan el presupuesto de salida en
  // tokens de razonamiento ANTES del texto visible; con el tope por defecto (~2048) el
  // razonamiento se lo puede comer entero y `content` vuelve VACIO (finish_reason "length"),
  // lo que aqui se leeria como "respuesta vacía" y tumbaria el menu. Se acota el razonamiento a
  // "low" y se da un tope de salida holgado para que quepan razonamiento + menu. `reasoning_effort`
  // NO se envia a modelos sin razonamiento (llama): Groq lo rechaza con 400 (verificado 2026-08-13).
  const isReasoningModel = model.includes("gpt-oss");
  const pedir = () =>
    fetchJson<GroqResponse>("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: {
        model,
        messages,
        temperature: 0.4,
        max_completion_tokens: maxTokens,
        ...(isReasoningModel ? { reasoning_effort: "low" } : {}),
      },
      timeoutMs: AI_TIMEOUT_MS,
    });

  // El reintento va AQUI, dentro de la llamada a Groq, y no en `generateText`: asi ocurre ANTES del
  // fallback. Un 429 es una cola de segundos, y cambiar de proveedor por eso es peor que esperar.
  const res = await conReintentoAnteTope(pedir);
  const text = res.choices?.[0]?.message?.content;
  if (!text) throw new AiError("Groq: respuesta vacía");
  return { text, truncado: res.choices?.[0]?.finish_reason === "length" };
}

async function callGemini(
  messages: AiMessage[],
  model: string,
  maxTokens: number,
): Promise<RespuestaProveedor> {
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
        generationConfig: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: maxTokens },
      },
      timeoutMs: AI_TIMEOUT_MS,
    },
  );
  const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new AiError("Gemini: respuesta vacía");
  return { text, truncado: res.candidates?.[0]?.finishReason === "MAX_TOKENS" };
}

function callProvider(
  provider: AiProvider,
  messages: AiMessage[],
  model: string,
  maxTokens: number,
): Promise<RespuestaProveedor> {
  return provider === "groq"
    ? callGroq(messages, model, maxTokens)
    : callGemini(messages, model, maxTokens);
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
  /** Tope de salida de ESTA llamada. Ver `MAX_TOKENS_POR_DEFECTO`. */
  opciones?: { maxTokens?: number },
): Promise<AiCompletion> {
  const started = Date.now();
  const maxTokens = opciones?.maxTokens ?? MAX_TOKENS_POR_DEFECTO;
  try {
    const r = await callProvider(config.provider, messages, config.model, maxTokens);
    return {
      ...r,
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - started,
    };
  } catch (primaryError) {
    if (!config.fallback) {
      throw primaryError instanceof AiError
        ? primaryError
        : new AiError(mensajeDelProveedor(primaryError));
    }
    const r = await callProvider(
      config.fallback.provider,
      messages,
      config.fallback.model,
      maxTokens,
    );
    return {
      ...r,
      provider: config.fallback.provider,
      model: config.fallback.model,
      latencyMs: Date.now() - started,
    };
  }
}
