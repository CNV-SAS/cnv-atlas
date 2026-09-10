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
 * ES UNA COLA, NO UN FALLO, y hay que poder decirlo aguas arriba.
 *
 * ═══ EL CASO QUE LA TRAJO (Santiago, 2026-09-10) ═══
 *
 * Al regenerar el borrador salio "El proveedor configurado (groq) fallo", y a la segunda funciono. En el
 * registro de produccion: `HTTP 429 en POST .../chat/completions`, y su reintento a mano llego VEINTIUN
 * segundos despues. O sea que Groq pedia esperar mas que nuestro techo de diez, el reintento salio
 * demasiado pronto, se gasto, y el 429 subio como si fuera un fallo del proveedor.
 *
 * DOS COSAS MAL, Y LA SEGUNDA ES LA QUE IMPORTA:
 *   1. Gastar el unico reintento en una espera que sabemos insuficiente no ayuda a nadie.
 *   2. Y el mensaje mandaba a mirar la configuracion, que estaba bien. Una cola dicha como fallo hace
 *      buscar donde no es, que es la forma mas cara de perder el tiempo de un profesional.
 */
export class ColaDelProveedorError extends Error {
  constructor(readonly segundos: number | null) {
    super(
      segundos != null
        ? `El proveedor pide esperar ${segundos}s (tope por minuto)`
        : "El proveedor esta en cola por tope por minuto",
    );
    this.name = "ColaDelProveedorError";
  }
}

/**
 * Corre `pedir`; si el proveedor responde con el tope por minuto, espera lo que pide y lo intenta UNA
 * vez mas. Un solo reintento, no una cadena: si el tope sigue tocado despues de esperar lo que el propio
 * proveedor pidio, el problema ya no es la cola y ahi si corresponde el fallback.
 *
 * Y SI PIDE MAS DE LO QUE PODEMOS ESPERAR, no se reintenta: se dice que es una cola y cuanto pide. El
 * techo existe porque el profesional tiene al paciente delante; esperar la mitad de lo que hace falta no
 * respeta el techo Y desperdicia el intento.
 */
export async function conReintentoAnteTope<T>(
  pedir: () => Promise<T>,
): Promise<T> {
  try {
    return await pedir();
  } catch (e) {
    if (!esTopePorMinuto(e)) throw e;
    const seg = segundosDeEspera(e.body);
    if (seg != null && seg * 1000 > ESPERA_MAX_MS) throw new ColaDelProveedorError(seg);
    const espera = Math.min(
      seg != null ? seg * 1000 : ESPERA_DEFECTO_MS,
      ESPERA_MAX_MS,
    );
    await new Promise((r) => setTimeout(r, espera));
    try {
      return await pedir();
    } catch (e2) {
      // Sigue en cola despues de esperar lo que el mismo pidio: se sigue diciendo lo que es.
      if (esTopePorMinuto(e2)) throw new ColaDelProveedorError(segundosDeEspera(e2.body));
      throw e2;
    }
  }
}
