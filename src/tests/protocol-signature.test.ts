import { describe, expect, it } from "vitest";

import {
  adjustmentSignature,
  guidelinesSignature,
  nutraceuticalsSignature,
  restriccionesSignature,
} from "@/modules/treatment/data/protocol-signature";
import type { TreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

// Cada seccion editable del panel tiene su PROPIA firma (checkpoint 2.4/2.5: el "Protocolo de tratamiento"
// se desarmo; la firma por secciones de saveProtocol se retiro). La firma sirve a dos cosas: el `key` de
// remonte de su seccion y la base de su candado de concurrencia. Este test verifica, ejecutando, que cada
// firma (ajustes, nutraceuticos, restricciones, guias): (a) se mueve con cualquier cambio real del set, y
// (b) es INDEPENDIENTE DEL ORDEN (cliente y servidor coinciden aunque la BD devuelva las filas en otro orden).

const BASE: TreatmentProtocol = {
  treatmentId: "t-1",
  diagnosisConfirmed: true,
  approved: false,
  kcalObjetivo: 2000,
  proteinaGramos: 110,
  pesoCalculo: 70,
  pesoCalculoLabel: "Peso actual (IMC normal)",
  adjPesoMeta: null,
  adjGeb: null,
  adjPal: null,
  adjKcalObj: null,
  adjProtGkg: null,
  adjFatPct: null,
  restricciones: ["sin gluten", "sin lactosa"],
  kcalSugerido: 2100,
  nutraceuticals: [
    { id: "tn-1", nutraceuticalId: "n-multicell", name: "MULTICELL BASE", dosage: "1/dia", durationDays: 30 },
    { id: "tn-2", nutraceuticalId: "n-omega", name: "OMEGA COMPLEX", dosage: null, durationDays: null },
  ],
  recommendedNutraceuticals: "MULTICELL BASE, OMEGA COMPLEX",
  guidelines: [
    { id: "g-1", text: "5 comidas al dia" },
    { id: "g-2", text: "Evitar ultraprocesados" },
  ],
  notes: [{ id: "note-1", note: "Nota inicial", createdAt: "2026-08-01T00:00:00Z" }],
  catalog: [
    { id: "n-multicell", name: "MULTICELL BASE", unit: "frasco", indication: "Basal", commercialAvailability: "en_consultorio" },
  ],
  menuSuggestions: [],
  protocolSuggested: null,
};

function clone(p: TreatmentProtocol): TreatmentProtocol {
  return {
    ...p,
    restricciones: [...p.restricciones],
    nutraceuticals: p.nutraceuticals.map((n) => ({ ...n })),
    guidelines: p.guidelines.map((g) => ({ ...g })),
    notes: p.notes.map((n) => ({ ...n })),
    catalog: p.catalog.map((c) => ({ ...c })),
    menuSuggestions: [...p.menuSuggestions],
  };
}

// Tratamiento sub-tarea 2, cuidado (d): la firma de AJUSTES (adjustmentSignature) es el key de remonte de la
// seccion de la cadena Y la base del candado de concurrencia de saveAdjustments. Debe cubrir LOS SEIS
// ajustes: si uno quedara fuera, un cambio del servidor a ese campo NO remontaria la seccion (estado pegado,
// el bug que hoy tiene latente el peso meta) y el candado NO lo protegeria (dos guardados se pisarian). Este
// test verifica, ejecutando, que cada uno de los seis mueve la firma y que igual estado -> igual firma.
describe("adjustmentSignature: key de remonte + base del candado de la cadena calorica", () => {
  // TreatmentProtocol es superset de SignableAdjustments (tiene treatmentId + los seis adj_*); BASE los trae
  // todos en null, asi que sirve de fixture sin construir uno aparte.
  const sig = () => adjustmentSignature(BASE);

  it("igual estado -> igual firma (no remonta, no rechaza una escritura legitima)", () => {
    expect(adjustmentSignature(clone(BASE))).toBe(sig());
  });

  // Cada uno de los seis, al cambiar, mueve la firma. tabla para no repetir seis its casi identicos.
  const CAMPOS: { nombre: string; set: (p: TreatmentProtocol) => void }[] = [
    { nombre: "adjGeb", set: (p) => (p.adjGeb = 1900) },
    { nombre: "adjPal", set: (p) => (p.adjPal = 1.6) },
    { nombre: "adjKcalObj", set: (p) => (p.adjKcalObj = 1800) },
    { nombre: "adjProtGkg", set: (p) => (p.adjProtGkg = 1.2) },
    { nombre: "adjFatPct", set: (p) => (p.adjFatPct = 25) },
    { nombre: "adjPesoMeta", set: (p) => (p.adjPesoMeta = 72.5) },
  ];
  for (const c of CAMPOS) {
    it(`un cambio del servidor en ${c.nombre} mueve la firma`, () => {
      const p = clone(BASE);
      c.set(p);
      expect(adjustmentSignature(p)).not.toBe(sig());
    });
  }

  it("otro tratamiento (correccion) mueve la firma", () => {
    const p = clone(BASE);
    p.treatmentId = "t-2";
    expect(adjustmentSignature(p)).not.toBe(sig());
  });

  it("normaliza numeric por Number: 1.5 y 1.500 dan la misma firma (no rechaza por scale)", () => {
    // El reader (cliente) y el writer (servidor bajo lock) normalizan ambos con Number; sin eso, "1.5" del
    // input y "1.500" que devuelve la columna numeric divergirian y el candado rechazaria un guardado valido.
    const a = clone(BASE);
    a.adjPal = Number("1.5");
    const b = clone(BASE);
    b.adjPal = Number("1.500");
    expect(adjustmentSignature(a)).toBe(adjustmentSignature(b));
  });
});

// Checkpoint 2.3: la firma de la PRESCRIPCION de nutraceuticos (nutraceuticalsSignature) es el key de remonte
// de la NutraceuticalsSection Y la base del candado de saveNutraceuticals. Debe moverse con cualquier cambio
// del set (producto, dosis, duracion) y NO depender del orden de las filas (SELECT sin ORDER BY).
describe("nutraceuticalsSignature: key de remonte + base del candado de la prescripcion", () => {
  const sig = () => nutraceuticalsSignature(BASE);

  it("igual set -> igual firma (aun reordenado: orden-independiente)", () => {
    const p = clone(BASE);
    p.nutraceuticals.reverse();
    expect(nutraceuticalsSignature(p)).toBe(sig());
  });

  it("agregar un nutraceutico mueve la firma", () => {
    const p = clone(BASE);
    p.nutraceuticals.push({
      id: "tn-3",
      nutraceuticalId: "n-curcumin",
      name: "CURCUMIN",
      dosage: null,
      durationDays: null,
    });
    expect(nutraceuticalsSignature(p)).not.toBe(sig());
  });

  it("cambiar la dosis mueve la firma", () => {
    const p = clone(BASE);
    p.nutraceuticals[0].dosage = "2/dia";
    expect(nutraceuticalsSignature(p)).not.toBe(sig());
  });

  it("cambiar la duracion mueve la firma", () => {
    const p = clone(BASE);
    p.nutraceuticals[0].durationDays = 60;
    expect(nutraceuticalsSignature(p)).not.toBe(sig());
  });

  it("otro tratamiento (correccion) mueve la firma", () => {
    const p = clone(BASE);
    p.treatmentId = "t-2";
    expect(nutraceuticalsSignature(p)).not.toBe(sig());
  });
});

// Checkpoint 2.4: firmas de restricciones y guias (key de remonte + base del candado de cada seccion).
// Orden-independiente y sensible a cualquier cambio del set.
describe("restriccionesSignature: key de remonte + base del candado de restricciones", () => {
  const sig = () => restriccionesSignature(BASE);
  it("igual set (aun reordenado) -> igual firma", () => {
    const p = clone(BASE);
    p.restricciones.reverse();
    expect(restriccionesSignature(p)).toBe(sig());
  });
  it("agregar una restriccion mueve la firma", () => {
    const p = clone(BASE);
    p.restricciones.push("sin azucar");
    expect(restriccionesSignature(p)).not.toBe(sig());
  });
  it("otro tratamiento mueve la firma", () => {
    const p = clone(BASE);
    p.treatmentId = "t-2";
    expect(restriccionesSignature(p)).not.toBe(sig());
  });
});

describe("guidelinesSignature: key de remonte + base del candado de guias", () => {
  const asList = (p: TreatmentProtocol) => ({
    treatmentId: p.treatmentId,
    guidelines: p.guidelines.map((g) => g.text),
  });
  const sig = () => guidelinesSignature(asList(BASE));
  it("igual set (aun reordenado) -> igual firma", () => {
    const p = clone(BASE);
    p.guidelines.reverse();
    expect(guidelinesSignature(asList(p))).toBe(sig());
  });
  it("cambiar el texto de una guia mueve la firma", () => {
    const p = clone(BASE);
    p.guidelines[0].text = "3 comidas al dia";
    expect(guidelinesSignature(asList(p))).not.toBe(sig());
  });
  it("otro tratamiento mueve la firma", () => {
    const p = clone(BASE);
    p.treatmentId = "t-2";
    expect(guidelinesSignature(asList(p))).not.toBe(sig());
  });
});
