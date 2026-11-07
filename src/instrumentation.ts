// Punto de arranque de instrumentacion de Next. Carga el init de Sentry segun
// el runtime y expone el hook de errores de request del servidor.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL `digest` VIAJA TAMBIEN DESDE EL SERVIDOR  ·  2026-11-06
//
// ═══ EL CASO (Maria Teresa, consulta 4d2a74e0) ═══
//
// Ve "Esta pestaña no se pudo mostrar" con el codigo 404641578. Ese codigo es el `digest` que Next pone
// al error, y es lo UNICO que une lo que ella lee en pantalla con el registro del fallo.
//
// EL LIMITE DE CLIENTE YA LO ETIQUETABA (`panel-con-red.tsx`), y su comentario decia exactamente por que:
// *"es lo UNICO que une lo que el profesional ve en pantalla con el evento del servidor. Sin el, aunque
// los dos lleguen a Sentry, son dos registros sueltos y hay que adivinar cual va con cual."*
//
// LO QUE FALTABA ERA LA OTRA MITAD. La regla estaba escrita y aplicada en UN lado: el evento del SERVIDOR,
// que es el que trae la pila de verdad y el unico con el que se puede arreglar nada, llegaba sin el
// `digest`. Asi que con el codigo en la mano se encontraba el evento del navegador (sin causa) y no el del
// servidor (con la causa). Es la forma de defecto que esta casa ya tiene nombrada: una regla que tambien
// vive en varios sitios, aplicada donde salio.
//
// CUANDO ESTA DISPONIBLE: Next asigna `err.digest` en su manejador ANTES de llamar a este hook
// (`create-error-handler.js`: la asignacion ocurre arriba y `onHTMLRenderSSRError` despues), asi que aqui
// ya viene puesto. Si no viniera, no se inventa: se reporta igual y sin la etiqueta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export const onRequestError: typeof Sentry.captureRequestError = (error, request, context) => {
  const digest =
    error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;
  if (!digest) {
    Sentry.captureRequestError(error, request, context);
    return;
  }
  // `withScope` acota la etiqueta a ESTE evento: puesta en el scope global se pegaria a los siguientes.
  Sentry.withScope((scope) => {
    scope.setTag("digest", digest);
    Sentry.captureRequestError(error, request, context);
  });
};
