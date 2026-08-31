import { FREQ_GROUPS, catColor, catLabel } from "./index";

// ENCABEZADOS DE GRUPO de la matriz de frecuencia (2026-08-29; alcance cambiado el 2026-08-31).
//
// Su regla, textual: "la agrupacion que ve el paciente es esa misma: EL ORDEN ES EL MENSAJE". Con los
// quince items seguidos y sin encabezados, no se ven las tres categorias del modelo; con ellas, la
// pantalla dice lo mismo que dice el archivo.
//
// SOLO SE PUDO PONER DESPUES DE CORREGIR EL ORDEN. Con las carnes rojas al final, un encabezado
// "procesados a reducir" habria quedado encima de ellas, que su modelo clasifica como NEUTRAS: el
// encabezado habria hecho VISIBLE, y por tanto peor, un error que antes solo estaba implicito.
//
// DONDE VAN, Y ES UNA DIVERGENCIA DECLARADA (decision de Santiago, 2026-08-31; punto 1 de la ronda del 31).
// Su archivo los pinta en la encuesta DEL PACIENTE, y ahi los portamos primero. Se RETIRAN de esa pantalla
// y quedan solo en las vistas del PROFESIONAL (ver y editar la encuesta), por SESGO DE DESEABILIDAD:
// rotular un bloque como "Procesados y ultraprocesados (PCBU)" ANTES de que el paciente conteste empuja la
// respuesta hacia lo que se espera de el, y esto es un cuestionario de frecuencia, donde ese sesgo esta
// descrito. Lo que NO se toca es el ORDEN, que es su mensaje: se retira el rotulo, no la agrupacion.
// Va a la ronda con las dos mitades y la pregunta, porque decidirlo en silencio seria consolidar una
// divergencia por omision.

/** Categoria de un grupo de frecuencia por su CLAVE, o null si la pregunta no es de la matriz. */
function categoriaDe(fieldKey: string | null): string | null {
  if (!fieldKey) return null;
  const m = /^d1_(\d+)_i$/.exec(fieldKey);
  if (!m) return null;
  return FREQ_GROUPS.find((g) => g.n === Number(m[1]))?.cat ?? null;
}

/** Encabezado de grupo: su etiqueta (sin emoji) y el color de la categoria, tambien suyo. */
export type EncabezadoFrecuencia = { etiqueta: string; color: string };

/**
 * Encabezado que va ANTES de esta pregunta, o null. Se decide comparando con la categoria de la anterior:
 * asi el encabezado aparece en el primer item de cada bloque sin que nadie escriba posiciones.
 *
 * Etiqueta y color salen de `catLabel`/`catColor` (frozen, suyos), no de una copia nuestra: dos fuentes
 * del mismo dato sin nada que las compare es como empezo el defecto del orden. A la etiqueta se le quita
 * el emoji porque la interfaz de Atlas no lleva, y eso es forma, no contenido.
 */
export function encabezadoAntesDe(
  fieldKey: string | null,
  fieldKeyAnterior: string | null,
): EncabezadoFrecuencia | null {
  const cat = categoriaDe(fieldKey);
  if (!cat) return null;
  if (cat === categoriaDe(fieldKeyAnterior)) return null;
  const etiqueta = (catLabel as Record<string, string>)[cat];
  const color = (catColor as Record<string, string>)[cat];
  if (!etiqueta || !color) return null;
  return { etiqueta: etiqueta.replace(/^[^\p{L}]+/u, "").trim(), color };
}
