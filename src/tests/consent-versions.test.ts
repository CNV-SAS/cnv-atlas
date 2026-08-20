import { describe, expect, it } from "vitest";

import {
  CONSENT_VERSION,
  CONSENT_VERSIONS,
  requiresReconsent,
} from "@/modules/consent/versions";

// Marca de versiones del consentimiento (dictamen legal 2026-08-20 §3): decide si un seguimiento fuerza
// re-consentimiento segun si hubo un cambio SUSTANTIVO entre la version firmada y la vigente.
describe("consent versions: marca sustantiva y requiresReconsent", () => {
  it("v1.0 es la vigente y esta marcada SUSTANTIVA (agrego la etnia como finalidad respecto de v1.7)", () => {
    expect(CONSENT_VERSION).toBe("1.0");
    const v10 = CONSENT_VERSIONS.find((v) => v.version === "1.0");
    expect(v10?.substantive).toBe(true);
  });

  it("misma version (el caso normal hoy: todos en v1.0) NO requiere re-consentimiento", () => {
    expect(requiresReconsent("1.0", "1.0")).toBe(false);
  });

  it("un firmante viejo de v1.7 SI requiere re-consentimiento al pasar a v1.0 (cambio sustantivo)", () => {
    expect(requiresReconsent("1.7", "1.0")).toBe(true);
  });

  it("entre versiones NO sustantivas seguidas no exige re-consentimiento (v1.2 -> v1.7)", () => {
    expect(requiresReconsent("1.2", "1.7")).toBe(false);
  });

  it("version desconocida o fuera de orden -> conservador (true)", () => {
    expect(requiresReconsent("0.9", "1.0")).toBe(true); // desconocida
    expect(requiresReconsent("1.0", "1.7")).toBe(true); // fuera de orden (current anterior a sealed)
  });
});
