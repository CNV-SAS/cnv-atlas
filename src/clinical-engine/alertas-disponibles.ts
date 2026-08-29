// Modulo congelado en JS. `allowJs` lo resuelve, asi que NO lleva ts-expect-error.
import { generarAlertas } from "./frozen/atlas-alertas.js";

// ADAPTADOR entre `generarAlertas` (frozen, quince reglas) y lo que Atlas puede mostrar HOY sin mentir.
//
// El frozen no se toca. Lo que decide aqui es cuales de sus reglas tienen sus insumos, y esa decision es
// nuestra y es de INGENIERIA, no clinica: no cambiamos ni un umbral ni un texto suyo, solo dejamos de
// preguntar por lo que no podemos responder.

export type NivelAlerta = "crítico" | "alto" | "moderado" | "positivo";

export interface AlertaClinica {
  niv: NivelAlerta;
  ico: string;
  t: string;
  txt: string;
  dom: string;
}

// Reglas que su funcion emite pero que Atlas NO muestra, cada una con su motivo. Se excluyen POR TITULO
// porque el titulo es su identificador estable dentro de la funcion; el orden no lo es.
const EXCLUIDAS: ReadonlyMap<string, string> = new Map([
  [
    "Deshidratación probable",
    // La unica que no esta simplemente muerta: MIENTE. Pide `agua <= 3` sobre `enc.d1_16`, un campo de la
    // encuesta anterior que ya no existe, asi que `agua` es siempre 0 y esa mitad de la condicion se
    // cumple SIEMPRE. La regla queda reducida a "orina oscura", y su texto le afirma al profesional
    // "Agua: 0 vasos" sobre una pregunta que el paciente nunca respondio. Un texto que describe mal lo
    // que el motor hizo es un defecto de seguridad, no de redaccion: induce a decidir sobre un dato
    // inventado. Vuelve en cuanto Gildardo diga con que campo se lee el agua (d7_agua es su propio
    // mapeo del 2026-07-28, pero aplicarlo aqui seria decidirlo nosotros).
    "lee d1_16 (encuesta anterior); con agua siempre 0 se dispara solo por la orina y afirma '0 vasos'",
  ],
]);

/** Las reglas que hoy NO pueden correr, con su motivo. Para explicarlo en pantalla, no para decorar. */
export const ALERTAS_NO_DISPONIBLES = {
  porConsumo: 10,
  porCampoInexistente: 4,
  disponibles: 1,
} as const;

/**
 * Corre sus quince reglas con los insumos nutricionales VACIOS y devuelve las que quedan en pie.
 *
 * Llamar con `cons` y `rda` vacios no es un truco: es lo que apaga las diez reglas de consumo SIN una
 * lista blanca que haya que mantener sincronizada. `undefined > 3000` es false, `undefined < NaN` es
 * false, y las que dependen de `get` o `peso` se saltan por la guarda que el mismo escribio. Una lista
 * blanca a mano quedaria desactualizada el dia que el agregue una regla; esto no.
 */
export function alertasDisponibles(enc: Record<string, unknown>): AlertaClinica[] {
  const todas = generarAlertas(enc, {}, 0, {}, 0) as AlertaClinica[];
  return todas.filter((a) => !EXCLUIDAS.has(a.t));
}

/** Motivo por el que una regla suya no se muestra, o `null` si si se muestra. */
export function motivoDeExclusion(titulo: string): string | null {
  return EXCLUIDAS.get(titulo) ?? null;
}

/**
 * Arma el `enc` que sus reglas esperan a partir de las respuestas YA leidas de la pantalla.
 *
 * No hace consulta nueva: es el mismo patron que `resolverAntecedentes`. Y va sobre `fieldKey`, nunca
 * sobre el numero ni la posicion de la pregunta: el numero que ve el paciente es continuo y los codigos
 * tienen huecos, asi que anclarse en la posicion se desincroniza en cuanto se inserta una pregunta.
 */
export function encDesdeRespuestas(
  preguntas: { fieldKey: string | null; answerValue: string | null }[],
): Record<string, unknown> {
  const enc: Record<string, unknown> = {};
  for (const q of preguntas) {
    if (!q.fieldKey || q.answerValue == null) continue;
    // Las de opcion multiple viajan como JSON; sus reglas hacen `Array.isArray`, asi que un string con
    // pinta de array no les sirve: tiene que llegar como arreglo de verdad.
    if (q.answerValue.startsWith("[")) {
      try {
        const v: unknown = JSON.parse(q.answerValue);
        enc[q.fieldKey] = Array.isArray(v) ? v : q.answerValue;
      } catch {
        enc[q.fieldKey] = q.answerValue;
      }
    } else {
      enc[q.fieldKey] = q.answerValue;
    }
  }
  return enc;
}
