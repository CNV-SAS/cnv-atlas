import { describe, expect, it } from "vitest";

import { ENGINE_VERSION, type EngineInput, runEngine } from "@/clinical-engine";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// Prueba de FORMA y comportamiento del motor real (engine.ts): mapeo del adaptador al
// EngineOutput, determinismo y el flag de degradacion del DFI. La paridad numerica con
// el HTML la cubre clinical-engine-golden.test.ts (regla 6).

function input(survey: Record<string, unknown> = {}): EngineInput {
  return {
    sexo: "M",
    edad: 54,
    bisRow: biody as Record<string, unknown>,
    survey,
    model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  };
}

describe("clinical-engine runEngine (motor real)", () => {
  it("produce la forma completa del EngineOutput real", () => {
    const out = runEngine(input());
    expect(Object.keys(out.indicators)).toHaveLength(12);
    expect(out.efrPhenotype.key).toBe("N_N_N_A");
    expect(out.efrPhenotype.stateNumber).toBe(42); // N_N_N_A -> bandas (2,2,2,3)
    expect(out.structural.nombre).toBeTruthy();
    expect(out.frSector.nombre).toBeTruthy();
    expect(out.nutraceuticos).toBeTruthy();
    expect(out.resumenClinico).toContain("N_N_N_A");
  });

  it("determinista: mismo input produce el mismo output", () => {
    expect(runEngine(input())).toEqual(runEngine(input()));
  });

  it("echa la version del motor (ya no stub) y la del modelo", () => {
    const out = runEngine(input());
    expect(out.versions.engine).toBe(ENGINE_VERSION);
    expect(out.versions.engine.startsWith("stub-")).toBe(false);
    expect(out.versions.model).toBe("ANI-BIS-E 1.0");
    expect(out.versions.rules).toBe("1.0");
  });

  it("marca el DFI DEGRADADO sin encuesta (EB/IAE null, flag explicito)", () => {
    const out = runEngine(input({}));
    expect(out.dfi.complete).toBe(false);
    expect(out.dfi.degradedReason).toBeTruthy();
    expect(out.dfi.le8Total).toBeNull();
    expect(out.indicators.eb).toBeNull();
    expect(out.indicators.iae).toBeNull();
  });

  it("marca el DFI COMPLETO cuando hay datos de encuesta", () => {
    const out = runEngine(input({ d1_9: "3", d3_23: "5", d3_24: "Más de 60 min" }));
    expect(out.dfi.complete).toBe(true);
    expect(out.dfi.degradedReason).toBeNull();
    expect(out.dfi.le8Total).not.toBeNull();
  });

  it("el estado EFR cae en el rango 1..81", () => {
    expect(runEngine(input()).efrPhenotype.stateNumber).toBeGreaterThanOrEqual(1);
    expect(runEngine(input()).efrPhenotype.stateNumber).toBeLessThanOrEqual(81);
  });
});
