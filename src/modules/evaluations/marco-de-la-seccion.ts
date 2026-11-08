// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL MARCO DE REFERENCIA DE CADA SECCION DE LA ENCUESTA  ·  v15 §7.1 / §2.6, 2026-11-07
//
// ═══ QUE PIDE, Y POR QUE NO ES DECORACION ═══
//
// Textual de su v15: *"Cada sección muestra su marco: «patrón usual de consumo» en D1 (no es un
// recordatorio de 24 horas); «últimas dos semanas» en D2, D3, D4, D6, D7 y D8; «situación actual» en D5 y
// Confirmar; «desde la última consulta» en Módulo S y Cierre. **El marco de dos semanas también se agrega
// a la encuesta de línea base.**"*
//
// Esa ultima frase es la que trae esto hoy: el marco NO es solo de la CNV-S. Y no es ayuda de pantalla,
// es la VENTANA DE RECUERDO del instrumento: "¿fumas?" contestada pensando en el ultimo año y contestada
// pensando en las ultimas dos semanas son dos preguntas distintas con el mismo enunciado. Sin el marco,
// cada paciente elige su propia ventana y las respuestas de dos personas dejan de ser comparables, que es
// justo lo que un instrumento existe para evitar.
//
// ═══ POR QUE SE DERIVA DEL DOMINIO Y NO DEL ROTULO DE LA SECCION ═══
//
// El icono de la seccion y su parrafo de ayuda se buscan hoy por el ROTULO en español ("Alimentación"), y
// para ellos esta bien: si alguien renombra la seccion, se pierde un icono. Aqui no: lo que se perderia
// es la ventana de recuerdo de un cuestionario clinico, EN SILENCIO y sin que ningun test de tipos lo
// vea. Asi que el marco se deriva del `field_key` (d1_…, d2_…), que es la clave del instrumento y la que
// no cambia porque alguien ajuste una etiqueta.
//
// MODULO NEUTRO (sin `server-only` ni `"use client"`): lo importan el formulario del paciente, que es de
// cliente, la vista de solo lectura del profesional y los tests.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El marco por dominio, con su texto para el paciente.
 *
 * LOS TRES TEXTOS SON LA TRADUCCION AL TUTEO DE SUS TRES MARCOS, no tres redacciones nuevas: "patrón
 * usual de consumo", "últimas dos semanas" y "situación actual". Lo que es nuestro es el armazon de la
 * frase, que es redaccion para el paciente; el periodo que nombra cada una es suyo.
 */
const MARCO_POR_DOMINIO: Record<string, string> = {
  d1: "Piensa en tu patrón usual de consumo, no en lo que comiste ayer.",
  d2: "Piensa en las últimas dos semanas.",
  d3: "Piensa en las últimas dos semanas.",
  d4: "Piensa en las últimas dos semanas.",
  // D5 son antecedentes y estilo de vida: su marco es la situación de hoy, no una ventana de recuerdo.
  d5: "Piensa en tu situación actual.",
  d6: "Piensa en las últimas dos semanas.",
  d7: "Piensa en las últimas dos semanas.",
  d8: "Piensa en las últimas dos semanas.",
};

/** El dominio (`d1`…`d8`) de una clave del instrumento, o `null` si la clave no es de la encuesta. */
export function dominioDeLaClave(fieldKey: string | null | undefined): string | null {
  if (!fieldKey) return null;
  const m = /^(d[1-8])(?:[_f]|$)/.exec(fieldKey);
  return m ? m[1] : null;
}

/**
 * El marco de una seccion, a partir de las claves de sus preguntas. `null` cuando la seccion no es de un
 * dominio de la encuesta (el paso "Sobre ti", por ejemplo), y entonces no se pinta nada.
 *
 * SE MIRA LA PRIMERA CLAVE QUE EXISTA, no la primera pregunta: una pregunta sin `field_key` es una que no
 * alimenta el motor, y hay varias repartidas. Tomar la primera a secas dejaria secciones enteras sin
 * marco segun donde cayera esa pregunta.
 */
export function marcoDeLaSeccion(
  preguntas: { fieldKey: string | null }[],
): { dominio: string; texto: string } | null {
  for (const p of preguntas) {
    const d = dominioDeLaClave(p.fieldKey);
    if (d && MARCO_POR_DOMINIO[d]) return { dominio: d, texto: MARCO_POR_DOMINIO[d] };
  }
  return null;
}

/** Los ocho marcos, para los candados y para cualquier superficie que los quiera listar. */
export const MARCOS_DE_LA_ENCUESTA = MARCO_POR_DOMINIO;
