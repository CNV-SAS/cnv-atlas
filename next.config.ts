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
    // El checkout publico envia su form (Web Checkout por redirect) al dominio
    // alojado de Wompi; sin esto la CSP bloquearia el pago.
    "form-action 'self' https://checkout.wompi.co",
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
  // PRIMERA REDIRECCION DEL PROYECTO (2026-09-10). `/evaluaciones` paso a llamarse `/ani-bis-e` cuando el
  // item del sidebar dejo de ser "Evaluaciones" y paso a ser "Modelo ANI-BIS-E".
  //
  // POR QUE HACE FALTA aunque la ruta sea INTERNA (nada de lo que se comparte con un paciente pasaba por
  // aqui: el QR y el enlace de reanudar van a `/encuesta/...`): los profesionales guardan marcadores y
  // pegan enlaces de una evaluacion concreta en sus notas y en sus correos. Sin esto, todos esos enlaces
  // dan 404, que es la forma cara de descubrir que una direccion cambio.
  //
  // LAS DOS FORMAS, y la segunda es la que se olvida: la ruta CON sufijo (`/evaluaciones/<id>?etapa=...`,
  // que es la que de verdad se comparte) y la ruta PELADA (`/evaluaciones`, la bandeja, que es la que
  // esta en los marcadores). `/:path*` NO cubre la pelada, asi que van las dos entradas.
  //
  // PERMANENTE (308): la direccion vieja no vuelve. Un 307 le diria al navegador y a los buscadores que
  // esto es temporal y que sigan usando la vieja.
  async redirects() {
    return [
      { source: "/evaluaciones", destination: "/ani-bis-e", permanent: true },
      // EL CONSENTIMIENTO DEJO DE TENER PANTALLA PROPIA (Santiago, 2026-09-10): es un bloque de
      // /ani-bis-e, junto a las versiones del modelo, porque tambien esta versionado y es parte del
      // modelo. La redireccion cubre los enlaces guardados; el que se manda a los PACIENTES es otro
      // (/consentimiento/[token], publico) y no pasa por aqui.
      { source: "/consentimiento", destination: "/ani-bis-e", permanent: true },
      { source: "/evaluaciones/:path*", destination: "/ani-bis-e/:path*", permanent: true },
    ];
  },
  // Solo dev: localhost y 127.0.0.1 son ORIGENES DISTINTOS para el navegador; los enlaces de correo
  // (Mailpit) abren 127.0.0.1:3000 mientras el dev server suele visitarse por localhost, y Next bloquea
  // el HMR cruzado entre ambos ("Blocked cross-origin request ... /_next/webpack-hmr"). Permitir los dos
  // elimina ese ruido. Si ademas se expone por un tunel publico (Cloudflare/ngrok) para probar webhooks,
  // se agrega su origen por DEV_TUNNEL_ORIGIN (no se hardcodea: los tuneles son efimeros). Nada aplica en produccion.
  ...(isDev
    ? {
        allowedDevOrigins: [
          "localhost",
          "127.0.0.1",
          ...(process.env.DEV_TUNNEL_ORIGIN ? [process.env.DEV_TUNNEL_ORIGIN] : []),
        ],
      }
    : {}),
};

// ═══ LOS SOURCEMAPS SE SUBEN A SENTRY (2026-10-07) ═══
//
// ── POR QUE DEJO DE SER APLAZABLE ──────────────────────────────────────────────────────────────────
//
// Aqui decia "la subida de sourcemaps se configura en el bloque de deploy. Por ahora solo se silencia el
// plugin", y ese "por ahora" duro hasta que hizo falta leer un error real. El stack que llego de produccion
// el 7 de octubre ("Rendered more hooks than during the previous render") sale asi:
//
//   app:///_next/static/chunks/09bm4s38m-e-z.js:20:117514  in iN
//   app:///_next/static/chunks/09bm4s38m-e-z.js:20:124981  in Object.oo [as useMemo]
//
// O sea: NINGUN error de produccion se puede diagnosticar. Se sabe que el fallo esta en un `useMemo` y nada
// mas; que componente es, no. Con sourcemaps, ese mismo evento nombra el archivo y la linea.
//
// ── LA SUBIDA ES CONDICIONAL, Y ESO ES LO QUE LA HACE SEGURA ───────────────────────────────────────
//
// Solo se activa cuando estan las TRES variables. Sin ellas el build se comporta EXACTAMENTE como hoy, asi
// que un build local o de un colaborador sin el token no cambia ni falla. El plugin, si le faltan datos,
// avisa y sigue; pero depender de eso seria dejar el build quejandose en cada `pnpm build`.
//
// LAS TRES VARIABLES (ver DEPLOY.md):
//   · SENTRY_ORG      el slug de la organizacion (NO el id numerico del DSN)
//   · SENTRY_PROJECT  el slug del proyecto (idem)
//   · SENTRY_AUTH_TOKEN  secret, NUNCA con prefijo NEXT_PUBLIC_ (regla critica de DEPLOY.md)
//
// `widenClientFileUpload` incluye los chunks del App Router, que es justo donde caen los componentes de
// cliente: sin eso, el stack de un error de React se queda igual de ilegible.
const subirSourcemaps = Boolean(
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN,
);

// ═══ Y EL BUILD DICE SI LOS VA A SUBIR (2026-10-07) ═══
//
// Santiago puso las tres variables, redesplego, y el evento siguio saliendo minificado. No habia forma de
// saber si el plugin no corrio, si el build se reuso de cache, o si la subida fallo: `silent: true` se
// comia TODA la salida del plugin, incluidos sus errores.
//
// ASI QUE AHORA EL LOG DE VERCEL LO DICE EN UNA LINEA, y es lo primero que hay que mirar. Sin esto, "no
// aparecio" no distingue entre tres causas distintas, que es la peor forma de depurar.
//
// NO IMPRIME EL TOKEN: solo si esta presente.
console.log(
  `[sentry] subida de sourcemaps: ${subirSourcemaps ? "SI" : "NO"}` +
    ` (org=${process.env.SENTRY_ORG ? "ok" : "FALTA"},` +
    ` project=${process.env.SENTRY_PROJECT ? "ok" : "FALTA"},` +
    ` token=${process.env.SENTRY_AUTH_TOKEN ? "ok" : "FALTA"})`,
);

export default withSentryConfig(nextConfig, {
  // CALLADO SOLO CUANDO NO HAY NADA QUE SUBIR. Si va a subir, su salida (y sus errores) tienen que verse en
  // el log del build: es el unico sitio donde se puede comprobar que la subida ocurrio de verdad.
  silent: !subirSourcemaps,
  ...(subirSourcemaps
    ? {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        widenClientFileUpload: true,
        // LOS SOURCEMAPS NO SE SIRVEN AL PUBLICO: se suben a Sentry y se borran del bundle. Dejarlos
        // servidos publicaria el codigo fuente de la aplicacion clinica en un archivo que cualquiera baja.
        sourcemaps: { deleteSourcemapsAfterUpload: true },
      }
    : {}),
});
