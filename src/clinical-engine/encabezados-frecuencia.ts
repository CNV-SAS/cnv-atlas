import { FREQ_GROUPS, catLabel } from "./index";

// ENCABEZADOS DE GRUPO de la matriz de frecuencia (2026-08-29).
//
// Su regla, textual: "la agrupacion que ve el paciente es esa misma: EL ORDEN ES EL MENSAJE". Con los
// quince items seguidos y sin encabezados, el paciente no ve las tres categorias del modelo; con ellas,
// la pantalla dice lo mismo que dice el archivo.
//
// SOLO SE PUDO PONER DESPUES DE CORREGIR EL ORDEN. Con las carnes rojas al final, un encabezado
// "procesados a reducir" habria quedado encima de ellas, que su modelo clasifica como NEUTRAS: el
// encabezado habria hecho VISIBLE, y por tanto peor, un error que antes solo estaba implicito.

/** Categoria de un grupo de frecuencia por su CLAVE, o null si la pregunta no es de la matriz. */
function categoriaDe(fieldKey: string | null): string | null {
  if (!fieldKey) return null;
  const m = /^d1_(\d+)_i$/.exec(fieldKey);
  if (!m) return null;
  return FREQ_GROUPS.find((g) => g.n === Number(m[1]))?.cat ?? null;
}

/**
 * Encabezado que va ANTES de esta pregunta, o null. Se decide comparando con la categoria de la anterior:
 * asi el encabezado aparece en el primer item de cada bloque sin que nadie escriba posiciones.
 *
 * Las etiquetas salen de `catLabel` (frozen, suyas), no de una copia nuestra: dos fuentes del mismo texto
 * sin nada que las compare es como empezo el defecto del orden. Se les quita el emoji porque la interfaz
 * de Atlas no lleva, y eso es forma, no contenido.
 */
export function encabezadoAntesDe(
  fieldKey: string | null,
  fieldKeyAnterior: string | null,
): string | null {
  const cat = categoriaDe(fieldKey);
  if (!cat) return null;
  if (cat === categoriaDe(fieldKeyAnterior)) return null;
  const etiqueta = (catLabel as Record<string, string>)[cat];
  if (!etiqueta) return null;
  return etiqueta.replace(/^[^\p{L}]+/u, "").trim();
}
