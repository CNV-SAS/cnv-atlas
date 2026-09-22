// ═══ EL PASO DETERMINISTA DESPUES DE GENERAR EL RESUMEN (2026-09-22) ═══
//
// POR QUE. Trece versiones del prompt, y el modelo seguia rompiendo reglas que ya tenia: comillas alrededor
// de las respuestas, la cadena interna de la PABU ("k=0,78 (H)") y formas de hipotesis ("sugiere una posible
// disociacion"). Una regla mas en el prompt baja la frecuencia del error; no lo quita. Es la leccion del
// parrafo de alertas y del cierre, que ya escribe Atlas.
//
// DOS COSAS DISTINTAS, porque se resuelven distinto:
//   · LO QUE SE PUEDE ARREGLAR SIN CAMBIAR EL SENTIDO se arregla aqui: quitar comillas y la cadena interna.
//     No se toca ninguna palabra del modelo.
//   · LO QUE NO (una hipotesis, una recomendacion) no se borra: borrar una frase puede llevarse el dato que
//     traia. Se DETECTA; el servicio regenera una vez y, si vuelve, guarda el texto y la pantalla avisa.
//
// MODULO NEUTRO (sin "use client" ni server-only): lo usan el servicio que genera y la pantalla que avisa.

// Comillas alrededor de un tramo corto (una respuesta, una clasificacion). Rectas, tipograficas y angulares.
const ENTRE_COMILLAS = /["“”«»]([^"“”«»\n]{1,80})["“”«»]/g;

// La cadena interna de la PABU que el modelo copia del bloque del DFI: " k=0,78 (H)", " k = 0.78 (M)".
const CADENA_K = /\s*\(?\bk\s*=\s*\d+(?:[.,]\d+)?\s*\((?:H|M)\)\)?/g;

/** Quita comillas y cadenas internas. No cambia ninguna palabra. */
export function pulirResumen(texto: string): string {
  return texto.replace(ENTRE_COMILLAS, "$1").replace(CADENA_K, "");
}

// Las formas que el prompt prohibe y el modelo sigue usando: hipotesis y recomendaciones. Por palabra
// completa, sin distinguir mayusculas.
export const FORMAS_PROHIBIDAS = [
  "sugiere",
  "sugieren",
  "sugiriendo",
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
