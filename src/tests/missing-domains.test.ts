import { describe, expect, it } from "vitest";

import { missingDomainsFrom } from "@/modules/diagnoses/missing-domains";

// D-007 Fase A: mapear los field_key faltantes (sellados) a los DOMINIOS de encuesta incompletos,
// en el orden de la encuesta, sin duplicados. Puro: se prueba sin BD.

const domains = [
  { section: "D2 Percepción corporal", questions: [{ fieldKey: "d2_19" }, { fieldKey: "d2_20" }, { fieldKey: null }] },
  { section: "D5 Antecedentes", questions: [{ fieldKey: "d5_36" }, { fieldKey: "d5_38" }] },
  { section: "D8 Contexto social", questions: [{ fieldKey: "d8_61" }, { fieldKey: "d8_62" }] },
];

describe("missingDomainsFrom", () => {
  it("mapea field_key faltantes a sus dominios, en orden de encuesta y sin duplicados", () => {
    // Faltan dos de D8 y uno de D5: el dominio aparece una vez, en el orden de la encuesta (D5 antes de D8).
    expect(missingDomainsFrom(["d8_61", "d8_62", "d5_38"], domains)).toEqual(["D5 Antecedentes", "D8 Contexto social"]);
  });

  it("sin field_key faltantes: sin dominios", () => {
    expect(missingDomainsFrom([], domains)).toEqual([]);
    expect(missingDomainsFrom(undefined, domains)).toEqual([]);
  });

  it("sin encuesta: sin dominios (no truena)", () => {
    expect(missingDomainsFrom(["d2_19"], null)).toEqual([]);
  });

  it("un field_key desconocido (no está en la encuesta) se ignora", () => {
    expect(missingDomainsFrom(["d2_19", "zzz_99"], domains)).toEqual(["D2 Percepción corporal"]);
  });
});
