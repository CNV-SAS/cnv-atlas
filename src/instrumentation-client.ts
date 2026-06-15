// Init de Sentry en el navegador. Next lo carga automaticamente en el cliente.
import * as Sentry from "@sentry/nextjs";
import { scrubPhiFromEvent } from "@/lib/sentry/scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sin PII por defecto. Replay queda DESACTIVADO a proposito: grabaria el DOM,
  // que puede contener PHI del paciente.
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubPhiFromEvent(event),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
