import { describe, expect, it } from "vitest";

import {
  changedSections,
  describeChangedSections,
  protocolSectionSignatures,
  protocolSignature,
} from "@/modules/treatment/data/protocol-signature";
import type { TreatmentProtocol } from "@/modules/treatment/data/treatment-reader";

// La firma sirve a dos cosas: el `key` del ProtocolForm y el candado de concurrencia de saveProtocol. Este
// test verifica, ejecutando:
//  (a) un cambio REAL de un campo editable cambia la firma (remonta / rechaza la escritura vieja);
//  (b/c) una revalidacion que NO tocó esos campos (entrega, menu, nota) deja la firma IGUAL (no remonta,
//        no rechaza), y ademas la firma es INDEPENDIENTE DEL ORDEN de los conjuntos (cliente y servidor
//        coinciden aunque la BD devuelva las filas en otro orden);
//  y que changedSections/describe dicen QUE seccion cambió para el mensaje de rechazo.

const BASE: TreatmentProtocol = {
  treatmentId: "t-1",
  diagnosisConfirmed: true,
  approved: false,
  kcalObjetivo: 2000,
  proteinaGramos: 110,
  pesoCalculo: 70,
  pesoCalculoLabel: "Peso actual (IMC normal)",
  adjPesoMeta: null,
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

describe("protocolSignature: key del ProtocolForm + base del candado", () => {
  it("es estable: el mismo protocolo re-leido da la misma firma", () => {
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
    it("restricciones: agregar una", () => {
      const p = clone(BASE);
      p.restricciones.push("sin azucar");
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("prescripcion: agregar un nutraceutico", () => {
      const p = clone(BASE);
      p.nutraceuticals.push({ id: "tn-3", nutraceuticalId: "n-curcumin", name: "CURCUMIN", dosage: null, durationDays: null });
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("prescripcion: cambiar la dosis de uno existente", () => {
      const p = clone(BASE);
      p.nutraceuticals[0].dosage = "2/dia";
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("guias dietarias: cambiar el texto de una", () => {
      const p = clone(BASE);
      p.guidelines[0].text = "3 comidas al dia";
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
    it("otro tratamiento (correccion) remonta", () => {
      const p = clone(BASE);
      p.treatmentId = "t-2";
      expect(protocolSignature(p)).not.toBe(protocolSignature(BASE));
    });
  });

  describe("(b/c) revalidacion sin cambios en los campos editables: firma IGUAL", () => {
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
    it("INDEPENDIENTE DEL ORDEN: reordenar prescripcion/restricciones/guias -> misma firma", () => {
      // Clave para el candado: cliente y servidor deben coincidir aunque la BD devuelva las filas en otro
      // orden (SELECT sin ORDER BY). Reordenar los tres conjuntos no debe mover la firma.
      const p = clone(BASE);
      p.nutraceuticals.reverse();
      p.restricciones.reverse();
      p.guidelines.reverse();
      expect(protocolSignature(p)).toBe(protocolSignature(BASE));
    });
  });

  describe("secciones: changedSections dice QUE cambió (para el mensaje de rechazo)", () => {
    it("un cambio de objetivos marca solo la seccion objetivos", () => {
      const p = clone(BASE);
      p.kcalObjetivo = 1750;
      const changed = changedSections(protocolSectionSignatures(BASE), protocolSectionSignatures(p));
      expect(changed).toEqual(["objetivos"]);
    });
    it("un cambio de prescripcion marca solo la seccion nutraceuticals", () => {
      const p = clone(BASE);
      p.nutraceuticals[0].dosage = "2/dia";
      const changed = changedSections(protocolSectionSignatures(BASE), protocolSectionSignatures(p));
      expect(changed).toEqual(["nutraceuticals"]);
    });
    it("dos cambios marcan ambas secciones", () => {
      const p = clone(BASE);
      p.proteinaGramos = 130;
      p.guidelines.push({ id: "g-3", text: "Mas verduras" });
      const changed = changedSections(protocolSectionSignatures(BASE), protocolSectionSignatures(p));
      expect(changed.sort()).toEqual(["guidelines", "objetivos"]);
    });
    it("sin cambios -> ninguna seccion", () => {
      expect(changedSections(protocolSectionSignatures(BASE), protocolSectionSignatures(clone(BASE)))).toEqual([]);
    });
    it("describe traduce a lenguaje de producto", () => {
      expect(describeChangedSections(["objetivos", "nutraceuticals"])).toBe(
        "los objetivos (calorías/proteína), la prescripción de nutracéuticos",
      );
    });
  });
});
