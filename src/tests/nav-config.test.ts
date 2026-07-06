import { describe, expect, it } from "vitest";

import { navItemsForRoles } from "../components/layout/nav-config";

// B3: la navegacion es adaptativa por rol. Aqui se prueba la decision de
// visibilidad (modulo puro); el render del shell se valida en el smoke de dev.
describe("B3: navegacion adaptativa por rol", () => {
  it("admin ve mas items que professional y secciones que el profesional no ve", () => {
    const adminHrefs = navItemsForRoles(["admin"]).map((i) => i.href);
    const proHrefs = navItemsForRoles(["professional"]).map((i) => i.href);

    // Admin ve la gestion de usuarios y lo comercial; el profesional no.
    expect(adminHrefs).toContain("/admin");
    expect(adminHrefs).toContain("/comercial");
    expect(proHrefs).not.toContain("/admin");
    expect(proHrefs).not.toContain("/comercial");

    // Ambos comparten el tablero, pero los conjuntos difieren.
    expect(adminHrefs).toContain("/dashboard");
    expect(proHrefs).toContain("/dashboard");
    expect(adminHrefs).not.toEqual(proHrefs);
    expect(adminHrefs.length).toBeGreaterThan(proHrefs.length);
  });

  it("soporte ve comodato pero no la clinica ni usuarios", () => {
    const soporteHrefs = navItemsForRoles(["soporte"]).map((i) => i.href);
    expect(soporteHrefs).toContain("/comodato");
    expect(soporteHrefs).not.toContain("/pacientes");
    expect(soporteHrefs).not.toContain("/admin");
  });

  it("el consentimiento vigente es visible para todos los roles (DELTA2 C1)", () => {
    for (const role of ["admin", "direccion", "soporte", "obbia", "professional"] as const) {
      const hrefs = navItemsForRoles([role]).map((i) => i.href);
      expect(hrefs).toContain("/consentimiento");
    }
  });
});
