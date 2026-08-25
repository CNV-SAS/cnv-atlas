import { describe, expect, it } from "vitest";

import {
  HC_ANTECEDENTES,
  resolverAntecedentes,
  valoresDeRespuesta,
} from "@/modules/reports/data/hc-antecedentes-map";
import type { SurveyAnswerView } from "@/modules/evaluations/data/survey-answers-types";

// CANDADO DE LOS ANTECEDENTES DE LA HISTORIA CLINICA (bloque 3, 2026-08-24).
//
// Lo que se blinda es sobre todo la MARCA DE PROCEDENCIA: que salga del contrato del motor (field_key) y
// no de una lista escrita a mano. Si se escribiera a mano, el dia que P-39 se resuelva y las cuatro
// preguntas reciban su field_key, la marca seguiria diciendo que el diagnostico no las usa: un texto que
// afirma un estado sin derivarlo.

const q = (o: Partial<SurveyAnswerView>): SurveyAnswerView => ({
  questionId: "x",
  number: 1,
  questionText: "",
  questionHint: null,
  questionType: "opcion",
  fieldKey: null,
  usedInDiagnosis: false,
  answerValue: null,
  options: [],
  ...o,
});

const fila = (grupos: ReturnType<typeof resolverAntecedentes>, id: string) =>
  grupos.flatMap((g) => g.filas).find((f) => f.id === id);

describe("antecedentes de la historia clinica", () => {
  it("la marca de procedencia se DERIVA del field_key, no de una lista", () => {
    const sinKey = resolverAntecedentes([
      q({ questionText: "¿Alergias alimentarias diagnosticadas?", fieldKey: null, answerValue: '["Maní"]' }),
    ]);
    expect(fila(sinKey, "alergias")?.declaradoNoConsumido).toBe(true);
  });

  it("cuando P-39 se resuelva y la pregunta reciba field_key, la marca DESAPARECE sola", () => {
    // Este es el punto del candado: la misma pregunta, con field_key, deja de estar marcada sin que nadie
    // toque el componente ni borre una entrada de una lista.
    const conKey = resolverAntecedentes([
      q({ questionText: "¿Alergias alimentarias diagnosticadas?", fieldKey: "d6_43", answerValue: '["Maní"]' }),
    ]);
    expect(fila(conKey, "alergias")?.declaradoNoConsumido).toBe(false);
  });

  it("una pregunta que SI alimenta el motor nunca se marca", () => {
    const g = resolverAntecedentes([q({ fieldKey: "d5_36", answerValue: "No" })]);
    expect(fila(g, "hta")?.declaradoNoConsumido).toBe(false);
    expect(fila(g, "hta")?.valores).toEqual(["No"]);
  });

  it("AUSENTE (la pregunta no existe) y VACIO (existe sin responder) son distintos", () => {
    // La distincion importa en pantalla: una fila vacia dice "no se registró"; una ausente no se pinta,
    // porque decir "no se registró" de algo que nunca se preguntó es afirmar un hueco que no existe.
    const ausente = resolverAntecedentes([]);
    expect(fila(ausente, "hta")?.ausente).toBe(true);
    const vacio = resolverAntecedentes([q({ fieldKey: "d5_36", answerValue: null })]);
    expect(fila(vacio, "hta")?.ausente).toBe(false);
    expect(fila(vacio, "hta")?.valores).toEqual([]);
  });

  it("resuelve por field_key cuando lo hay y por texto cuando no", () => {
    const g = resolverAntecedentes([
      q({ questionText: "otra cosa", fieldKey: "d5_38", answerValue: "Cáncer" }),
      q({ questionText: "¿Fue amamantado/a en su infancia?", answerValue: "Sí, 6 meses o más" }),
    ]);
    expect(fila(g, "familiares")?.valores).toEqual(["Cáncer"]);
    expect(fila(g, "lactancia")?.valores).toEqual(["Sí, 6 meses o más"]);
  });

  it("conserva el texto libre de 'Otra' en las listas", () => {
    expect(valoresDeRespuesta('["Otra: Rinitis crónica","Prediabetes"]')).toEqual([
      "Otra: Rinitis crónica",
      "Prediabetes",
    ]);
  });

  it("distingue la multi vacia del valor plano", () => {
    expect(valoresDeRespuesta("[]")).toEqual([]);
    expect(valoresDeRespuesta("")).toEqual([]);
    expect(valoresDeRespuesta(null)).toEqual([]);
    expect(valoresDeRespuesta("Ninguna")).toEqual(["Ninguna"]);
  });

  it("cada fila tiene forma de resolverse (field_key o patron): ninguna queda muda por olvido", () => {
    for (const g of HC_ANTECEDENTES) {
      for (const f of g.filas) {
        expect(Boolean(f.fieldKey || f.patron), `${f.id} no tiene como resolverse`).toBe(true);
      }
    }
  });

  it("la cirugía metabólica ESTA en la lista aunque su prototipo no la muestre", () => {
    // Decision explicita: omitirla porque el v8 no la pinta seria copiar un hueco. Una cirugia que afecta
    // la digestion o el metabolismo cambia absorcion, requerimiento proteico y tolerancia.
    const ids = HC_ANTECEDENTES.flatMap((g) => g.filas).map((f) => f.id);
    expect(ids).toContain("cirugia");
  });
});
