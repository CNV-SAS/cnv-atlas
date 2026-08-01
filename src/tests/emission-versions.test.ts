import { describe, expect, it } from "vitest";

import {
  buildEmissionVersions,
  EMISSION_VERSION_KEYS,
  emissionVersionsComplete,
} from "@/modules/clinical-pipeline/emission-versions";

// emission_versions: el writer sella el set COMPLETO (regla de completitud). Un jsonb parcial seria
// indistinguible de uno incompleto; este test garantiza que buildEmissionVersions trae TODAS las
// claves aplicables y que emissionVersionsComplete caza los parciales.

describe("emission_versions", () => {
  it("buildEmissionVersions trae TODAS las claves (ninguna olvidada)", () => {
    const v = buildEmissionVersions();
    for (const k of EMISSION_VERSION_KEYS) {
      expect(typeof v[k]).toBe("string");
      expect(v[k]).not.toBe("");
    }
    expect(Object.keys(v).sort()).toEqual([...EMISSION_VERSION_KEYS].sort());
  });

  it("emissionVersionsComplete: completo -> true, parcial -> false", () => {
    expect(emissionVersionsComplete(buildEmissionVersions())).toBe(true);
    expect(emissionVersionsComplete({ classification: "cXXX-1.0" })).toBe(false); // falta calibration
    expect(emissionVersionsComplete({ classification: "cXXX-1.0", calibration: "" })).toBe(false);
    expect(emissionVersionsComplete({})).toBe(false);
  });
});
