// Init de Sentry para el runtime Edge (proxy.ts). Lo carga instrumentation.ts.
import * as Sentry from "@sentry/nextjs";
import { scrubPhiFromEvent } from "@/lib/sentry/scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend: (event) => scrubPhiFromEvent(event),
});
