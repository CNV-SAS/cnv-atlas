import { edadSiSePuede } from "./services/build-engine-input";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE UNA CONSULTA DESFASADA NO ENTRA AL RECALCULO  ·  MODULO NEUTRO
//
// ═══ POR QUE VIVE APARTE, Y NO DENTRO DEL LECTOR ═══
//
// Lo necesitan DOS sitios: la pantalla de recalibracion (`desfasadas-reader`, que es `server-only` y va
// bajo RLS) y la simulacion del recalculo, que mide cuantas consultas ofrecera esa pantalla antes de que
// Santiago autorice la ejecucion. Escrito dos veces, la simulacion mediria un conjunto y la pantalla
// ofreceria otro, y la diferencia seria invisible: es el mismo defecto que ya aparecio con la guarda de
// "sin dominio 3" del freno, escrita dos veces y ya divergiendo. Una sola puerta.
//
// Modulo NEUTRO a proposito (sin `server-only`): es logica pura, sin BD. La regla de fronteras de
// CLAUDE.md es justo esta: el valor que comparten dos lados vive en un modulo neutro.
//
// ═══ LOS DOS CORTES SALEN DEL FROZEN, NO DE AQUI ═══
//
// `eb-bis-v7.js`: `if (!Number.isInteger(edad) || edad < 18 || edad > 100) return { estado: 'pendiente',
// motivo: 'edad no válida' }`. O sea que fuera de ese rango la v7 NO puntua, y reemitir deja el dominio 3
// del DFI en blanco. La exclusion no es nuestra: es la calibracion de su v7.
//
// EL CORTE DE ARRIBA FALTABA, Y SE VIO EN LA SIMULACION (2026-11-07). Cinco consultas pierden el dominio 3
// al recomputar, todas con "edad no valida", y ninguna esta entre las que el motor no puede correr: su
// fecha SI se lee. Con solo el corte de abajo, una consulta de mas de 100 anos se habria ofrecido para
// reemitir y habria vuelto con la EB-BIS en "pendiente" y el dominio 3 en blanco, que es exactamente lo
// que esta exclusion existe para impedir.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El corte de abajo de la v7, leido del frozen y no escrito aqui. Ver `eb-bis-v7.js`. */
export const EDAD_MINIMA_EB_BIS = 18;
/** Y el de arriba, del mismo sitio y de la misma linea. */
export const EDAD_MAXIMA_EB_BIS = 100;

/**
 * El motivo por el que una evaluacion desfasada NO entra al recalculo, o `null` si entra.
 *
 * EL ORDEN IMPORTA Y NO ES ARBITRARIO: se nombra primero lo que hay que RESOLVER (la huella repetida, que
 * es un dato posiblemente del paciente equivocado) y despues lo que es una condicion del paciente (la
 * edad, que no se resuelve). Si una fila tiene las dos cosas, la que hay que mirar es la primera.
 *
 * La frase es la que ve una persona en la pantalla, asi que va en español correcto.
 */
export function motivoParaNoReemitir(a: {
  huellaRepetida: boolean;
  nacimiento: string | null;
  hasta: Date;
}): string | null {
  return motivoDeNoReemitir(a)?.texto ?? null;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LA MISMA PUERTA, CLASIFICADA  ·  2026-11-07
//
// ═══ POR QUE HACE FALTA LA CLASE Y NO BASTA EL TEXTO ═══
//
// El aviso ambar de "reemisión obligatoria" PIDE UNA ACCION, y hay consultas donde esa accion no existe:
// un paciente que al medirse tenía 15 años nunca se va a recalcular, porque la v7 no se calibro ahi. El
// aviso le decia a la profesional que reemitiera, la pantalla no se lo ofrecia, y el aviso no se podia
// quitar. Un freno sin salida no es un guard: detiene a una persona.
//
// Los tres motivos no son el mismo caso, y por eso hay que poder DISTINGUIRLOS en la pantalla:
//
//   · `huella-repetida` SI tiene salida, y es la unica que de verdad hay que resolver: decidir de quien
//     es la toma. El aviso se queda y nombra el camino.
//   · `sin-fecha` tambien tiene salida (registrar la fecha de nacimiento del paciente) y despues se
//     reemite por el flujo normal. Son las 14 de la simulacion.
//   · `fuera-de-calibracion` NO tiene ninguna, y no es un problema que arreglar: es una condicion del
//     paciente. Ahi el aviso deja de pedir accion y se vuelve una nota fija y neutra.
//
// EL TEXTO SE DERIVA DE LA CLASE y no se escribe dos veces: la pantalla de recalibracion seguia
// necesitando la frase, asi que `motivoParaNoReemitir` queda como envoltorio y las dos lecturas no pueden
// divergir. Es la misma razon por la que este modulo existe.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type MotivoDeNoReemitir =
  /** La misma toma fisica esta en otra consulta vigente. Hay que decidir de quien es. */
  | { clase: "huella-repetida"; texto: string }
  /** Sin fecha de nacimiento legible: se registra y despues se reemite por el flujo normal. */
  | { clase: "sin-fecha"; texto: string }
  /** Fuera del rango donde la v7 puntua. No se resuelve: es una condicion del paciente. */
  | { clase: "fuera-de-calibracion"; texto: string; edad: number };

/** Lo mismo que `motivoParaNoReemitir`, con la CLASE, para que una pantalla pueda decidir el registro. */
export function motivoDeNoReemitir(a: {
  huellaRepetida: boolean;
  nacimiento: string | null;
  hasta: Date;
}): MotivoDeNoReemitir | null {
  if (a.huellaRepetida) {
    return {
      clase: "huella-repetida",
      texto:
        "Su medición está repetida en otra consulta: hay que resolver a quién pertenece antes de recalcular.",
    };
  }
  const edad = edadSiSePuede(a.nacimiento, a.hasta);
  if (edad === null) {
    return {
      clase: "sin-fecha",
      texto:
        "Sin fecha de nacimiento legible: la edad entra en la EB-BIS, así que no se puede recalcular.",
    };
  }
  if (edad < EDAD_MINIMA_EB_BIS || edad > EDAD_MAXIMA_EB_BIS) {
    return {
      clase: "fuera-de-calibracion",
      edad,
      texto: `Tenía ${edad} años al medirse: la EB-BIS v7 se calibró entre los ${EDAD_MINIMA_EB_BIS} y los ${EDAD_MAXIMA_EB_BIS}.`,
    };
  }
  return null;
}
