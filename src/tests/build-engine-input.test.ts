import { describe, expect, it } from "vitest";

import { BIODY_COLUMNS } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import {
  buildEngineInput,
  computeAge,
  normalizeSex,
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

describe("normalizeSex (ESTRICTA, decision A)", () => {
  it("acepta exactamente F/M, indiferente a mayusculas y espacios", () => {
    for (const s of ["F", "f", " F "]) expect(normalizeSex(s)).toBe("F");
    for (const s of ["M", "m", " m "]) expect(normalizeSex(s)).toBe("M");
  });

  it("FALLA EN VOZ ALTA ante cualquier cosa que no sea F/M (no adivina), y dice el valor", () => {
    // Antes "mujer" caia en M en silencio (corrompiendo el diagnostico); ahora truena.
    for (const s of ["Male", "Female", "masculino", "femenino", "mujer", "otro", "", null]) {
      expect(() => normalizeSex(s)).toThrow();
    }
    // El mensaje incluye el valor que llego, para no perder tiempo buscandolo.
    expect(() => normalizeSex("mujer")).toThrow(/mujer/);
  });
});

describe("buildEngineInput", () => {
  const model = { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" };

  it("arma el input y reconstruye la fila con headers EXACTOS del Biody", () => {
    // bisRaw se indexa por el header NORMALIZADO (como lo guarda B8).
    const raw = {
      sex: "F",
      birthDate: "2000-06-22",
      surveyAnswers: [
        { fieldKey: "d2_19", type: "opcion", value: "Normal" },
        { fieldKey: "d5_39", type: "opcion_multiple", value: '["HTA","Prediabetes"]' },
      ],
      expectedFieldKeys: ["d2_19", "d5_39"],
      bisRaw: {
        [normalizeHeader(BIODY_COLUMNS.peso.header)]: 70,
        [normalizeHeader(BIODY_COLUMNS.AF.header)]: 6.2,
      },
    };
    const input = buildEngineInput(raw, model, NOW);
    expect(input.sexo).toBe("F");
    expect(input.edad).toBe(26);
    // survey keyed por field_key; el multi-select se decodifica a array (JSON).
    expect(input.survey).toEqual({ d2_19: "Normal", d5_39: ["HTA", "Prediabetes"] });
    expect(input.model).toEqual(model);
    // bisRow indexado por el header EXACTO del contrato de columnas.
    expect(input.bisRow[BIODY_COLUMNS.peso.header]).toBe(70);
    expect(input.bisRow[BIODY_COLUMNS.AF.header]).toBe(6.2);
    // un campo sin valor en bisRaw no entra a la fila (no se inventa).
    expect(input.bisRow[BIODY_COLUMNS.Re.header]).toBeUndefined();
  });

  it("ignora valores no finitos (no entran a bisRow)", () => {
    const raw = {
      sex: "M", // sexo valido: este test verifica bisRow, no el sexo (que ahora es estricto)
      birthDate: null,
      surveyAnswers: [],
      expectedFieldKeys: ["d2_19"],
      bisRaw: { [normalizeHeader(BIODY_COLUMNS.peso.header)]: Number.NaN },
    };
    const input = buildEngineInput(raw, model, NOW);
    expect(input.bisRow[BIODY_COLUMNS.peso.header]).toBeUndefined();
  });
});
