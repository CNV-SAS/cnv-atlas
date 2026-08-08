import "server-only";

import * as Sentry from "@sentry/nextjs";

// Reporta un error MANEJADO de una ruta de servidor a los dos destinos: al log del proceso (Vercel,
// para diagnostico inmediato) Y a Sentry con el `area` como tag (para poder filtrar y para que alguien
// lo vea con integrantes adentro; un console.error suelto NO llega a Sentry, solo a Vercel).
//
// Se usa en los catch de ESCRITURA que devuelven un error generico al usuario: sin esto, el fallo real
// (un constraint, un problema de conexion como el pooler) no deja rastro y quedamos ciegos. NO usar en
// los catch de error ESPERABLE (validacion, not-found, stale): esos no son fallos, son ramas normales.
//
// `area` nombra la operacion que fallo (p. ej. "createUser.transaccion", "checkout.create"): un
// console.error(e) suelto en veinte sitios no se distingue; el area sí.
export function reportServerError(area: string, e: unknown): void {
  console.error(`${area} fallo:`, e);
  // captureException es inerte si Sentry esta deshabilitado (dev local sin DSN): seguro en todos lados.
  Sentry.captureException(e, { tags: { area } });
}
