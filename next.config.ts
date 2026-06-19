import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Headers de seguridad (SECURITY.md). La CSP no se difiere: minimo del MVP.
// El connect-src se arma desde las env publicas para no hardcodear origenes
// (dev: Supabase local en 127.0.0.1:54321; prod: Supabase cloud).
const isDev = process.env.NODE_ENV !== "production";

// Unicos destinos que el navegador puede contactar: la propia app, Supabase
// (datos REST/Auth + realtime por websocket) y Sentry (ingest). La IA se llama
// server-side, asi que no aparece aqui.
function buildConnectSrc(): string {
  const sources = new Set<string>(["'self'"]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const origin = new URL(supabaseUrl).origin;
      sources.add(origin); // REST / Auth (http en dev, https en prod)
      sources.add(origin.replace(/^http/, "ws")); // realtime (ws en dev, wss en prod)
    } catch {
      // URL malformada: se ignora, la CSP queda sin Supabase (falla visible, no silenciosa).
    }
  }

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (sentryDsn) {
    try {
      sources.add(new URL(sentryDsn).origin); // host de ingest de Sentry
    } catch {
      // DSN malformado: se ignora.
    }
  }

  if (isDev) {
    // El HMR de Next en dev usa un websocket contra el propio dev server.
    sources.add("ws://localhost:*");
    sources.add("ws://127.0.0.1:*");
  }

  return Array.from(sources).join(" ");
}

// 'unsafe-inline' en script/style es el baseline aprobado para el MVP; el
// endurecimiento a nonces queda para B15. 'unsafe-eval' solo en dev (lo exige el
// HMR de Next).
function buildCsp(): string {
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${buildConnectSrc()}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  // HSTS: dos anios, subdominios y preload (SECURITY.md). Inocuo sobre http local.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions-Policy restringido: se apagan APIs sensibles que la app no usa.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// La subida de sourcemaps (org, project, SENTRY_AUTH_TOKEN) se configura en el
// bloque de deploy. Por ahora solo se silencia el plugin en el build.
export default withSentryConfig(nextConfig, {
  silent: true,
});
