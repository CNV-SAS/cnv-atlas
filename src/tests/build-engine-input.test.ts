import { describe, expect, it } from "vitest";

import {
  buildEngineInput,
  computeAge,
  normalizeSex,
  PROVISIONAL_BIS_MAP,
} from "@/modules/clinical-pipeline/services/build-engine-input";

const NOW = new Date("2026-06-22T00:00:00Z");

describe("computeAge", () => {
  it("calcula anos cumplidos en UTC", () => {
    expect(computeAge("1990-01-01", NOW)).toBe(36);
  });

  it("resta un ano si el cumpleanos aun no llega", () => {
    expect(computeAge("1990-12-31", NOW)).toBe(35);
  });

  it("sin fecha o fecha invalida devuelve 0", () => {
    expect(computeAge(null, NOW)).toBe(0);
    expect(computeAge("basura", NOW)).toBe(0);
  });
});

describe("normalizeSex", () => {
  it("mapea variantes femeninas a F", () => {
    for (const s of ["F", "f", "Female", "femenino", "FEM"]) expect(normalizeSex(s)).toBe("F");
  });
  it("el resto y null caen a M", () => {
    for (const s of ["M", "Male", "masculino", "otro", null]) expect(normalizeSex(s)).toBe("M");
  });
});

describe("buildEngineInput", () => {
  const model = { version: "ANI-BIS-E placeholder", rulesVersion: "placeholder" };

  it("arma el input: sexo, edad, survey y modelo; mapea BIS provisional", () => {
    const raw = {
      sex: "Female",
      birthDate: "2000-06-22",
      surveyAnswers: { q1: "a", q2: "b" },
      bisRaw: { [PROVISIONAL_BIS_MAP.peso]: 70, [PROVISIONAL_BIS_MAP.AF]: 6.2 },
    };
    const input = buildEngineInput(raw, model, NOW);
    expect(input.sexo).toBe("F");
    expect(input.edad).toBe(26);
    expect(input.survey).toEqual({ q1: "a", q2: "b" });
    expect(input.model).toEqual(model);
    expect(input.bis.peso).toBe(70);
    expect(input.bis.AF).toBe(6.2);
    // un campo sin candidato en bisRaw queda en 0 (provisional)
    expect(input.bis.Re).toBe(0);
  });

  it("ignora valores no finitos del mapa BIS (caen a 0)", () => {
    const raw = {
      sex: null,
      birthDate: null,
      surveyAnswers: {},
      bisRaw: { [PROVISIONAL_BIS_MAP.peso]: Number.NaN },
    };
    expect(buildEngineInput(raw, model, NOW).bis.peso).toBe(0);
  });
});
