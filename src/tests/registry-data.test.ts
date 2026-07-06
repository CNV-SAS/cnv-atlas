import { describe, expect, it } from "vitest";

import { buildRegistryData } from "@/clinical-engine/registry-data";
import generated from "@/clinical-engine/registry-data.generated.json";

// El registry se DERIVA de la ciencia congelada (no se transcribe). Este test bloquea la
// forma (12/9/9/81) y ancla una muestra al oro, para que un cambio silencioso salte.

describe("registry-data derivado de la ciencia congelada", () => {
  const r = buildRegistryData();

  it("12 indicadores, 9 fenotipos estructurales, 9 sectores FyR, 81 estados EFR", () => {
    expect(r.indicators).toHaveLength(12);
    expect(r.phenotypes).toHaveLength(9);
    expect(r.frSectors).toHaveLength(9);
    expect(r.efrStates).toHaveLength(81);
  });

  it("los 81 estados tienen stateNumber unico 1..81 y clave unica", () => {
    const nums = r.efrStates.map((s) => s.stateNumber);
    const keys = new Set(r.efrStates.map((s) => s.key));
    expect(new Set(nums).size).toBe(81);
    expect(keys.size).toBe(81);
    expect(Math.min(...nums)).toBe(1);
    expect(Math.max(...nums)).toBe(81);
  });

  it("N_N_N_A coincide con el oro (stateNumber 42 y diagnostico del DX)", () => {
    const s = r.efrStates.find((x) => x.key === "N_N_N_A");
    expect(s).toBeTruthy();
    expect(s?.stateNumber).toBe(42);
    expect(s?.diagnosisName).toBe(
      "Composición saludable con grasa alta → riesgo de progresión",
    );
    expect(s?.suggestedNutraceuticals).toBeTruthy();
  });

  it("el JSON committeado (que lee el seed) no se desincroniza del generador", () => {
    // Si esto falla, regenerar src/clinical-engine/registry-data.generated.json.
    expect(buildRegistryData()).toEqual(generated);
  });

  it("las claves de fenotipo estructural y sector FyR son las del motor", () => {
    expect(r.phenotypes.map((p) => p.code).sort()).toEqual(
      ["A_A", "A_B", "A_N", "B_A", "B_B", "B_N", "N_A", "N_B", "N_N"].sort(),
    );
    // FyR: IFC(3/2/1) x IRC(1/2/3).
    expect(r.frSectors.find((s) => s.code === "3_1")?.name).toBe("Estado celular óptimo");
  });
});
