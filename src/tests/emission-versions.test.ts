import { describe, expect, it } from "vitest";

import {
  buildEmissionVersions,
  EMISSION_VERSION_KEYS,
  emissionVersionsComplete,
  isProvisionalCalibration,
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

  // La marca "calibracion provisional" (P0) sale del campo SELLADO, no de una constante. El dia que
  // exista la calibracion poblacional, un valor que NO termine en "-provisional" apaga la marca solo.
  it("isProvisionalCalibration: sellado provisional/null -> true; poblacional -> false", () => {
    expect(isProvisionalCalibration(buildEmissionVersions())).toBe(true); // hoy: ebbis-v5-provisional
    expect(isProvisionalCalibration(null)).toBe(true); // diagnosticos previos a la columna
    expect(isProvisionalCalibration({})).toBe(true); // sin calibration
    expect(isProvisionalCalibration({ calibration: "ebbis-v5-provisional" })).toBe(true);
    expect(isProvisionalCalibration({ calibration: "ebbis-v6" })).toBe(false); // calibracion poblacional
  });
});
