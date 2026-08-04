import { describe, expect, it } from "vitest";

import {
  BAND_TEXT,
  ebBand,
  MIN_COMPARABLE_WEEKS,
  pickComparablePrior,
  type PriorEvaluation,
  resolveTrajectory,
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

describe("resolveTrajectory (distingue POR QUÉ no hay banda: punto 3)", () => {
  const current = "2026-08-01T00:00:00Z";
  const p4w: PriorEvaluation = { evaluationId: "e4", date: "2026-07-04T00:00:00Z", eb: 40 };
  const p20w: PriorEvaluation = { evaluationId: "e20", date: "2026-03-14T00:00:00Z", eb: 45 };

  it("hay previa comparable -> band", () => {
    const r = resolveTrajectory(current, 42, [p20w]);
    expect(r.kind).toBe("band");
  });

  it("previa existe pero a <12 semanas -> interval_too_short (con las semanas)", () => {
    const r = resolveTrajectory(current, 42, [p4w]);
    expect(r.kind).toBe("interval_too_short");
    if (r.kind === "interval_too_short") expect(r.nearestWeeks).toBe(4);
  });

  it("no hay previa con EB -> no_prior", () => {
    expect(resolveTrajectory(current, 42, []).kind).toBe("no_prior");
    expect(resolveTrajectory(current, 42, [{ ...p20w, eb: null }]).kind).toBe("no_prior");
  });

  it("EB actual null -> no_prior (degradado, nada con qué comparar)", () => {
    expect(resolveTrajectory(current, null, [p20w]).kind).toBe("no_prior");
  });
});

describe("textos VERBATIM de Gildardo (Q25 / RESPUESTA_GILDARDO 7.1)", () => {
  it("son los tres exactos, con su puntuación (una coma movida = edición no autorizada)", () => {
    expect(BAND_TEXT.mejoro).toBe(
      "Los indicadores de tu evaluación muestran una evolución favorable respecto de tu medición anterior. Continúa con el plan acordado con tu profesional.",
    );
    expect(BAND_TEXT.sin_cambio).toBe(
      "Tus indicadores se mantienen en un rango similar al de tu medición anterior, sin cambios significativos con la información disponible.",
    );
    expect(BAND_TEXT.empeoro).toBe(
      "Tus indicadores muestran una evolución menos favorable que en tu medición anterior. Tu profesional revisará contigo el plan en la próxima consulta.",
    );
  });

  it("ninguno revela el constructo (no dice 'edad bioeléctrica') ni una cifra", () => {
    for (const t of Object.values(BAND_TEXT)) {
      expect(t).not.toMatch(/bioeléctrica|edad biológica/i);
      expect(t).not.toMatch(/\d/); // sin cifras
    }
  });
});
