import { describe, expect, it } from "vitest";

import { consentUnchanged, type ConsentState } from "@/modules/consent/consent-change";

// Guard de "sin cambios" del camino de excepcion del seguimiento (dictamen legal 2026-08-20 §3): identico
// NO crea consentimiento nuevo; una diferencia en autorizaciones, version O contacto SI lo dispara.
describe("consentUnchanged: identico no crea, distinto si", () => {
  const vigente: ConsentState = {
    types: ["servicio", "datos_sensibles", "investigacion"],
    version: "1.0",
    email: "ana@example.com",
    phone: "3001234567",
  };

  it("identico (mismas autorizaciones, version y contacto) -> sin cambios (no crea)", () => {
    expect(consentUnchanged(vigente, { ...vigente })).toBe(true);
    // el ORDEN de las autorizaciones no importa (se compara el conjunto)
    expect(
      consentUnchanged(vigente, { ...vigente, types: ["investigacion", "servicio", "datos_sensibles"] }),
    ).toBe(true);
  });

  it("otorga una autorizacion nueva -> cambio (re-consiente)", () => {
    expect(
      consentUnchanged(vigente, { ...vigente, types: [...vigente.types, "comunicaciones_comerciales"] }),
    ).toBe(false);
  });

  it("revoca una autorizacion -> cambio (re-consiente)", () => {
    expect(consentUnchanged(vigente, { ...vigente, types: ["servicio", "datos_sensibles"] })).toBe(false);
  });

  it("cambia la version -> cambio", () => {
    expect(consentUnchanged(vigente, { ...vigente, version: "1.1" })).toBe(false);
  });

  it("cambia el correo o el celular -> cambio", () => {
    expect(consentUnchanged(vigente, { ...vigente, email: "otra@example.com" })).toBe(false);
    expect(consentUnchanged(vigente, { ...vigente, phone: "3009999999" })).toBe(false);
  });
});
