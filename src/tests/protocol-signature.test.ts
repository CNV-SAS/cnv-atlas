import { describe, expect, it } from "vitest";

import { protocolSignature } from "@/modules/treatment/data/protocol-signature";
import type { TreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

// El `key` del ProtocolForm es la firma de los campos guardados que edita el panel. Este test verifica las
// dos propiedades que pidio la revision, ejecutando la firma:
//  (a) un cambio REAL del servidor (kcal, proteina, restricciones, prescripcion, guias) cambia la firma
//      -> el form se remonta y re-deriva del protocolo (arregla el estado pegado del panel entero).
//  (b/c) una revalidacion que NO tocó esos campos (registrar entrega, generar menu, agregar nota) deja la
//      firma IDENTICA -> el form no se remonta y una edicion en curso se preserva.

const BASE: TreatmentProtocol = {
  treatmentId: "t-1",
  diagnosisConfirmed: true,
  kcalObjetivo: 2000,
  proteinaGramos: 110,
  restricciones: ["sin gluten"],
  kcalSugerido: 2100,
  nutraceuticals: [
    { id: "tn-1", nutraceuticalId: "n-multicell", name: "MULTICELL BASE", dosage: "1/dia", durationDays: 30 },
  ],
  recommendedNutraceuticals: "MULTICELL BASE, OMEGA COMPLEX",
  guidelines: [{ id: "g-1", text: "5 comidas al dia" }],
  notes: [{ id: "note-1", note: "Nota inicial", createdAt: "2026-08-01T00:00:00Z" }],
  catalog: [
    { id: "n-multicell", name: "MULTICELL BASE", unit: "frasco", indication: "Basal", commercialAvailability: "en_consultorio" },
  ],
  menuSuggestions: [],
  protocolSuggested: null,
};

// Clona en profundidad lo suficiente para mutar sin tocar BASE.
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

describe("protocolSignature: key del ProtocolForm", () => {
  it("es estable: el mismo protocolo re-leido da la misma firma (revalidacion sin cambios no remonta)", () => {
    expect(protocolSignature(clone(BASE))).toBe(protocolSignature(BASE));
  });

  describe("(a) un cambio REAL del servidor cambia la firma", () => {
    it("kcal objetivo", () => {
      const p = clone(BASE);
      p.kcalObjetivo = 1800;
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("proteina", () => {
      const p = clone(BASE);
      p.proteinaGramos = 120;
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("restricciones", () => {
      const p = clone(BASE);
      p.restricciones.push("sin lactosa");
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("prescripcion: agregar un nutraceutico", () => {
      const p = clone(BASE);
      p.nutraceuticals.push({ id: "tn-2", nutraceuticalId: "n-omega", name: "OMEGA COMPLEX", dosage: null, durationDays: null });
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("prescripcion: cambiar la dosis de uno existente", () => {
      const p = clone(BASE);
      p.nutraceuticals[0].dosage = "2/dia";
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("guias dietarias", () => {
      const p = clone(BASE);
      p.guidelines.push({ id: "g-2", text: "Evitar ultraprocesados" });
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("otro tratamiento (correccion) remonta", () => {
      const p = clone(BASE);
      p.treatmentId = "t-2";
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
  });

  describe("(b/c) una revalidacion que NO tocó los campos editables deja la firma IGUAL", () => {
    it("registrar una entrega (no cambia el protocolo) -> misma firma, no remonta, edicion en curso a salvo", () => {
      // Una entrega mueve inventario/movimientos; el protocolo (kcal/prescripcion/guias) queda igual.
      const p = clone(BASE);
      expect(protocolSignature(p)).toBe(protocolSignature(BASE));
    });
    it("agregar una nota -> misma firma", () => {
      const p = clone(BASE);
      p.notes.push({ id: "note-2", note: "Nota nueva", createdAt: "2026-08-06T00:00:00Z" });
      expect(protocolSignature(p)).toBe(protocolSignature(BASE));
    });
    it("generar un menu por IA -> misma firma", () => {
      const p = clone(BASE);
      p.menuSuggestions = [
        { id: "m-1", provider: "groq", model: "x", promptVersion: "v1", generatedText: "menu", status: "success", latencyMs: 100, generatedAt: "2026-08-06T00:00:00Z" },
      ];
      expect(protocolSignature(p)).toBe(protocolSignature(BASE));
    });
  });
});
