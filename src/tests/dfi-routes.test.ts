import { describe, expect, it } from "vitest";

import { isBisDerivedRoute, suspendSurveyRoutes } from "@/clinical-engine";

// Mapeo ruta -> origen (BIS vs encuesta) para la suspension por encuesta incompleta (Q28). Verificado
// contra frozen/engine.dfi.js:195-200. Puro, sin BD.

const ALL = [
  "R1 · Restauración Celular",
  "R2 · Reducción Cardiometabólica",
  "R3 · Conductual (prioritaria)",
  "R4 · Desaceleración Envejecimiento",
  "R5 · Contextual",
  "R6 · Mantenimiento",
];

describe("suspendSurveyRoutes", () => {
  it("conserva R1/R2 (BIS) y suspende R3/R4/R5/R6 (encuesta)", () => {
    expect(suspendSurveyRoutes(ALL)).toEqual(["R1 · Restauración Celular", "R2 · Reducción Cardiometabólica"]);
  });

  it("R1 y R2 son BIS; R3-R6 no", () => {
    expect(isBisDerivedRoute("R1 · Restauración Celular")).toBe(true);
    expect(isBisDerivedRoute("R2 · Reducción Cardiometabólica")).toBe(true);
    for (const r of ["R3 · Conductual (prioritaria)", "R4 · Desaceleración Envejecimiento", "R5 · Contextual", "R6 · Mantenimiento"]) {
      expect(isBisDerivedRoute(r)).toBe(false);
    }
  });

  it("es idempotente (sirve de gate de render sobre snapshots ya filtrados)", () => {
    const once = suspendSurveyRoutes(ALL);
    expect(suspendSurveyRoutes(once)).toEqual(once);
  });

  it("una lista sin rutas BIS queda vacia (no cae a R6)", () => {
    expect(suspendSurveyRoutes(["R5 · Contextual", "R6 · Mantenimiento"])).toEqual([]);
  });
});
