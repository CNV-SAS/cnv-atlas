import { D1_FREQ_TXT, d1Clasificar, d1TextoPatron } from "./frozen/engine.d1-clasificacion.js";
import { ordinalesPatron } from "./patron";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL PATRON USUAL, YA CLASIFICADO, PARA LA IA  ·  v16 §4.5, 2026-11-07
//
// ═══ EL DEFECTO QUE CIERRA, Y LO DICE SU PROPIO DOCUMENTO ═══
//
// *"El texto que se envía para el diagnóstico integral listaba las 15 frecuencias sin categorías, y la IA
// podía describir la carne roja como protectora."*
//
// Ahi esta el problema completo: "Carnes rojas: nunca" es un dato cierto, y un modelo que lo lee junto a
// catorce frecuencias mas y sin ninguna categoria concluye lo razonable, que es lo equivocado. El dato no
// miente; lo que falta es la clasificacion, que es la que dice que la carne roja no se cuenta como
// protectora NUNCA, ni cuando su frecuencia es baja.
//
// ═══ POR QUE SE LE MANDA RESUELTO Y NO SE LE PIDE QUE CLASIFIQUE ═══
//
// Es la misma decision que ya se tomo cinco veces con este prompt (la direccion de la PABU, la lectura del
// ICEC, la composicion con su clasificacion, el parrafo de alertas y el cierre): cuando una lectura se
// puede resolver de forma determinista, se resuelve y se le entrega. Un prompt baja la frecuencia con la
// que el modelo se equivoca; no la lleva a cero. Y aqui el clasificador YA EXISTE y es el mismo que ve el
// profesional en la pantalla, asi que pedirselo al modelo seria abrir una segunda fuente de la misma
// clasificacion, que es justo lo que la §4.1 de su v16 vino a cerrar.
//
// PURO (regla dura 12): sin React, sin Next, sin Supabase. Recibe el `enc` con el TEXTO de cada opcion,
// que es como Atlas guarda las respuestas, y lo convierte a ordinales con `ordinalesPatron`, la MISMA
// canon que usa el motor del patron. Escrita a mano aqui, una opcion renombrada dejaria de reconocerse y
// el bloque saldria vacio EN SILENCIO.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Las cuatro categorias de su vista D1, y la que lleva cada grupo en el texto que recibe el modelo. */
const CATEGORIA: Record<string, string> = {
  protector: "Protector",
  neutro: "Moderar",
  riesgo: "Riesgo",
};

export type PatronParaLaIa = {
  /** La frase del patron, verbatim del motor (`d1TextoPatron`). */
  frase: string;
  /** Una linea por grupo respondido: nombre, frecuencia en palabras y categoria. */
  porGrupo: string[];
};

/**
 * El bloque del patron usual que viaja al modelo, o `null` si no hay ninguna frecuencia respondida.
 *
 * `null` y no un bloque vacio: un apartado con titulo y sin filas le dice al modelo que mire algo que no
 * esta, y de ahi salen las frases sobre un patron que nadie respondio.
 */
export function patronParaLaIa(enc: Record<string, unknown>): PatronParaLaIa | null {
  const c = d1Clasificar(ordinalesPatron(enc), false);
  if (!c.respondidos) return null;
  return {
    frase: d1TextoPatron(c),
    // CADA GRUPO CON SU CATEGORIA Y SU FRECUENCIA EN PALABRAS, que es lo que su §4.5 enumera. La
    // frecuencia va en palabras y no como ordinal: "3" no significa nada para un lector, y el modelo
    // escribe lo que lee.
    porGrupo: c.grupos
      .filter((g) => g.v != null)
      .map((g) => {
        // LAS CARNES ROJAS LLEVAN "LIMITAR", que no es ninguna de las tres categorias del modelo: es su
        // etiqueta propia para el grupo 15 (su §4.4). La misma que ve el profesional en la vista D1.
        const cat = g.n === 15 ? "Limitar" : (CATEGORIA[g.cat] ?? "Moderar");
        // LA FRECUENCIA SE TOMA DE SU PROPIA TABLA (`D1_FREQ_TXT`) y no se recorta de `d1Lista`: esa
        // funcion compone prosa (nombre + frecuencia entre parentesis), y recortarle el nombre dejaba la
        // linea con un parentesis suelto. Es el mismo dato, leido de donde esta.
        return `${g.label}: ${D1_FREQ_TXT[g.v as number] ?? "—"} — categoría: ${cat}`;
      }),
  };
}
