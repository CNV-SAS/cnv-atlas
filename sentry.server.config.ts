// Init de Sentry para el runtime Node (servidor). Lo carga instrumentation.ts.
import * as Sentry from "@sentry/nextjs";
import { scrubPhiFromEvent } from "@/lib/sentry/scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sin DSN, el SDK queda inerte (dev local sin Sentry no falla).
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Nunca enviar PII por defecto (IP, cookies, datos de usuario). SECURITY.md.
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  // Scrubbing obligatorio de PHI antes de enviar cualquier evento.
  beforeSend: (event) => scrubPhiFromEvent(event),
});
