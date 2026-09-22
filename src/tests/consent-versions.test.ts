import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  CONSENT_VERSION,
  CONSENT_VERSIONS,
  modoDelSeguimiento,
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

// EL ENLACE DE SEGUIMIENTO SOLO OMITE EL CONSENTIMIENTO SI HAY UNO DE ATLAS VIGENTE (respuesta legal
// 2026-09-21). Antes, un paciente sin consentimiento vigente quedaba en "sin firma" y chocaba con el aviso de
// revocacion; el paciente traido del HTML es exactamente ese caso.
describe("modoDelSeguimiento: sin consentimiento vigente, se firma", () => {
  it("sin consentimiento de Atlas vigente pide firmar, con su motivo", () => {
    expect(modoDelSeguimiento(null, "1.0")).toEqual({ modo: "sign", motivo: "sin_consentimiento" });
  });

  it("con cambio sustantivo de version pide firmar", () => {
    expect(modoDelSeguimiento("1.7", "1.0")).toEqual({ modo: "sign", motivo: "cambio_sustantivo" });
  });

  it("con el vigente de la misma version, retoma sin firmar", () => {
    expect(modoDelSeguimiento("1.0", "1.0")).toEqual({ modo: "nosign", motivo: "vigente" });
  });

  it("la pagina del enlace decide con esta funcion, no con una regla propia", () => {
    const pagina = readFileSync("src/app/(public)/encuesta/[token]/page.tsx", "utf8");
    expect(pagina).toContain("modoDelSeguimiento(heldVersion");
    expect(pagina).not.toMatch(/heldVersion \? requiresReconsent/);
  });
});
