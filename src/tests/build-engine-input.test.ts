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

describe("buildSurvey: el texto libre de 'Otra' (Gildardo 2026-08-13)", () => {
  const model = { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" };

  it("d5_39: el texto libre SI alimenta el motor (§4), sin el prefijo 'Otra:'", () => {
    const raw = {
      sex: "M",
      birthDate: "1990-01-01",
      surveyAnswers: [
        // d5_39 lo lee el motor por substring: "Otra: cancer de piel" ahora SI llega, pero pelado el
        // centinela, para que el match (renal/cancer/diabet) opere sobre la condicion, no sobre "Otra:".
        { fieldKey: "d5_39", type: "opcion_multiple", value: JSON.stringify(["Diabetes tipo 2", "Otra: cancer de piel"]) },
      ],
      expectedFieldKeys: ["d5_39"],
      bisRaw: {},
    };
    const input = buildEngineInput(raw, model, NOW);
    expect(input.survey.d5_39).toEqual(["Diabetes tipo 2", "cancer de piel"]);
  });

  it("d5_38 y d6_44: el texto libre TAMBIEN alimenta el motor (§4, 2026-08-15), sin el prefijo 'Otra:'", () => {
    const raw = {
      sex: "M",
      birthDate: "1990-01-01",
      surveyAnswers: [
        { fieldKey: "d5_38", type: "opcion_multiple", value: JSON.stringify(["HTA (presión alta)", "Otra: enfermedad renal"]) },
        { fieldKey: "d6_44", type: "opcion_multiple", value: JSON.stringify(["Otra: intolerancia a la lactosa"]) },
      ],
      expectedFieldKeys: ["d5_38", "d6_44"],
      bisRaw: {},
    };
    const input = buildEngineInput(raw, model, NOW);
    // Misma regla que d5_39: el texto llega pelado del centinela "Otra:" para que el motor lo lea por substring.
    expect(input.survey.d5_38).toEqual(["HTA (presión alta)", "enfermedad renal"]);
    expect(input.survey.d6_44).toEqual(["intolerancia a la lactosa"]);
  });

  it("las DEMAS preguntas con 'Otra' (§3): su texto libre es REGISTRO, NO alimenta el motor", () => {
    const raw = {
      sex: "M",
      birthDate: "1990-01-01",
      surveyAnswers: [
        // d6_43 (alergias, una de las 9 pero NO de las que alimentan el motor): "Otra: mango" NO llega (registro).
        { fieldKey: "d6_43", type: "opcion_multiple", value: JSON.stringify(["Maní", "Otra: mango"]) },
      ],
      expectedFieldKeys: ["d6_43"],
      bisRaw: {},
    };
    const input = buildEngineInput(raw, model, NOW);
    expect(input.survey.d6_43).toEqual(["Maní"]);
  });
});
