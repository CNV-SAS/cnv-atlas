import "server-only";

import { createHash, randomInt } from "node:crypto";

import { Redis } from "@upstash/redis";

// Código de verificación (OTP) del consentimiento (B7, dictamen de firma electrónica). Resuelve la
// condición 1 del art. 4 del Decreto 2364: el código es un dato que, en el contexto de uso, corresponde
// EXCLUSIVAMENTE a quien controla el correo. Propiedades exigidas por el dictamen:
//  - NUNCA se guarda el código, ni cifrado: es un secreto de un solo uso; su valor probatorio está en
//    HABERSE VALIDADO, no en su contenido. Se guarda solo su HASH (con sal por sesión).
//  - Vigencia corta (TTL nativo de Redis, sin depender de la BD) e intentos limitados.
//  - Un solo uso: al validar, se consume.
// La traza (canal, destino enmascarado, timestamps de envío y validación) se registra en el flujo, no aquí.

const TTL_SECONDS = 600; // 10 minutos (rango 5-10 del dictamen)
const MAX_ATTEMPTS = 5;

// Interfaz mínima de Redis que usa el servicio (deja inyectar un mock en test sin tocar Upstash).
export interface OtpStore {
  hset(key: string, value: Record<string, unknown>): Promise<number>;
  hgetall<T>(key: string): Promise<T | null>;
  hincrby(key: string, field: string, by: number): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
}

function getRedis(): OtpStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token }) as unknown as OtpStore;
}

const keyFor = (sessionId: string) => `consent-otp:${sessionId}`;

// Sal por sesión: el hash no es reversible por tabla precomputada y no se puede reusar entre sesiones.
function hashCode(sessionId: string, code: string): string {
  return createHash("sha256").update(`${sessionId}:${code}`, "utf8").digest("hex");
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Guarda el HASH del código + un contador de intentos en 0, con TTL nativo. Devuelve false si Upstash no
// está configurado (el llamador decide; sin almacén no hay OTP y no se debe dejar pasar la firma).
export async function storeOtp(
  sessionId: string,
  code: string,
  store: OtpStore | null = getRedis(),
): Promise<boolean> {
  if (!store) return false;
  const key = keyFor(sessionId);
  await store.hset(key, { hash: hashCode(sessionId, code), attempts: 0 });
  await store.expire(key, TTL_SECONDS);
  return true;
}

export type OtpVerifyStatus = "ok" | "expired" | "invalid" | "too_many_attempts" | "unavailable";

// Verifica el código: 'expired' si no existe o venció (TTL); 'too_many_attempts' al superar el tope
// (invalida la sesión); 'invalid' si no coincide; 'ok' si coincide (y CONSUME el código, un solo uso).
export async function verifyOtp(
  sessionId: string,
  code: string,
  store: OtpStore | null = getRedis(),
): Promise<OtpVerifyStatus> {
  if (!store) return "unavailable";
  const key = keyFor(sessionId);
  const data = await store.hgetall<{ hash?: string }>(key);
  if (!data || !data.hash) return "expired"; // no existe o venció por TTL
  const attempts = await store.hincrby(key, "attempts", 1);
  if (attempts > MAX_ATTEMPTS) {
    await store.del(key);
    return "too_many_attempts";
  }
  if (data.hash !== hashCode(sessionId, code)) return "invalid";
  await store.del(key); // un solo uso
  return "ok";
}
