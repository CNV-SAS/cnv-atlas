import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";
import { SurveyDiagnosisSection } from "@/modules/diagnoses/components/survey-diagnosis-section";

// D2-D8 en Diagnostico: read-out por dominio (pregunta -> respuesta), reusando SurveyAnswerReadonly (la
// misma presentacion que la pestana Evaluacion). Prueba los tres cuidados: (a) se ve igual (mismo
// componente, mismo markup), (b) el texto libre de "Otra" aparece, (c) un dominio sin respuestas dice
// "no respondio", no queda en blanco.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const patronNoCapturado = { status: "no_capturado" } as any;

function domain(section: string, questions: SurveyDomain["questions"]): SurveyDomain {
  return { section, questions };
}

function render(surveyDomains: SurveyDomain[] | null): string {
  return renderToStaticMarkup(
    createElement(SurveyDiagnosisSection, { patron: patronNoCapturado, surveyDomains }),
  );
}

describe("SurveyDiagnosisSection · D2-D8 read-out", () => {
  it("(a,b) muestra las respuestas de D2 por pregunta, incluido el texto libre de 'Otra'", () => {
    const domains: SurveyDomain[] = [
      domain("Patrón", []), // indice 0 = D1 (usa patron, no el read-out)
      domain("Percepción Corporal", [
        { questionId: "q1", number: 1, questionText: "Percepción corporal", questionHint: null, questionType: "opcion", fieldKey: "d2_19", usedInDiagnosis: false, answerValue: "Normal", options: ["Muy delgado/a", "Normal", "Obesidad"] },
        { questionId: "q2", number: 2, questionText: "Alergias", questionHint: null, questionType: "opcion_multiple", fieldKey: "d6_43", usedInDiagnosis: false, answerValue: JSON.stringify(["Otra: penicilina"]), options: ["Ninguna", "Otra"] },
      ]),
    ];
    const markup = render(domains);
    expect(markup).toContain("Percepción corporal"); // la pregunta
    expect(markup).toContain("Normal"); // la respuesta
    expect(markup).toContain("Otra: penicilina"); // el texto libre no se pierde (care b)
    // Variante "plain": SOLO lo elegido. Las opciones no marcadas ("Muy delgado/a", "Obesidad",
    // "Ninguna") NO aparecen, a diferencia de la pestana Evaluacion (chips con todas).
    expect(markup).not.toContain("Muy delgado/a");
    expect(markup).not.toContain("Ninguna");
  });

  it("porta los rotulos de dominio del HTML al dia (D4 y D6 cambian de sentido)", () => {
    // Los titulos son los del read-out vigente de Gildardo, no los viejos de Atlas.
    const markup = render([domain("x", []), domain("y", [])]);
    expect(markup).toContain("D4 · Patrón Horario Alimentario"); // antes "Conductas Alimentarias"
    expect(markup).toContain("D6 · Salud Digestiva"); // antes "Alergias y Salud Digestiva"
    expect(markup).not.toContain("Conductas Alimentarias");
  });

  it("(c) un dominio sin respuestas dice 'no respondió', no queda en blanco", () => {
    // Solo D1 y D2 con datos; D3-D8 quedan sin dominio (undefined) o vacios.
    const markup = render([domain("Patrón", []), domain("Percepción", [])]);
    expect(markup).toContain("no respondió este dominio");
  });

  it("sin encuesta (null): D2-D8 no truena, dicen 'no respondió'", () => {
    expect(render(null)).toContain("no respondió este dominio");
  });
});
