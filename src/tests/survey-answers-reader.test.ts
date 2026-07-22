import { describe, expect, it, vi } from "vitest";

import { groupSurveyAnswers } from "@/modules/evaluations/data/survey-answers-reader";

// El reader importa "server-only"; se mockea para poder importar la funcion pura de ensamble.
vi.mock("server-only", () => ({}));

// Prueba la logica de ensamble (pura): ordena por order_index, agrupa por dominio preservando el
// orden, mapea la respuesta y ordena las opciones. La lectura por RLS no se testea aqui (la gatea
// la RLS de survey_responses/survey_answers, verificada en el gate de A1).

describe("groupSurveyAnswers", () => {
  it("ordena por order_index, agrupa por dominio y mapea respuesta + opciones", () => {
    const questions = [
      { id: "q3", question_text: "D2 texto", question_type: "texto", field_key: null, section: "D2", order_index: 3 },
      { id: "q1", question_text: "Pregunta A", question_type: "opcion", field_key: "d1_1", section: "D1", order_index: 1 },
      { id: "q2", question_text: "Pregunta B", question_type: "contador", field_key: null, section: "D1", order_index: 2 },
    ];
    const answers = [
      { question_id: "q1", answer_value: "Sí" },
      { question_id: "q2", answer_value: "5" },
      // q3 sin responder
    ];
    const options = [
      { question_id: "q1", option_text: "No", order_index: 2 },
      { question_id: "q1", option_text: "Sí", order_index: 1 },
    ];

    const domains = groupSurveyAnswers(questions, answers, options);

    // Dos dominios, en orden de aparicion (D1 antes que D2 por order_index).
    expect(domains.map((d) => d.section)).toEqual(["D1", "D2"]);

    const d1 = domains[0];
    // Ordenadas por order_index dentro del dominio: q1 (1) antes que q2 (2).
    expect(d1.questions.map((q) => q.questionId)).toEqual(["q1", "q2"]);

    const q1 = d1.questions[0];
    expect(q1.answerValue).toBe("Sí");
    expect(q1.fieldKey).toBe("d1_1"); // marca que alimenta el motor
    expect(q1.options).toEqual(["Sí", "No"]); // opciones ordenadas por order_index

    // Pregunta no respondida -> answerValue null; sin opciones -> vacio.
    const q3 = domains[1].questions[0];
    expect(q3.answerValue).toBeNull();
    expect(q3.options).toEqual([]);
  });

  it("agrupa las preguntas sin section en 'Otras'", () => {
    const domains = groupSurveyAnswers(
      [{ id: "x", question_text: "sin dominio", question_type: "numero", field_key: null, section: null, order_index: 1 }],
      [],
      [],
    );
    expect(domains).toHaveLength(1);
    expect(domains[0].section).toBe("Otras");
  });
});
