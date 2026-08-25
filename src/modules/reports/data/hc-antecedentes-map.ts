// ANTECEDENTES PERSONALES de la historia clinica (bloque 3). Modulo NEUTRO y PURO (sin BD, sin React):
// lo alimentan las respuestas ya leidas y lo consume el componente.
//
// Por que un mapa declarativo y no "todo el dominio": la HC de Gildardo NO vuelca la encuesta entera, elige
// ocho antecedentes y los agrupa en cuatro subbloques (capturas 2026-08-24). Portamos esa seleccion.
//
// Y por que cada fila se resuelve por field_key O por texto: CUATRO de las ocho no tienen field_key (no
// entran al motor, P-39), asi que no hay identificador estable para ellas. El texto es fragil ante un bump
// de la encuesta, y por eso existe el candado que verifica que las OCHO resuelvan contra la version vigente:
// si una deja de resolver, falla ruidoso en vez de perder una fila en silencio.

import type { SurveyAnswerView } from "@/modules/evaluations/data/survey-answers-types";

export type HcAntecedenteRow = {
  id: string;
  etiqueta: string; // rotulo en la HC (el de Gildardo, no el enunciado de la encuesta)
  fieldKey?: string; // identificador estable cuando el motor lo consume
  patron?: RegExp; // ultimo recurso: las que no tienen field_key
  /** Chips en vez de fila etiqueta/valor (listas: diagnosticos, medicamentos). */
  comoLista?: boolean;
};

export type HcAntecedenteGrupo = { titulo: string; filas: HcAntecedenteRow[] };

// El orden y los titulos son los de su HC.
export const HC_ANTECEDENTES: HcAntecedenteGrupo[] = [
  {
    titulo: "Diagnósticos personales",
    filas: [
      { id: "dx", etiqueta: "Diagnósticos personales", fieldKey: "d5_39", comoLista: true },
      { id: "hta", etiqueta: "HTA diagnosticada", fieldKey: "d5_36" },
      { id: "hta_med", etiqueta: "Medicación antihipertensiva", patron: /medicamentos para la presión/i },
      { id: "familiares", etiqueta: "Antecedentes familiares", fieldKey: "d5_38" },
      { id: "lactancia", etiqueta: "Lactancia materna", patron: /amamantad/i },
    ],
  },
  {
    titulo: "Medicamentos actuales",
    filas: [{ id: "medicamentos", etiqueta: "Medicamentos actuales", fieldKey: "d5_40", comoLista: true }],
  },
  {
    titulo: "Alergias e intolerancias",
    filas: [
      { id: "alergias", etiqueta: "Alergias alimentarias", patron: /alergias alimentarias/i },
      { id: "intolerancias", etiqueta: "Intolerancias", patron: /intolerancias alimentarias/i },
    ],
  },
  {
    titulo: "Antecedente quirúrgico",
    filas: [
      // No esta en SU HC, y se agrega a proposito: una cirugia que afecta la digestion o el metabolismo
      // cambia absorcion, requerimiento proteico y tolerancia. Omitirla de la historia clinica porque su
      // prototipo no la muestra seria copiar un hueco.
      { id: "cirugia", etiqueta: "Cirugía digestiva o metabólica", patron: /cirugía que afecte la digestión/i },
    ],
  },
];

export type HcAntecedenteResuelto = {
  id: string;
  etiqueta: string;
  valores: string[]; // vacio = sin respuesta
  comoLista: boolean;
  /** El paciente lo declaro y el DIAGNOSTICO no lo consumio. DERIVADO de field_key, no escrito a mano:
   *  cuando P-39 se resuelva y la pregunta reciba su field_key, la marca desaparece sola. */
  declaradoNoConsumido: boolean;
  /** La pregunta no existe en esta version de la encuesta (distinto de existir y estar sin responder). */
  ausente: boolean;
};

/** Divide una respuesta guardada en sus valores: multi (JSON) o token plano. Conserva el texto de "Otra". */
export function valoresDeRespuesta(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  const s = raw.trim();
  if (s === "" || s === "[]") return [];
  if (s.startsWith("[")) {
    try {
      const arr: unknown = JSON.parse(s);
      if (Array.isArray(arr)) return arr.filter((el): el is string => typeof el === "string" && el.trim() !== "");
    } catch {
      return [s]; // no parseable: se muestra crudo antes que perderlo
    }
  }
  return [s];
}

function encontrar(answers: SurveyAnswerView[], fila: HcAntecedenteRow): SurveyAnswerView | null {
  if (fila.fieldKey) {
    const porKey = answers.find((a) => a.fieldKey === fila.fieldKey);
    if (porKey) return porKey;
  }
  if (fila.patron) {
    const p = fila.patron;
    return answers.find((a) => p.test(a.questionText)) ?? null;
  }
  return null;
}

export function resolverAntecedentes(
  answers: SurveyAnswerView[],
  grupos: HcAntecedenteGrupo[] = HC_ANTECEDENTES,
): { titulo: string; filas: HcAntecedenteResuelto[] }[] {
  return grupos.map((g) => ({
    titulo: g.titulo,
    filas: g.filas.map((fila) => {
      const q = encontrar(answers, fila);
      return {
        id: fila.id,
        etiqueta: fila.etiqueta,
        valores: valoresDeRespuesta(q?.answerValue),
        comoLista: fila.comoLista === true,
        // La marca sale del contrato del motor, no de una lista escrita a mano.
        declaradoNoConsumido: q != null && q.fieldKey == null,
        ausente: q == null,
      };
    }),
  }));
}
