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
