import { describe, expect, it } from "vitest";

import { checkConsentBranchConsistency } from "@/modules/evaluations/services/consent-branch-check";

// Fecha de referencia fija para no depender del reloj.
const NOW = new Date("2026-07-06T00:00:00Z");

describe("checkConsentBranchConsistency (DELTA2 B3)", () => {
  it("rama mayor + adulto: consistente", () => {
    const r = checkConsentBranchConsistency({
      birthDate: "1990-01-01",
      usedMinorBranch: false,
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });

  it("rama mayor + fecha ausente: no bloquea (adultos pueden omitirla)", () => {
    const r = checkConsentBranchConsistency({
      birthDate: null,
      usedMinorBranch: false,
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });

  it("rama mayor + menor por documento: bloquea", () => {
    const r = checkConsentBranchConsistency({
      birthDate: "2012-01-01", // 14 años
      usedMinorBranch: false,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("menor de edad");
  });

  it("rama menor + menor por documento: consistente", () => {
    const r = checkConsentBranchConsistency({
      birthDate: "2012-01-01",
      usedMinorBranch: true,
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });

  it("rama menor + adulto por documento: bloquea", () => {
    const r = checkConsentBranchConsistency({
      birthDate: "1990-01-01",
      usedMinorBranch: true,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("mayoria de edad");
  });

  it("rama menor + fecha ausente: bloquea (no se puede confirmar la minoria)", () => {
    const r = checkConsentBranchConsistency({
      birthDate: null,
      usedMinorBranch: true,
      now: NOW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("Falta la fecha de nacimiento");
  });

  it("frontera exacta: 18 años cumplidos hoy es mayor de edad", () => {
    const r = checkConsentBranchConsistency({
      birthDate: "2008-07-06", // cumple 18 el dia de NOW
      usedMinorBranch: false,
      now: NOW,
    });
    expect(r.ok).toBe(true);
  });
});
