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

  // ═══ RAMA MAYOR SOBRE UN MENOR: YA NO BLOQUEA AQUI (Santiago, 2026-10-15) ═══
  //
  // Bloqueaba, y tuvo a una profesional con SEIS pacientes reales detenidos: su evaluacion se quedaba en
  // `draft` al confirmar identidad y no habia nada que hacer con ellos. El mensaje mandaba a *"repetir el
  // consentimiento con el representante legal"*, y para un paciente QUE YA EXISTE ese camino no esta
  // construido (el pase presencial con rama de menor solo crea pacientes nuevos; el remoto pide un correo
  // que estos pacientes no tienen). Un freno sin salida no protege: detiene la atencion de un menor real.
  //
  // EL HECHO NO SE PERDIO: lo marca el estado derivado `menor_sin_representante`
  // (`consentimiento-pendiente-de-regularizar.test.ts`), en la ficha y en la lista, con que hacer. **El dia
  // que exista el camino, el freno vuelve ahi, en el gate, no aqui**: este muro compara una rama contra una
  // fecha, que es otra pregunta.
  it("rama mayor + menor por documento: NO bloquea (lo marca el estado de regularizacion)", () => {
    const r = checkConsentBranchConsistency({
      birthDate: "2012-01-01", // 14 años
      usedMinorBranch: false,
      now: NOW,
    });
    expect(r.ok).toBe(true);
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
