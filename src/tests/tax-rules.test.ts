import { describe, expect, it } from "vitest";

import {
  bankHolderMatchesIntegrante,
  computeNitDv,
  rutNeedsRenewal,
  validateTaxIdentity,
} from "@/modules/professionals/tax-rules";

// Reglas puras del estado tributario. Se anclan con NITs reales de DV conocido (no numeros sueltos).
describe("computeNitDv (algoritmo DIAN)", () => {
  it("calcula el DV de NITs reales conocidos", () => {
    expect(computeNitDv("890903938")).toBe(8); // Bancolombia -> 8
    expect(computeNitDv("899999068")).toBe(1); // Ecopetrol -> 1
    expect(computeNitDv("800153993")).toBe(7); // Comcel/Claro -> 7
  });

  it("ignora puntos y guiones", () => {
    expect(computeNitDv("890.903.938")).toBe(8);
  });

  it("null si no hay digitos o excede el rango", () => {
    expect(computeNitDv("")).toBeNull();
    expect(computeNitDv("abc")).toBeNull();
    expect(computeNitDv("1234567890123456")).toBeNull(); // 16 digitos, fuera de los pesos
  });
});

describe("validateTaxIdentity (validacion cruzada)", () => {
  it("rechaza el combo imposible juridica + sin RUT (el bug del smoke)", () => {
    const err = validateTaxIdentity({ personType: "juridica", hasRut: false, idNumber: "890903938", idDv: "8" });
    expect(err).toMatch(/jur[ií]dica siempre tiene RUT/i);
  });

  it("juridica con DV correcto pasa", () => {
    expect(
      validateTaxIdentity({ personType: "juridica", hasRut: true, idNumber: "890903938", idDv: "8" }),
    ).toBeNull();
  });

  it("juridica con DV incorrecto es rechazada, con el DV correcto en el mensaje", () => {
    const err = validateTaxIdentity({ personType: "juridica", hasRut: true, idNumber: "890903938", idDv: "3" });
    expect(err).toMatch(/deber[ií]a ser 8/);
  });

  it("natural no exige DV (tenga o no RUT)", () => {
    expect(validateTaxIdentity({ personType: "natural", hasRut: true, idNumber: "1015420000", idDv: null })).toBeNull();
    expect(validateTaxIdentity({ personType: "natural", hasRut: false, idNumber: "1015420000", idDv: null })).toBeNull();
  });
});

describe("rutNeedsRenewal (vigencia de 1 año)", () => {
  const now = new Date("2026-08-12T00:00:00Z");
  it("pide actualizar si tiene mas de un año", () => {
    expect(rutNeedsRenewal("2025-01-01", now)).toBe(true); // ~19 meses
  });
  it("no pide actualizar si es reciente", () => {
    expect(rutNeedsRenewal("2026-03-01", now)).toBe(false); // ~5 meses
  });
  it("el borde: justo mas de un año pide, justo menos no", () => {
    expect(rutNeedsRenewal("2025-08-11", now)).toBe(true); // 1 año y 1 dia
    expect(rutNeedsRenewal("2025-08-13", now)).toBe(false); // 1 dia menos de un año
  });
  it("sin fecha o fecha invalida: pide actualizar (no se puede confiar en su vigencia)", () => {
    expect(rutNeedsRenewal(null, now)).toBe(true);
    expect(rutNeedsRenewal("no-es-fecha", now)).toBe(true);
  });
});

describe("bankHolderMatchesIntegrante (titular por documento)", () => {
  it("coincide si el documento del titular es el del integrante", () => {
    expect(bankHolderMatchesIntegrante("1015420000", "1015420000")).toBe(true);
  });
  it("ignora formato (puntos)", () => {
    expect(bankHolderMatchesIntegrante("1.015.420.000", "1015420000")).toBe(true);
  });
  it("NO coincide si es de otra persona (la cuenta de un familiar)", () => {
    expect(bankHolderMatchesIntegrante("1015420000", "52111222")).toBe(false);
  });
  it("juridica: la cuenta debe ser del NIT de la juridica, no de otro documento", () => {
    // el integrante juridica se identifica por su NIT; el titular debe ser ese NIT.
    expect(bankHolderMatchesIntegrante("890903938", "890903938")).toBe(true);
    expect(bankHolderMatchesIntegrante("890903938", "79999888")).toBe(false); // representante legal
  });
});
