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
          { questionId: "q1", questionText: "Pregunta A", questionType: "opcion", fieldKey: null, answerValue: "Sí", options: ["Sí", "No"] },
          { questionId: "q2", questionText: "Pregunta B", questionType: "contador", fieldKey: null, answerValue: "5", options: [] },
          { questionId: "q3", questionText: "Pregunta C", questionType: "opcion", fieldKey: null, answerValue: null, options: ["A", "B"] },
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

  it("estado vacio cuando no hay respuestas", () => {
    expect(render([])).toContain("aun no tiene respuestas");
  });
});
