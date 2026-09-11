// ═══ LAS DOS DECLARACIONES, JUNTAS. NI CRUCE NI INFERENCIA ═══
//
// Modulo NEUTRO (ni `server-only` ni `"use client"`): lo comparten el reader del servidor y el componente
// que lo pinta. Es puro a proposito, porque lo que hace y lo que NO hace tiene que poder leerse de un
// vistazo y probarse sin base de datos.
//
// ── DE DONDE SALE, PORQUE LAS DOS AUTORIDADES LLEGARON AQUI POR CAMINOS DISTINTOS ────────────────
//
// La §7.7 del modelo comercial exigia BLOQUEO ACTIVO: no dejar recomendar un producto con alergeno a un
// paciente con intolerancia declarada, con confirmacion y registro. El asesor legal la RETIRO el
// 2026-09-11 con este argumento: el principio confundia USAR el dato con BLOQUEAR con el dato. Bloquear
// obliga a Atlas a afirmar que la alergia y el alergeno son incompatibles, y eso es una INFERENCIA
// CLINICA; un Atlas que infiere clinicamente contradice el Anexo 3 y el consentimiento YA FIRMADO, donde
// dice que Atlas no diagnostica y que el profesional interpreta. Construirlo no cerraba un flanco: abria
// uno nuevo contra documentos firmados.
//
// Y Direccion Cientifica lo habia negado antes por su lado: traducir un ingrediente a una alergia es
// contenido clinico que su modelo no tiene, y un cruce que no ve el alimento que lleva el alergeno sin
// nombrarlo "no le quita la responsabilidad a CNV: la esconde detras de una pantalla que el profesional
// aprende a creerle".
//
// ── LAS DOS REGLAS QUE MANTIENEN ESTO DEL LADO CORRECTO ──────────────────────────────────────────
//
// 1. SE MUESTRA LA LISTA COMPLETA de lo que el producto declara, no solo lo que coincide. Es del asesor y
//    es la parte fina: asi el profesional ve ingredientes que un filtro nunca le habria mostrado.
//
// 2. LA APARICION NO DEPENDE DE QUE HAYA COINCIDENCIA. Esta es la que es facil de romper y la que lo
//    convierte todo en un cruce si se rompe: si el bloque apareciera solo al coincidir, SU SOLA PRESENCIA
//    seria una clasificacion, y el profesional aprenderia que "si sale el aviso, hay problema". Eso es
//    exactamente la pantalla que aprende a creerle. Por eso aqui no hay ninguna funcion que compare las
//    dos listas, y no debe haberla: el dia que alguien escriba `alergias.includes(alergeno)` en este
//    archivo, el disenio entero se cayo.

/** Lo que el PACIENTE declaro, textual, tal como quedo en su encuesta (P43 y P44). */
export type DeclaracionDelPaciente = {
  alergias: string[]; // d6_43
  intolerancias: string[]; // d6_44
};

/** Lo que el PRODUCTO declara, textual, tal como lo dice la ficha del fabricante. */
export type DeclaracionDelProducto = {
  alergenos: string[]; // `nutraceutical_allergens.declared_as`, completo
};

export const SIN_DECLARACION: DeclaracionDelPaciente = { alergias: [], intolerancias: [] };

// "Ninguna" no es una declaracion de alergia: es la ausencia de una. Dejarla pasar llenaria la pantalla de
// bloques que dicen "este paciente declaro: Ninguna", que es ruido con forma de advertencia.
const ES_AUSENCIA = /^\s*ninguna?\s*$/i;

/**
 * Normaliza el valor crudo de una respuesta a lista de textos.
 *
 * Las de opcion multiple se guardan como JSON array; las de opcion simple, como texto. Se acepta lo que
 * venga y se descarta lo que no sea texto util, porque este dato ya viajo por el intake publico.
 *
 * NO se le quita el prefijo "Otra: ". Lo que el paciente escribio ahi es justo el caso que importa (el
 * alergeno raro, el que no esta en la lista cerrada), y mostrarlo con su prefijo dice algo verdadero: que
 * lo escribio el, no que lo eligio de un menu.
 */
export function declaracionesDesdeRespuesta(valorCrudo: string | null | undefined): string[] {
  if (typeof valorCrudo !== "string") return [];
  const texto = valorCrudo.trim();
  if (texto === "") return [];

  let bruto: unknown = texto;
  if (texto.startsWith("[")) {
    try {
      bruto = JSON.parse(texto);
    } catch {
      // Un JSON roto no se adivina: se trata como el texto plano que es.
      bruto = texto;
    }
  }

  const lista = Array.isArray(bruto) ? bruto : [bruto];
  return lista
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x !== "" && !ES_AUSENCIA.test(x));
}

/**
 * Si las dos declaraciones se ponen juntas.
 *
 * Las DOS condiciones son de existencia, nunca de coincidencia: el paciente declaro algo Y el producto
 * declara algo. Es el texto literal del asesor ("cuando un producto declare alergenos y el paciente haya
 * declarado alergias o intolerancias"), y es lo que impide que la presencia del bloque signifique nada.
 */
export function hayQueYuxtaponer(
  paciente: DeclaracionDelPaciente,
  producto: DeclaracionDelProducto,
): boolean {
  const pacienteDeclaro = paciente.alergias.length > 0 || paciente.intolerancias.length > 0;
  return pacienteDeclaro && producto.alergenos.length > 0;
}
