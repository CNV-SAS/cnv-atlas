import { describe, expect, it } from "vitest";

import {
  computeSurveyGaps,
  formatIncompleteSurveyMessage,
  isAnswered,
  totalMissing,
} from "@/modules/clinical-pipeline/services/survey-completeness";

// Gate de encuesta COMPLETA (las 64, no solo las 13 del diagnostico). El helper es puro; aqui se fija
// el criterio de "respondida" (ausente vs cero) y el mensaje por dominio.

describe("survey-completeness", () => {
  it("isAnswered distingue ausente/vacio de un cero real", () => {
    expect(isAnswered(null)).toBe(false); // sin fila (LEFT JOIN)
    expect(isAnswered("")).toBe(false); // vacio
    expect(isAnswered("[]")).toBe(false); // multi sin marcar
    expect(isAnswered("0")).toBe(true); // contador tocado en cero: SI es respuesta
    expect(isAnswered("No")).toBe(true);
    expect(isAnswered('["Ninguna"]')).toBe(true);
    // "otra" elegida SIN texto -> incompleta (hueco del gate); con texto -> completa.
    expect(isAnswered('["Otra"]')).toBe(false);
    expect(isAnswered('["Otros"]')).toBe(false);
    expect(isAnswered('["Cáncer","Otra"]')).toBe(false); // una eleccion valida + "otra" pelada -> hueco
    expect(isAnswered('["Otra: penicilina"]')).toBe(true);
    expect(isAnswered('["Cáncer"]')).toBe(true);
  });

  it("una pregunta NO de diagnostico sin responder bloquea (un contador de D7)", () => {
    const gaps = computeSurveyGaps([
      { section: "Hábitos", orderIndex: 10, answerValue: "2" },
      { section: "Hidratación", orderIndex: 50, answerValue: null }, // contador sin tocar
    ]);
    expect(gaps).toEqual([{ section: "Hidratación", missing: 1 }]);
    expect(totalMissing(gaps)).toBe(1);
  });

  it("completa (todas respondidas, incluido un cero) -> sin huecos", () => {
    const gaps = computeSurveyGaps([
      { section: "Hidratación", orderIndex: 50, answerValue: "0" }, // "Ninguno" explicito
      { section: "Hábitos", orderIndex: 10, answerValue: "No" },
    ]);
    expect(gaps).toEqual([]);
  });

  it("agrupa por dominio en el ORDEN de la encuesta y cuenta", () => {
    const gaps = computeSurveyGaps([
      { section: "Percepción corporal", orderIndex: 5, answerValue: null },
      { section: "Hidratación", orderIndex: 50, answerValue: null },
      { section: "Percepción corporal", orderIndex: 6, answerValue: null },
    ]);
    // Percepción corporal aparece primero (orderIndex 5) y suma 2; Hidratación 1.
    expect(gaps).toEqual([
      { section: "Percepción corporal", missing: 2 },
      { section: "Hidratación", missing: 1 },
    ]);
  });

  it("el mensaje dice cuantas faltan, por dominio, y el verbo (generar/regenerar)", () => {
    const gaps = [
      { section: "Percepción corporal", missing: 2 },
      { section: "Hidratación", missing: 1 },
    ];
    const msg = formatIncompleteSurveyMessage(gaps);
    expect(msg).toContain("faltan 3 respuestas");
    expect(msg).toContain("Percepción corporal (2)");
    expect(msg).toContain("Hidratación (1)");
    expect(msg).toContain("antes de generar el diagnóstico");
    expect(formatIncompleteSurveyMessage(gaps, "regenerar")).toContain("antes de regenerar el diagnóstico");
    // Singular.
    expect(formatIncompleteSurveyMessage([{ section: "Hidratación", missing: 1 }])).toContain("falta 1 respuesta");
  });
});
