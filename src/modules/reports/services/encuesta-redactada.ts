import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";
import {
  textoDeLaRespuesta,
  type NombresDeProductos,
} from "@/modules/evaluations/respuesta-en-texto";

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

/**
 * Una respuesta, ya en texto. LA LECTURA ES LA COMPARTIDA (`respuesta-en-texto`), no una propia.
 *
 * Aqui vivia una cuarta copia de "como se lee una respuesta guardada", y por eso el S1 de la CNV-S
 * habria salido en el SOAP como el objeto JSON crudo, con los ids de los productos dentro, y una multi
 * confirmada como un arreglo dentro de otro. El tipo de la pregunta y los nombres de los productos los
 * pasa quien llama, que es quien los tiene.
 */
function respuestaEnTexto(
  valor: unknown,
  tipo?: string | null,
  nombres?: NombresDeProductos,
): string {
  if (valor == null) return "";
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim()).filter(Boolean).join(", ");
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  if (typeof valor === "object") return JSON.stringify(valor);
  return textoDeLaRespuesta(String(valor), { tipo, nombres });
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
function respondida(texto: string): boolean {
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
    const texto = respuestaEnTexto(q.answerValue, q.questionType, q.nombresDeProductos);
    if (!respondida(texto)) {
      faltantes.push(q.number);
      continue;
    }
    const etiqueta = preguntaComoEtiqueta(q.questionText);
    conRespuesta.push(`${etiqueta}: ${texto}`);
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
