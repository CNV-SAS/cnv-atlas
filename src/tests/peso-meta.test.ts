import { describe, expect, it } from "vitest";

import { pesoIdealLorentz, pesoMetaDefault } from "@/clinical-engine/peso-meta";

// Ancla el default del peso meta (Lorentz) contra la aritmética VERBATIM del motor de Gildardo
// (atlas-motores-tratamiento.js L16-18). Si un decimal se mueve, truena: alimenta la proteína (protG =
// protKg × pesoMeta), o sea la prescripción.

describe("pesoIdealLorentz", () => {
  it("hombre: talla-100-((talla-150)/4)", () => {
    expect(pesoIdealLorentz(170, true)).toBeCloseTo(65, 6); // 170-100-(20/4)=65
    expect(pesoIdealLorentz(180, true)).toBeCloseTo(72.5, 6); // 180-100-(30/4)=72.5
  });
  it("mujer: talla-100-((talla-150)/2.5)", () => {
    expect(pesoIdealLorentz(170, false)).toBeCloseTo(62, 6); // 170-100-(20/2.5)=62
    expect(pesoIdealLorentz(160, false)).toBeCloseTo(56, 6); // 160-100-(10/2.5)=56
  });
});

describe("pesoMetaDefault", () => {
  it("IMC>=25 (fuera de rango): Lorentz redondeado", () => {
    const d = pesoMetaDefault(90, 170, true); // IMC 31.1
    expect(d.fuente).toBe("lorentz");
    expect(d.valor).toBe(65); // round(65)
  });
  it("IMC<18.5 (fuera de rango): Lorentz redondeado", () => {
    const d = pesoMetaDefault(50, 170, true); // IMC 17.3
    expect(d.fuente).toBe("lorentz");
    expect(d.valor).toBe(65);
  });
  it("IMC en 18.5-25 (dentro de rango): peso actual", () => {
    const d = pesoMetaDefault(65, 170, true); // IMC 22.5
    expect(d.fuente).toBe("peso_actual");
    expect(d.valor).toBe(65);
  });
  it("mínimo 1 kg (guarda del motor, Math.max(1,...))", () => {
    // talla muy baja daría un PI <=0; el default nunca baja de 1.
    const d = pesoMetaDefault(30, 120, true); // PI = 120-100-((120-150)/4)=20+7.5=27.5; IMC 20.8 -> peso_actual
    expect(d.valor).toBeGreaterThanOrEqual(1);
  });
});
