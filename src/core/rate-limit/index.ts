import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimitResult = { success: boolean; remaining: number };

// Ventana fija en memoria (por proceso): red de seguridad para dev/local. En prod
// serverless el limitador real es Upstash (multi-instancia); esto no lo sustituye,
// solo evita que el control quede inerte cuando Upstash no esta configurado.
class MemoryFixedWindow {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string): LimitResult {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { success: true, remaining: this.limit - 1 };
    }
    if (entry.count >= this.limit) return { success: false, remaining: 0 };
    entry.count += 1;
    return { success: true, remaining: this.limit - entry.count };
  }
}

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW = "15 m" as const;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const memoryLogin = new MemoryFixedWindow(LOGIN_LIMIT, LOGIN_WINDOW_MS);

let upstashLogin: Ratelimit | null = null;
function getUpstashLogin(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  upstashLogin ??= new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(LOGIN_LIMIT, LOGIN_WINDOW),
    prefix: "atlas:login",
  });
  return upstashLogin;
}

// 5 intentos / 15 min por IP (SECURITY.md). Usa Upstash si esta configurado; si
// no, la ventana en memoria. Falla abierto si el limitador remoto da error, para
// no bloquear logins legitimos cuando Upstash este caido (disponibilidad > en
// este control; la fuerza bruta sigue acotada por los limites nativos de Auth).
export async function limitLoginByIp(ip: string): Promise<LimitResult> {
  const upstash = getUpstashLogin();
  if (upstash) {
    try {
      const r = await upstash.limit(ip);
      return { success: r.success, remaining: r.remaining };
    } catch {
      return { success: true, remaining: LOGIN_LIMIT };
    }
  }
  return memoryLogin.check(ip);
}

// ---- Encuesta publica (intake, B7) ---------------------------------------
// Superficie sin sesion: rate limit AGRESIVO por IP y por token (SECURITY.md).
// - Por IP: corta a un bot que martillea distintos tokens desde una misma IP.
// - Por token: acota el abuso sobre un token concreto. El link inicial es reusable
//   (lo comparte el profesional), asi que el limite por token es por hora y holgado
//   para no bloquear a varios pacientes legitimos del mismo profesional; el de
//   seguimiento es de un solo uso de todos modos.
const SURVEY_IP_LIMIT = 8;
const SURVEY_IP_WINDOW = "10 m" as const;
const SURVEY_IP_WINDOW_MS = 10 * 60 * 1000;
const SURVEY_TOKEN_LIMIT = 15;
const SURVEY_TOKEN_WINDOW = "1 h" as const;
const SURVEY_TOKEN_WINDOW_MS = 60 * 60 * 1000;

const memorySurveyIp = new MemoryFixedWindow(SURVEY_IP_LIMIT, SURVEY_IP_WINDOW_MS);
const memorySurveyToken = new MemoryFixedWindow(SURVEY_TOKEN_LIMIT, SURVEY_TOKEN_WINDOW_MS);

let upstashSurveyIp: Ratelimit | null = null;
let upstashSurveyToken: Ratelimit | null = null;
function getUpstash(
  cache: "ip" | "token",
  limit: number,
  window: `${number} ${"m" | "h"}`,
  prefix: string,
): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const existing = cache === "ip" ? upstashSurveyIp : upstashSurveyToken;
  if (existing) return existing;
  const rl = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(limit, window),
    prefix,
  });
  if (cache === "ip") upstashSurveyIp = rl;
  else upstashSurveyToken = rl;
  return rl;
}

// Falla CERRADO si Upstash da error (a diferencia del login): es una superficie de
// escritura publica, preferimos negar ante incertidumbre. La ventana en memoria es
// el respaldo cuando Upstash no esta configurado.
async function limitSurvey(
  kind: "ip" | "token",
  key: string,
  limit: number,
  window: `${number} ${"m" | "h"}`,
  memory: MemoryFixedWindow,
): Promise<LimitResult> {
  const upstash = getUpstash(kind, limit, window, `atlas:survey:${kind}`);
  if (upstash) {
    try {
      const r = await upstash.limit(key);
      return { success: r.success, remaining: r.remaining };
    } catch {
      return { success: false, remaining: 0 };
    }
  }
  return memory.check(key);
}

export function limitSurveyByIp(ip: string): Promise<LimitResult> {
  return limitSurvey("ip", ip, SURVEY_IP_LIMIT, SURVEY_IP_WINDOW, memorySurveyIp);
}

export function limitSurveyByToken(token: string): Promise<LimitResult> {
  return limitSurvey("token", token, SURVEY_TOKEN_LIMIT, SURVEY_TOKEN_WINDOW, memorySurveyToken);
}

// ---- Import XLSX de Biody (B8) --------------------------------------------
// Subida de archivo acotada por hora por usuario (SECURITY.md). El parseo del XLSX
// cuesta CPU y persiste datos; el limite frena bucles o subidas masivas. Holgado
// para reimportes/correcciones legitimas del profesional.
const IMPORT_LIMIT = 20;
const IMPORT_WINDOW = "1 h" as const;
const IMPORT_WINDOW_MS = 60 * 60 * 1000;

const memoryImport = new MemoryFixedWindow(IMPORT_LIMIT, IMPORT_WINDOW_MS);

let upstashImport: Ratelimit | null = null;
function getUpstashImport(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  upstashImport ??= new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(IMPORT_LIMIT, IMPORT_WINDOW),
    prefix: "atlas:import",
  });
  return upstashImport;
}

// Falla ABIERTO si Upstash da error: superficie autenticada (el profesional es
// responsable y rastreable), priorizamos no bloquear trabajo clinico legitimo. El
// abuso queda acotado por la sesion y los limites generales.
export async function limitImportByUser(userId: string): Promise<LimitResult> {
  const upstash = getUpstashImport();
  if (upstash) {
    try {
      const r = await upstash.limit(userId);
      return { success: r.success, remaining: r.remaining };
    } catch {
      return { success: true, remaining: IMPORT_LIMIT };
    }
  }
  return memoryImport.check(userId);
}

// ---- Envio de reportes por correo (B10) ----------------------------------
// Acotado por usuario para no saturar Resend (un reporte por evaluacion; 10/h cubre
// reenvios legitimos). Falla abierto (superficie autenticada), como el import.
const REPORT_SEND_LIMIT = 10;
const REPORT_SEND_WINDOW = "1 h" as const;
const REPORT_SEND_WINDOW_MS = 60 * 60 * 1000;

const memoryReportSend = new MemoryFixedWindow(REPORT_SEND_LIMIT, REPORT_SEND_WINDOW_MS);

let upstashReportSend: Ratelimit | null = null;
function getUpstashReportSend(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  upstashReportSend ??= new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(REPORT_SEND_LIMIT, REPORT_SEND_WINDOW),
    prefix: "atlas:report-send",
  });
  return upstashReportSend;
}

export async function limitReportSendByUser(userId: string): Promise<LimitResult> {
  const upstash = getUpstashReportSend();
  if (upstash) {
    try {
      const r = await upstash.limit(userId);
      return { success: r.success, remaining: r.remaining };
    } catch {
      return { success: true, remaining: REPORT_SEND_LIMIT };
    }
  }
  return memoryReportSend.check(userId);
}
