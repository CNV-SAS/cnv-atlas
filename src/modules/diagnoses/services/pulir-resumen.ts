// ═══ EL PASO DETERMINISTA DESPUES DE GENERAR EL RESUMEN (2026-09-22) ═══
//
// POR QUE. Trece versiones del prompt, y el modelo seguia rompiendo reglas que ya tenia: comillas alrededor
// de las respuestas, la cadena interna de la PABU ("k=0,78 (H)") y formas de hipotesis ("sugiere una posible
// disociacion"). Una regla mas en el prompt baja la frecuencia del error; no lo quita. Es la leccion del
// parrafo de alertas y del cierre, que ya escribe Atlas.
//
// DOS COSAS DISTINTAS, porque se resuelven distinto:
//   · LO QUE SE PUEDE ARREGLAR SIN CAMBIAR EL SENTIDO se arregla aqui: quitar comillas y la cadena interna,
//     "sugiere" por "indica", y las respuestas en minuscula a media frase.
//   · LO QUE NO (una hipotesis, una recomendacion) no se borra: borrar una frase puede llevarse el dato que
//     traia. Se DETECTA; el servicio regenera una vez y, si vuelve, guarda el texto y la pantalla avisa.
//
// MODULO NEUTRO (sin "use client" ni server-only): lo usan el servicio que genera y la pantalla que avisa.

// Comillas alrededor de un tramo corto (una respuesta, una clasificacion). Rectas, tipograficas y angulares.
const ENTRE_COMILLAS = /["“”«»]([^"“”«»\n]{1,80})["“”«»]/g;

// La cadena interna de la PABU que el modelo copia del bloque del DFI: " k=0,78 (H)", " k = 0.78 (M)".
const CADENA_K = /\s*\(?\bk\s*=\s*\d+(?:[.,]\d+)?\s*\((?:H|M)\)\)?/g;

// "SUGIERE" NO ES UNA HIPOTESIS CUANDO ACOMPANA A UNA CLASIFICACION (Santiago, 2026-09-22). "IRC de 1,62
// (Bajo), sugiriendo un bajo riesgo" dice lo mismo que la clasificacion con otro verbo, y el aviso salia en
// los cuatro resumenes de la prueba: un aviso que sale siempre se aprende a ignorar. Se cambia por lo que la
// clasificacion dice. Si la frase SI era una hipotesis, lo que la delata es lo que sigue ("posible", "podria"),
// y eso se sigue detectando.
const SUGIERE: [RegExp, string][] = [
  [/\bsugiriendo\b/g, "indicando"],
  [/\bSugiriendo\b/g, "Indicando"],
  [/\bsugieren\b/g, "indican"],
  [/\bSugieren\b/g, "Indican"],
  [/\bsugiere\b/g, "indica"],
  [/\bSugiere\b/g, "Indica"],
];

// LAS RESPUESTAS EN MINUSCULA DENTRO DE LA FRASE (2026-09-22). Sin comillas, el modelo las copia con la
// mayuscula de la opcion: "consume Cereales refinados y harinas blancas... Todos los días". Se pasan a
// minuscula SOLO cuando van a media frase (detras de una palabra, una cifra, una coma, dos puntos o un
// parentesis que cierra, y un espacio) y
// SOLO si son respuestas de la encuesta de este paciente. Una sigla ("PCBU") no se toca: su segunda letra es
// mayuscula. Lo que va entre parentesis (una clasificacion) tampoco: no va detras de una palabra.
function minusculaEnLasRespuestas(texto: string, respuestas: readonly string[]): string {
  const tramos = new Set<string>();
  for (const r of respuestas) {
    for (const parte of r.split(/,\s*/)) {
      const s = parte.trim();
      if (s.length >= 3 && /^\p{Lu}\p{Ll}/u.test(s)) tramos.add(s);
    }
  }
  let out = texto;
  // Los mas largos primero: "Carnes rojas" antes que "Carnes".
  for (const s of [...tramos].sort((a, b) => b.length - a.length)) {
    const escapado = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`([\\p{L}\\d,;:)] )${escapado}(?![\\p{L}])`, "gu");
    out = out.replace(re, (_m, antes: string) => antes + s.charAt(0).toLocaleLowerCase("es-CO") + s.slice(1));
  }
  return out;
}

/**
 * Quita comillas y cadenas internas, cambia "sugiere" por "indica" y pasa a minuscula las respuestas que el
 * modelo integro a media frase. No cambia el sentido de nada.
 */
export function pulirResumen(texto: string, respuestas: readonly string[] = []): string {
  let out = texto.replace(ENTRE_COMILLAS, "$1").replace(CADENA_K, "");
  for (const [re, por] of SUGIERE) out = out.replace(re, por);
  return minusculaEnLasRespuestas(out, respuestas);
}

// Las formas que el prompt prohibe y el modelo sigue usando: hipotesis y recomendaciones. Por palabra
// completa, sin distinguir mayusculas.
// "sugiere" ya no esta: se cambia por "indica" (ver arriba).
export const FORMAS_PROHIBIDAS = [
  "posible",
  "posibles",
  "podría",
  "podrían",
  "predispone",
  "a largo plazo",
  "requiere atención",
  "requieren atención",
] as const;

/** Las formas prohibidas que trae el texto, en el orden de la lista y sin repetir. */
export function formasProhibidas(texto: string): string[] {
  const t = texto.toLocaleLowerCase("es-CO");
  return FORMAS_PROHIBIDAS.filter((f) => new RegExp(`(^|[^\\p{L}])${f}([^\\p{L}]|$)`, "u").test(t));
}
