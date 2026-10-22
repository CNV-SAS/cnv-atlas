import * as Sentry from "@sentry/nextjs";

// EL HERMANO DE CLIENTE de `reportServerError`, y existe por una razon tonta y dura: ese modulo lleva
// `import "server-only"`, asi que un componente `"use client"` no lo puede importar (ni el tipo). Mismo
// contrato: deja rastro en los dos destinos (la consola del navegador y Sentry con el `area` como tag),
// y `captureException` es inerte sin DSN, asi que es seguro en local.
//
// ═══ PARA QUE SIRVE, QUE NO ES OBVIO (Santiago, 2026-10-22) ═══
//
// Se usa donde el cliente ATRAPA un fallo para poder decirlo con palabras. Y ahi es donde hace falta:
// atrapar un error lo saca del camino que lo habria reportado solo (el limite de error, o el console.error
// de Next), asi que sin esto un arreglo que mejora lo que ve la persona nos deja CIEGOS a nosotros. Fue
// exactamente lo que paso al blindar el envio de la encuesta contra un fallo de red: el aviso en pantalla
// y el evento de Sentry tienen que venir juntos, o el segundo desaparece sin que nadie lo note.
export function reportClientError(area: string, e: unknown): void {
  console.error(`${area} fallo:`, e);
  Sentry.captureException(e, { tags: { area } });
}
