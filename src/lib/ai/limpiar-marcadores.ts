// LIMPIA LOS MARCADORES DE FORMATO QUE EL MODELO METE AUNQUE SE LE PIDA QUE NO.
//
// POR QUE EXISTE. Gildardo, en su entrega del 2026-09-01 (§8): el texto clinico "debe parecer escrito por
// una persona", y el modelo que usamos (`gpt-oss`) escribe en markdown por defecto. Su arreglo, y la razon
// por la que se copia: "corregido por los dos lados, porque uno solo no basta. En el prompt, un bloque de
// formato explicito... y a la salida, un filtro que limpia esos marcadores POR SI EL MODELO DESOBEDECE,
// QUE ES LO QUE HACEN".
//
// Un prompt no es un contrato. Pedirle al modelo que no use asteriscos baja la frecuencia; no la lleva a
// cero. Y el sitio donde esto se ve es el criterio clinico, que se pinta como TEXTO PLANO
// (`whitespace-pre-wrap`): si el modelo devuelve `**negrita**`, el profesional ve los asteriscos.
//
// LO QUE NO HACE, y es deliberado: no reescribe el texto ni le cambia el sentido. Quita marcadores de
// FORMATO y nada mas. Un filtro que ademas "mejorara" la redaccion estaria editando contenido clinico.

/** Un guion suelto en su propia linea es un separador de markdown; dentro de una frase, no. */
const SEPARADOR_DE_LINEA = /^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm;

/** Encabezados `#`, `##`, `###`... al principio de linea. */
const ENCABEZADO = /^[ \t]*#{1,6}[ \t]+/gm;

/** Vinetas de lista: `- `, `* `, `+ ` al principio de linea. NO toca los guiones dentro de una frase. */
const VINETA = /^[ \t]*[-*+][ \t]+/gm;

/** Cita en bloque. */
const CITA = /^[ \t]*>[ \t]?/gm;

/**
 * Enfasis: `**negrita**`, `*cursiva*`, `__negrita__`, `_cursiva_`.
 *
 * SE EXIGE CONTENIDO NO VACIO Y SIN SALTO DE LINEA entre los marcadores. Sin eso, un texto con dos
 * asteriscos sueltos y lejanos se "cerraria" sobre parrafos enteros y se comeria lo de en medio.
 */
const ENFASIS = /(\*\*|__|\*|_)(?!\s)([^\n*_]+?)(?<!\s)\1/g;

/** Codigo entre acentos graves, y bloques de codigo enteros. */
const BLOQUE_CODIGO = /```[a-z]*\n?([\s\S]*?)```/g;
const CODIGO_EN_LINEA = /`([^`\n]+)`/g;

/**
 * Filas de tabla markdown: una linea que empieza y termina en `|`. Se quita la linea entera, incluida la
 * de separadores (`|---|---|`), y las de datos pasan a texto con separadores legibles.
 */
const SEPARADOR_TABLA = /^[ \t]*\|[ \t:|-]+\|[ \t]*$/gm;
const FILA_TABLA = /^[ \t]*\|(.+)\|[ \t]*$/gm;

/**
 * Emoji y simbolos pictograficos. Rango conservador: no toca tildes, enes, ni signos de puntuacion del
 * español, que es lo unico que habria que temer de un filtro sobre texto clinico en castellano.
 */
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu;

/**
 * Devuelve el texto sin marcadores de formato, conservando el contenido.
 *
 * El orden importa: los bloques de codigo y las tablas se resuelven ANTES que el enfasis, porque dentro
 * de ellos puede haber asteriscos que no son enfasis.
 */
export function limpiarMarcadores(texto: string): string {
  return (
    texto
      .replace(BLOQUE_CODIGO, (_m, dentro: string) => dentro)
      .replace(CODIGO_EN_LINEA, "$1")
      .replace(SEPARADOR_TABLA, "")
      .replace(FILA_TABLA, (_m, dentro: string) =>
        dentro
          .split("|")
          .map((c) => c.trim())
          .filter((c) => c !== "")
          .join(" · "),
      )
      .replace(SEPARADOR_DE_LINEA, "")
      .replace(ENCABEZADO, "")
      .replace(VINETA, "")
      .replace(CITA, "")
      .replace(ENFASIS, "$2")
      .replace(EMOJI, "")
      // Tres o mas saltos seguidos quedan en dos: quitar separadores deja huecos.
      .replace(/\n{3,}/g, "\n\n")
      // Espacios que quedaron al final de linea tras retirar un marcador.
      .replace(/[ \t]+$/gm, "")
      .trim()
  );
}

/** ¿El modelo desobedecio? Sirve para MEDIRLO, no para bloquear: el texto se limpia igual. */
export function traiaMarcadores(texto: string): boolean {
  return limpiarMarcadores(texto) !== texto.trim();
}
