import { describe, expect, it } from "vitest";

import {
  BAND_TEXT_PLACEHOLDER,
  ebBand,
  MIN_COMPARABLE_WEEKS,
  pickComparablePrior,
  type PriorEvaluation,
} from "@/modules/followups/services/eb-trajectory";

// P0 Parte 2: el cambio de EB-BIS en tres bandas. Nucleo puro. La redaccion es de Gildardo; aqui se
// prueba el MECANISMO (bandas, corte, y la seleccion de la previa comparable por intervalo).

describe("ebBand (corte ±2 años; EB mas baja = mejoro)", () => {
  it("delta <= -2 -> mejoro; >= +2 -> empeoro; en medio -> sin_cambio", () => {
    expect(ebBand(-2)).toBe("mejoro");
    expect(ebBand(-3.5)).toBe("mejoro");
    expect(ebBand(2)).toBe("empeoro");
    expect(ebBand(4)).toBe("empeoro");
    expect(ebBand(0)).toBe("sin_cambio");
    expect(ebBand(-1.9)).toBe("sin_cambio"); // el caso que la query le lleva a Gildardo
    expect(ebBand(1.9)).toBe("sin_cambio");
  });
});

describe("pickComparablePrior (3b: gate sobre el INTERVALO, no la posicion)", () => {
  const current = "2026-08-01T00:00:00Z";
  const p4w: PriorEvaluation = { evaluationId: "e4", date: "2026-07-04T00:00:00Z", eb: 40 }; // ~4 sem
  const p20w: PriorEvaluation = { evaluationId: "e20", date: "2026-03-14T00:00:00Z", eb: 45 }; // ~20 sem

  it("salta la inmediata anterior si esta a <12 semanas y usa una mas vieja que si califica", () => {
    const t = pickComparablePrior(current, 42, [p4w, p20w]); // recientes primero
    expect(t?.comparedToEvaluationId).toBe("e20");
    expect(t?.intervalWeeks).toBe(20);
    expect(t?.ebDelta).toBe(-3); // 42 - 45
    expect(t?.band).toBe("mejoro");
    expect(t?.cutYears).toBe(2);
    expect(t?.provisional).toBe(true);
  });

  it("si NINGUNA previa cumple las 12 semanas -> null (el paciente ve la lectura funcional)", () => {
    expect(pickComparablePrior(current, 42, [p4w])).toBeNull();
  });

  it("usa la inmediata anterior si ya cumple el intervalo", () => {
    const t = pickComparablePrior(current, 42, [p20w]);
    expect(t?.comparedToEvaluationId).toBe("e20");
  });

  it("EB actual null o previa sin EB -> se ignora (no se inventa banda)", () => {
    expect(pickComparablePrior(current, null, [p20w])).toBeNull();
    expect(pickComparablePrior(current, 42, [{ ...p20w, eb: null }])).toBeNull();
  });

  it("el corte de comparabilidad es 12 semanas", () => {
    expect(MIN_COMPARABLE_WEEKS).toBe(12);
  });
});

describe("placeholders de redaccion (provisionales, de Gildardo)", () => {
  it("existen los tres y 'empeoro' NO comunica el juicio (dirige al profesional)", () => {
    expect(BAND_TEXT_PLACEHOLDER.mejoro).toMatch(/mejora/i);
    expect(BAND_TEXT_PLACEHOLDER.sin_cambio).toMatch(/estable/i);
    // el placeholder de empeoro no debe contener un juicio negativo explicito
    expect(BAND_TEXT_PLACEHOLDER.empeoro).not.toMatch(/empeor|peor|riesgo|mal/i);
    expect(BAND_TEXT_PLACEHOLDER.empeoro).toMatch(/profesional/i);
  });
});
