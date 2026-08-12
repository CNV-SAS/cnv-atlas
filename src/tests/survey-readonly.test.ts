import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-reader";
import { SurveyReadonly } from "@/modules/evaluations/components/survey-readonly";

// Render-smoke de la vista de solo lectura de la encuesta (reusa los widgets compartidos via
// SurveyAnswerReadonly). Prueba que agrupa por dominio, resalta la respuesta elegida, muestra el
// valor de los contadores/escalas y marca las no respondidas. El smoke FUNCIONAL del formulario
// publico (que un paciente complete la encuesta) es aparte (browser).

function render(domains: SurveyDomain[]): string {
  return renderToStaticMarkup(createElement(SurveyReadonly, { domains }));
}

describe("SurveyReadonly", () => {
  it("muestra dominios, preguntas y la respuesta elegida", () => {
    const domains: SurveyDomain[] = [
      {
        section: "D1",
        questions: [
          { questionId: "q1", number: 1, questionText: "Pregunta A", questionHint: null, questionType: "opcion", fieldKey: null, usedInDiagnosis: false, answerValue: "Sí", options: ["Sí", "No"] },
          { questionId: "q2", number: 2, questionText: "Pregunta B", questionHint: null, questionType: "contador", fieldKey: null, usedInDiagnosis: false, answerValue: "5", options: [] },
          { questionId: "q3", number: 3, questionText: "Pregunta C", questionHint: null, questionType: "opcion", fieldKey: null, usedInDiagnosis: false, answerValue: null, options: ["A", "B"] },
        ],
      },
    ];
    const markup = render(domains);
    expect(markup).toContain("D1");
    expect(markup).toContain("Pregunta A");
    expect(markup).toContain("Sí"); // opcion elegida como pastilla
    expect(markup).toContain(">5<"); // valor del contador
    expect(markup).toContain("Sin responder"); // q3 sin respuesta
  });

  it("muestra el texto libre de 'Otra' (multiple): no se pierde en la lectura del profesional", () => {
    // Bug de perdida de informacion clinica: el catalogo trae "Otra" pero el valor guardado es
    // "Otra: penicilina". Sin descomponer, la opcion salia apagada y el texto (una alergia) desaparecia.
    const domains: SurveyDomain[] = [
      {
        section: "D5",
        questions: [
          { questionId: "q1", number: 1, questionText: "Alergias", questionHint: null, questionType: "opcion_multiple", fieldKey: null, usedInDiagnosis: false, answerValue: JSON.stringify(["Lácteos", "Otra: penicilina"]), options: ["Ninguna", "Lácteos", "Otra"] },
        ],
      },
    ];
    const markup = render(domains);
    expect(markup).toContain("penicilina"); // el texto libre aparece
    expect(markup).toContain("Otra: penicilina"); // pegado a su opcion
    expect(markup).toContain("Lácteos"); // la otra elegida sigue
  });

  it("muestra el texto libre de 'Otra' tambien en opcion UNICA", () => {
    const domains: SurveyDomain[] = [
      {
        section: "D6",
        questions: [
          { questionId: "q1", number: 1, questionText: "Cirugía", questionHint: null, questionType: "opcion", fieldKey: null, usedInDiagnosis: false, answerValue: "Otra: bypass gástrico", options: ["No", "Sí", "Otra"] },
        ],
      },
    ];
    expect(render(domains)).toContain("Otra: bypass gástrico");
  });

  it("una base elegida ausente del catalogo (version distinta) no se descarta en silencio", () => {
    const domains: SurveyDomain[] = [
      {
        section: "D1",
        questions: [
          { questionId: "q1", number: 1, questionText: "Pregunta", questionHint: null, questionType: "opcion", fieldKey: null, usedInDiagnosis: false, answerValue: "Valor viejo", options: ["A", "B"] },
        ],
      },
    ];
    expect(render(domains)).toContain("Valor viejo");
  });

  it("estado vacio cuando no hay respuestas", () => {
    expect(render([])).toContain("aun no tiene respuestas");
  });
});
