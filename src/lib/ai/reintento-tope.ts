// ESPERA Y REINTENTA CUANDO SE ROZA EL TOPE POR MINUTO DEL PROVEEDOR.
//
// POR QUE ES DISTINTO DE UN FALLO. Gildardo, entrega del 2026-09-01 (§7c): Groq responde 429 cuando se
// pasa el tope de tokens por minuto, y dice cuantos segundos hay que esperar. Su descripcion es la exacta:
// "no es un fallo, es una cola". Un menu o un criterio son varias llamadas seguidas, asi que rozar el tope
// es normal, no excepcional.
//
// Y LO QUE HACIAMOS ERA PEOR QUE ESPERAR: ante CUALQUIER fallo caiamos al proveedor secundario, asi que
// una cola de dos segundos nos cambiaba de modelo. El texto clinico salia de otro sitio sin que nadie lo
// hubiera pedido, y eso solo se ve en la trazabilidad. Por eso el reintento va DENTRO de la llamada al
// proveedor, antes del fallback: primero se espera lo que el propio proveedor pide, y solo si vuelve a
// fallar se deja subir el error.
//
// Vive fuera de `provider.ts` (que es `server-only`) para que la politica se pueda probar sola.

import { HttpError } from "@/core/http/http-error";

/** Techo de espera: un profesional tiene al paciente delante. Mas de esto es peor que decirle que reintente. */
export const ESPERA_MAX_MS = 10_000;

/** Lo que se espera cuando el proveedor no dice cuanto. */
export const ESPERA_DEFECTO_MS = 2_000;

/**
 * Los segundos que el proveedor pide esperar, si los dice. Groq los pone en la PROSA del mensaje
 * ("Please try again in 2.5s"), no en un campo aparte. Leer prosa de un proveedor es fragil por
 * definicion: por eso lo que importa es que el DEFECTO cubra cuando la redaccion no coincide.
 */
export function segundosDeEspera(body: unknown): number | null {
  const msg = (body as { error?: { message?: string } } | null)?.error?.message;
  if (typeof msg !== "string") return null;
  const m = /try again in ([\d.]+)\s*s/i.exec(msg);
  if (!m) return null;
  const seg = Number(m[1]);
  return Number.isFinite(seg) && seg > 0 ? seg : null;
}

/** Solo el tope por minuto se espera. Un 500 o una clave mala no mejoran esperando. */
export function esTopePorMinuto(e: unknown): e is HttpError {
  return e instanceof HttpError && e.status === 429;
}

/**
 * Corre `pedir`; si el proveedor responde con el tope por minuto, espera lo que pide y lo intenta UNA
 * vez mas. Un solo reintento, no una cadena: si el tope sigue tocado despues de esperar lo que el propio
 * proveedor pidio, el problema ya no es la cola y ahi si corresponde el fallback.
 */
export async function conReintentoAnteTope<T>(
  pedir: () => Promise<T>,
): Promise<T> {
  try {
    return await pedir();
  } catch (e) {
    if (!esTopePorMinuto(e)) throw e;
    const seg = segundosDeEspera(e.body);
    const espera = Math.min(
      seg != null ? seg * 1000 : ESPERA_DEFECTO_MS,
      ESPERA_MAX_MS,
    );
    await new Promise((r) => setTimeout(r, espera));
    return pedir();
  }
}
