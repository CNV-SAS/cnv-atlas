import { describe, expect, it } from "vitest";

import { ENGINE_VERSION, type EngineInput, runEngine } from "@/clinical-engine";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// Prueba de FORMA y comportamiento del motor real (engine.ts): mapeo del adaptador al
// EngineOutput, determinismo y el flag de degradacion del DFI. La paridad numerica con
// el HTML la cubre clinical-engine-golden.test.ts (regla 6).

// Los 13 field_key que declara la version (regla 7): la lista contra la que se mide
// dfi.complete. La encuesta esta completa solo si TODOS estan respondidos.
const CANON = [
  "d2_19", "d2_20", "d2_21", "d2_22",
  "d3_23", "d3_24", "d3_26", "d3_30",
  "d5_36", "d5_38", "d5_39",
  "d8_61", "d8_62",
];
// Encuesta que responde los 13 (valores minimos: el motor no crashea con strings arbitrarios,
// solo importa que esten respondidos para la completitud).
const FULL_SURVEY = Object.fromEntries(CANON.map((k) => [k, "1"]));

function input(survey: Record<string, unknown> = {}, expected: string[] = CANON): EngineInput {
  return {
    sexo: "M",
    edad: 54,
    bisRow: biody as Record<string, unknown>,
    survey,
    expectedFieldKeys: expected,
    model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  };
}

describe("clinical-engine runEngine (motor real)", () => {
  it("produce la forma completa del EngineOutput real", () => {
    const out = runEngine(input());
    expect(Object.keys(out.indicators)).toHaveLength(12);
    expect(out.efrPhenotype.key).toBe("N_N_N_A");
    expect(out.efrPhenotype.stateNumber).toBe(33); // N_N_N_A (bandas 2,2,2,3), numeracion de Gildardo
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

  it("marca el DFI COMPLETO solo cuando TODOS los field_key declarados estan respondidos", () => {
    const out = runEngine(input(FULL_SURVEY));
    expect(out.dfi.complete).toBe(true);
    expect(out.dfi.missingFieldKeys).toEqual([]);
    expect(out.dfi.degradedReason).toBeNull();
    expect(out.dfi.le8Total).not.toBeNull();
  });

  // Regresion del bug dfi.complete (2026-08-02): una encuesta PARCIAL (por CUALQUIER razon)
  // ya NO se sella como completa. Antes complete = "hay algun campo" -> este caso daba true.
  it("una encuesta PARCIAL no se marca completa, y reporta que falta", () => {
    const out = runEngine(input({ d3_23: "5", d3_24: "Más de 60 min" }));
    expect(out.dfi.complete).toBe(false);
    expect(out.dfi.missingFieldKeys).toHaveLength(CANON.length - 2);
    expect(out.dfi.missingFieldKeys).toContain("d8_61");
    expect(out.dfi.degradedReason).toContain("faltan");
    // el DFI SIGUE computando sobre lo presente (LE8 no es null): parcial != vacio.
    expect(out.dfi.le8Total).not.toBeNull();
  });

  it("el estado EFR cae en el rango 1..81", () => {
    expect(runEngine(input()).efrPhenotype.stateNumber).toBeGreaterThanOrEqual(1);
    expect(runEngine(input()).efrPhenotype.stateNumber).toBeLessThanOrEqual(81);
  });
});
