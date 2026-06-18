import "server-only";
import { headers } from "next/headers";

// IP del cliente para rate limiting de superficies sin sesion. En Vercel el
// primer valor de x-forwarded-for es la IP real del visitante.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip") ?? "unknown";
}
