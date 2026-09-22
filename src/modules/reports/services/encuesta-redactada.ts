import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";

// ═══ LA ENCUESTA, REDACTADA POR DOMINIO (plan del SOAP, forma B) ═══
//
// QUE HACE Y QUE NO. Enhebra las respuestas de un dominio en un párrafo. NO interpreta, NO clasifica, NO
// cruza respuestas y NO añade nada que el paciente no haya marcado. Cada frase del párrafo es trazable a
// una pregunta concreta, y esa trazabilidad es justo la razón por la que se eligió esta forma y no una
// frase escrita a mano por pregunta (sesenta decisiones de redacción nuestras) ni una narrativa de IA.
//
// POR QUE LA PREGUNTA VA EN LA FRASE, y no solo la respuesta: "3" no dice nada; "cuántas comidas consume
// al día: 3" sí, y además deja ver de dónde salió. Un documento clínico que afirma sin decir de dónde
// obliga a ir a buscarlo a otra pantalla.
//
// LO QUE NO SE RESPONDIO SE DICE, no se omite: en un documento probatorio, una ausencia silenciosa se lee
// como que no se preguntó. Van al final del párrafo, por número.
//
// PURO: sin BD ni server-only. Lo llaman el lector del SOAP y sus tests, con casos escritos a mano.

/** Una respuesta, ya en texto. Las múltiples se unen con coma; el objeto raro se serializa antes que perderse. */
function respuestaEnTexto(valor: unknown): string {
  if (valor == null) return "";
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim()).filter(Boolean).join(", ");
  // LAS DE OPCION MULTIPLE LLEGAN COMO JSON ("[\"Ejercicio excesivo\",\"Vómito\"]"), y salian asi, crudas, en la S
  // (Santiago, 2026-09-21). Se leen como lista; si no parsean, se muestran tal cual antes que perderlas.
  if (typeof valor === "string" && valor.trim().startsWith("[")) {
    try {
      const lista: unknown = JSON.parse(valor);
      if (Array.isArray(lista)) return lista.map((v) => String(v).trim()).filter(Boolean).join(", ");
    } catch {
      // no era JSON
    }
  }
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor).trim();
}

/**
 * La pregunta como ETIQUETA de la frase: sin los signos de interrogación y con la primera letra en
 * minúscula, para que encaje dentro de la oración ("Refiere: cuántas comidas consume al día: 3").
 *
 * NO se reescribe el texto de la pregunta, solo se le quitan los signos: el texto es contenido de la
 * encuesta y cambiarlo aquí sería decir que se preguntó otra cosa.
 */
export function preguntaComoEtiqueta(texto: string): string {
  const limpia = texto.trim().replace(/^¿+\s*/, "").replace(/\s*\?+$/, "").trim();
  if (limpia.length === 0) return "";
  return limpia[0].toLocaleLowerCase("es-CO") + limpia.slice(1);
}

/** ¿Hay respuesta? Se usa el mismo criterio que el resto del sistema: vacío y "Otra" pelada no cuentan. */
function respondida(valor: unknown): boolean {
  const texto = respuestaEnTexto(valor);
  if (texto === "") return false;
  // "Otra" sin el texto que la acompaña es un hueco, no una respuesta (la misma regla que `isAnswered`).
  return !/^otra?$/i.test(texto);
}

export type ParrafoDeDominio = {
  /** El nombre del dominio, tal como viene de la encuesta ("D4 · Conductas alimentarias"). */
  dominio: string;
  /** El párrafo ya redactado. Cadena vacía si no hay ninguna respuesta que contar. */
  texto: string;
  /** Cuántas quedaron sin responder en este dominio (ya dichas dentro del texto). */
  sinResponder: number;
};

/** Redacta UN dominio. Devuelve el párrafo y cuántas preguntas quedaron sin responder. */
export function redactarDominio(
  dominio: SurveyDomain,
  /** Preguntas que ya dice otro bloque del documento (los antecedentes): no se repiten aqui. */
  omitir: ReadonlySet<string> = new Set(),
): ParrafoDeDominio {
  const conRespuesta: string[] = [];
  const faltantes: number[] = [];

  for (const q of dominio.questions) {
    if (omitir.has(q.questionId)) continue;
    if (!respondida(q.answerValue)) {
      faltantes.push(q.number);
      continue;
    }
    const etiqueta = preguntaComoEtiqueta(q.questionText);
    conRespuesta.push(`${etiqueta}: ${respuestaEnTexto(q.answerValue)}`);
  }

  const partes: string[] = [];
  if (conRespuesta.length > 0) partes.push(`Refiere ${conRespuesta.join("; ")}.`);
  if (faltantes.length > 0) {
    partes.push(
      faltantes.length === 1
        ? `Quedó sin responder la pregunta ${faltantes[0]}.`
        : `Quedaron sin responder las preguntas ${faltantes.join(", ")}.`,
    );
  }

  return { dominio: dominio.section, texto: partes.join(" "), sinResponder: faltantes.length };
}

/** Redacta la encuesta entera, un párrafo por dominio. Los dominios sin nada que contar se omiten. */
export function redactarEncuesta(
  domains: SurveyDomain[],
  omitir: ReadonlySet<string> = new Set(),
): ParrafoDeDominio[] {
  return domains.map((d) => redactarDominio(d, omitir)).filter((p) => p.texto !== "");
}
