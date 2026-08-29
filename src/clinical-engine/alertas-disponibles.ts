// Modulo congelado en JS. `allowJs` lo resuelve, asi que NO lleva ts-expect-error.
import { generarAlertas } from "./frozen/atlas-alertas.js";
import { FREQ_OPC } from "./frozen/engine.patron.js";

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

// TRADUCCION DE CAMPOS, y es SU instruccion, no una decision nuestra.
//
// `generarAlertas` lee `d1_14`, `d1_15` y `d1_16`, que son de la matriz de 18 items y no existen en la
// de 15. Su respuesta del 2026-08-28, punto 11b, textual: "Las dos leen el grupo equivocado y LAS DOS
// DEBEN LEER d1_13, azucares anadidos y bebidas azucaradas. Portenla ya con la correccion; NO LA PORTEN
// LITERAL PARA QUE YO LA ARREGLE DESPUES". Y sobre el agua, su mapeo del 2026-07-28: "Hidratacion ->
// enc.d7_agua, vasos de 200 ml, LA MISMA UNIDAD QUE ESPERABA d1_16".
//
// Se traduce AQUI y no en el frozen a proposito: asi su funcion sigue byte a byte la suya (el candado de
// transcripcion la coteja contra su archivo) y la correccion queda visible como lo que es, una capa
// nuestra con su instruccion citada al lado.
const CAMPOS_TRADUCIDOS: ReadonlyMap<string, { desde: string; escala: "indice" | "numero" }> = new Map([
  // Su condicion es `>= 2` sobre un INDICE 0-4, no sobre porciones: en su objeto demo estos campos valen
  // 1 y 2, y `FREQ_OPC` tiene cinco opciones. Nuestra encuesta guarda el TEXTO de la opcion, asi que hay
  // que convertirlo; leerlo crudo daria null y la regla se saltaria MUDA, que es como fallan los portes
  // que no verifican la FORMA del dato.
  ["d1_14", { desde: "d1_13_i", escala: "indice" }],
  ["d1_15", { desde: "d1_13_i", escala: "indice" }],
  // El agua no es un indice: son vasos. Su regla pide `<= 3` y `>= 8`, que solo tienen sentido contados.
  ["d1_16", { desde: "d7_agua", escala: "numero" }],
]);

/** Traduce los campos de la encuesta vieja a los de la vigente, con su instruccion como fuente. */
function traducirCampos(enc: Record<string, unknown>): Record<string, unknown> {
  const out = { ...enc };
  for (const [viejo, { desde, escala }] of CAMPOS_TRADUCIDOS) {
    const v = enc[desde];
    if (v == null || v === "") continue;
    if (escala === "indice") {
      const i = FREQ_OPC.indexOf(String(v));
      if (i >= 0) out[viejo] = i;
    } else {
      const n = Number(v);
      if (!isNaN(n)) out[viejo] = n;
    }
  }
  return out;
}
/** Las reglas que hoy NO pueden correr, con su motivo. Para explicarlo en pantalla, no para decorar. */
export const ALERTAS_NO_DISPONIBLES = {
  porConsumo: 10,
  disponibles: 5,
} as const;

/**
 * Corre sus quince reglas con los insumos nutricionales VACIOS y devuelve las que quedan en pie.
 *
 * Llamar con `cons` y `rda` vacios no es un truco: es lo que apaga las diez reglas de consumo SIN una
 * lista blanca que haya que mantener sincronizada. `undefined > 3000` es false, `undefined < NaN` es
 * false, y las que dependen de `get` o `peso` se saltan por la guarda que el mismo escribio. Una lista
 * blanca a mano quedaria desactualizada el dia que el agregue una regla; esto no.
 */
// REGLAS QUE NO SE EVALUAN SI LES FALTA SU INSUMO, y hace falta una por una: la traduccion de campos NO
// alcanza para esto. Su funcion trata el dato ausente como 0, y para las diez de consumo eso las apaga
// solas (undefined > 3000 es false), pero para el agua el 0 es CUMPLIR: `agua <= 3` con agua ausente es
// verdadero SIEMPRE, asi que "Deshidratacion probable" se disparaba por la orina oscura sola y le
// afirmaba al profesional "Agua: 0 vasos" sobre una pregunta sin responder.
//
// La conducta es la misma que el fijo para el ISCM en el punto 4 y para calcLE8 en CA-3: sin el insumo,
// el indicador NO SE EMITE. Un cero medido si cuenta (un paciente que responde 0 vasos esta deshidratado
// de verdad, y la alerta debe salir); lo que frena es la AUSENCIA.
const INSUMO_REQUERIDO: ReadonlyMap<string, string> = new Map([
  ["Deshidratación probable", "d7_agua"],
  ["Hidratación adecuada", "d7_agua"],
]);

export function alertasDisponibles(enc: Record<string, unknown>): AlertaClinica[] {
  const todas = generarAlertas(traducirCampos(enc), {}, 0, {}, 0) as AlertaClinica[];
  return todas.filter((a) => {
    const campo = INSUMO_REQUERIDO.get(a.t);
    return campo == null || (enc[campo] != null && enc[campo] !== "");
  });
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
