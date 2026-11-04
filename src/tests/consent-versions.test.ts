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
  it("v1.1 es la vigente y esta marcada NO sustantiva; la v1.0 sigue marcada SUSTANTIVA", () => {
    expect(CONSENT_VERSION).toBe("1.1");
    expect(CONSENT_VERSIONS.find((v) => v.version === "1.1")?.substantive).toBe(false);
    // La v1.0 agrego la etnia como finalidad respecto de v1.7: su marca no se toca al publicar la v1.1.
    expect(CONSENT_VERSIONS.find((v) => v.version === "1.0")?.substantive).toBe(true);
  });

  // ═══ LO QUE DE VERDAD PROTEGE A LA BASE FIRMADA ═══
  //
  // Casi todos los pacientes tienen firmada la v1.0. Si la v1.1 se hubiera registrado como sustantiva (o si
  // alguien la marca asi despues), TODOS ellos tendrian que volver a firmar antes de un seguimiento, que es
  // exactamente lo que la decision legal del 2026-10-20 (D5) dice que NO debe pasar.
  it("quien firmo la v1.0 NO re-consiente al pasar a la v1.1 (decision legal D5)", () => {
    expect(requiresReconsent("1.0", "1.1")).toBe(false);
    expect(modoDelSeguimiento("1.0", "1.1")).toEqual({ modo: "nosign", motivo: "vigente" });
  });

  it("misma version NO requiere re-consentimiento", () => {
    expect(requiresReconsent("1.1", "1.1")).toBe(false);
  });

  // El firmante viejo de una iteracion interna SI tiene que re-firmar al llegar a la v1.1, porque en el
  // camino esta la v1.0, que fue sustantiva. La cadena se evalua entera, no solo el ultimo salto.
  it("un firmante de v1.7 SI re-consiente al pasar a la v1.1 (la v1.0 esta en medio y fue sustantiva)", () => {
    expect(requiresReconsent("1.7", "1.1")).toBe(true);
  });

  it("un firmante viejo de v1.7 SI requiere re-consentimiento al pasar a v1.0 (cambio sustantivo)", () => {
    expect(requiresReconsent("1.7", "1.0")).toBe(true);
  });

  it("entre versiones NO sustantivas seguidas no exige re-consentimiento (v1.2 -> v1.7)", () => {
    expect(requiresReconsent("1.2", "1.7")).toBe(false);
  });

  it("version desconocida o fuera de orden -> conservador (true)", () => {
    expect(requiresReconsent("0.9", "1.1")).toBe(true); // desconocida
    expect(requiresReconsent("1.1", "1.0")).toBe(true); // fuera de orden (current anterior a sealed)
  });
});

// EL ENLACE DE SEGUIMIENTO SOLO OMITE EL CONSENTIMIENTO SI HAY UNO DE ATLAS VIGENTE (respuesta legal
// 2026-09-21). Antes, un paciente sin consentimiento vigente quedaba en "sin firma" y chocaba con el aviso de
// revocacion; el paciente traido del HTML es exactamente ese caso.
describe("modoDelSeguimiento: sin consentimiento vigente, se firma", () => {
  it("sin consentimiento de Atlas vigente pide firmar, con su motivo", () => {
    expect(modoDelSeguimiento(null, "1.1")).toEqual({ modo: "sign", motivo: "sin_consentimiento" });
  });

  it("con cambio sustantivo de version pide firmar", () => {
    expect(modoDelSeguimiento("1.7", "1.1")).toEqual({ modo: "sign", motivo: "cambio_sustantivo" });
  });

  it("con el vigente de la misma version, retoma sin firmar", () => {
    expect(modoDelSeguimiento("1.1", "1.1")).toEqual({ modo: "nosign", motivo: "vigente" });
  });

  it("la pagina del enlace decide con esta funcion, no con una regla propia", () => {
    const pagina = readFileSync("src/app/(public)/encuesta/[token]/page.tsx", "utf8");
    expect(pagina).toContain("modoDelSeguimiento(heldVersion");
    expect(pagina).not.toMatch(/heldVersion \? requiresReconsent/);
  });
});
