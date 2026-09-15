// Init de Sentry para el runtime Node (servidor). Lo carga instrumentation.ts.
import * as Sentry from "@sentry/nextjs";
import { cadenaDeCausas } from "@/lib/sentry/causa";
import { scrubPhiFromEvent } from "@/lib/sentry/scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sin DSN, el SDK queda inerte (dev local sin Sentry no falla).
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Nunca enviar PII por defecto (IP, cookies, datos de usuario). SECURITY.md.
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  // Scrubbing obligatorio de PHI antes de enviar cualquier evento.
  //
  // Y ANTES, LA CAUSA (2026-09-15): un fallo de la base llegaba como "Failed query: ..." sin decir si fue la
  // conexion o el SQL. Va en el contexto "causa" y, el codigo del primer eslabon que lo tenga, en el tag
  // `causa_codigo` para poder filtrar. Solo lo estructural: ver `lib/sentry/causa.ts`.
  beforeSend: (event, hint) => {
    const cadena = cadenaDeCausas(hint.originalException);
    if (cadena.length > 1 || cadena.some((c) => c.codigo)) {
      event.contexts = { ...event.contexts, causa: { cadena } };
      const codigo = cadena.find((c) => c.codigo)?.codigo;
      if (codigo) event.tags = { ...event.tags, causa_codigo: codigo };
    }
    return scrubPhiFromEvent(event);
  },
});
