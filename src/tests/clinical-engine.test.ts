import { describe, expect, it } from "vitest";

import {
  ENGINE_VERSION,
  type EngineInput,
  INDICATOR_CODES,
  runEngine,
} from "@/clinical-engine";

function input(edad: number): EngineInput {
  return {
    sexo: "M",
    edad,
    bis: {
      Re: 500, Ri: 50, Rinf: 450, C: 2,
      FMI: 8, FFMI: 18, MCA: 30, MCA_ref: 32,
      smmW: 0.4, ASMI: 8, AF: 6, IR: 0.8,
      ECW: 18, ICW: 24, FFM: 60,
      peso: 70, talla: 1.7, imc: 24,
    },
    survey: { d1: "a" },
    model: { version: "ANI-BIS-E placeholder", rulesVersion: "placeholder" },
  };
}

describe("clinical-engine stub", () => {
  it("devuelve un EngineOutput con la forma completa del contrato", () => {
    const out = runEngine(input(40));
    expect(Object.keys(out.indicators)).toHaveLength(12);
    expect(Object.keys(out.classifications).sort()).toEqual([...INDICATOR_CODES].sort());
    expect(out.fenotipo.id).toBeTruthy();
    expect(out.sectorFR.id).toBeTruthy();
    expect(out.estadoPBI.id).toBeTruthy();
    expect(out.estadoEIEC.nombre).toBeTruthy();
    expect(Array.isArray(out.alerts)).toBe(true);
    expect(out.protocol).toBeDefined();
  });

  it("es determinista: el mismo input produce el mismo output", () => {
    expect(runEngine(input(40))).toEqual(runEngine(input(40)));
  });

  it("echa la version del motor y la del modelo en versions", () => {
    const out = runEngine(input(40));
    expect(out.versions.engine).toBe(ENGINE_VERSION);
    expect(out.versions.engine.startsWith("stub-")).toBe(true);
    expect(out.versions.model).toBe("ANI-BIS-E placeholder");
    expect(out.versions.rules).toBe("placeholder");
  });

  it("es sensible al input: edades distintas dan indicadores distintos", () => {
    // Necesario para que los tests de propagacion detecten mezclas entre evaluaciones.
    expect(runEngine(input(30)).indicators.ifc).not.toBe(runEngine(input(50)).indicators.ifc);
  });

  it("el estado EFR cae en el rango 1..81", () => {
    for (const edad of [0, 18, 40, 80, 120]) {
      const n = runEngine(input(edad)).efrState.number;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(81);
    }
  });
});
