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

  // RUIDO QUE NO ES NUESTRO (2026-09-09). En la consola de Santiago aparece un error de `reportAllChanges`
  // con la traza en `VM####`, `<anonymous>` y `requestIdleCallback`. Ya se verifico de donde sale: es la
  // copia de `web-vitals` que las DevTools de Chrome inyectan en la pagina, no la nuestra. No hay nada que
  // arreglar en Atlas.
  //
  // SE FILTRA AQUI PORQUE SI LLEGA A SENTRY, CUESTA. Un error de terceros que entra por `window.onerror`
  // se captura igual que uno propio: consume cuota, y sobre todo ENSUCIA la señal, que es lo caro. Un
  // panel con ruido recurrente entrena a ignorarlo, y el dia que aparezca uno real se pierde entre medias.
  //
  // Y EL FILTRO ES ESTRECHO A PROPOSITO: solo ese nombre de funcion. La tentacion era descartar por
  // `denyUrls` todo lo que venga de un script anonimo o `VM`, y eso taparia tambien nuestros errores de
  // scripts en linea. Un filtro amplio no se nota cuando se pasa: se nota cuando falta un error.
  ignoreErrors: ["reportAllChanges"],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
