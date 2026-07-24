import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildComposition } from "@/modules/diagnoses/data/composition-map";
import { normalizeHeader } from "@/modules/bis/services/header-map";

// Candado del mapeo de circunferencias. Un bug real (2026-07-24) hacia que `cintura` leyera la
// columna de UMBRAL de referencia ("Patient risk monitoring Waist Size ... referencia cm" = 102 cm,
// el corte OMS masculino) en vez de la MEDIDA ("Waist Size cm" = 98). Como el badge de riesgo CV se
// calcula sobre ese valor, cada hombre se comparaba contra su propio umbral (102 vs 102) -> "Riesgo
// CV elevado" SIEMPRE: falso positivo clinico sistematico. Este test lo ancla contra el export real.

// Crudos como los persiste el import: variable_name = normalizeHeader(header del export).
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/clinical-engine/biody-juan-esteban-anon.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

const raw: Record<string, number> = {};
for (const [k, v] of Object.entries(fixture)) {
  if (typeof v === "number") raw[normalizeHeader(k)] = v;
}

describe("buildComposition: mapeo de cintura/cadera (candado del falso positivo CV)", () => {
  const comp = buildComposition(raw, "2026-07-11T15:52:00+00:00");

  it("cintura lee la circunferencia MEDIDA (Waist Size cm = 98), no el umbral", () => {
    expect(comp.cintura).toBe(98);
    // Guarda explicita: NUNCA el umbral de referencia (102). Si alguien vuelve a apuntar el mapeo a
    // "Patient risk monitoring Waist Size ... referencia cm", este assert falla.
    expect(comp.cintura).not.toBe(102);
  });

  it("cadera lee la circunferencia MEDIDA (Hips Size cm = 105)", () => {
    expect(comp.cadera).toBe(105);
  });

  it("la fila Cintura de la tabla tambien usa la MEDIDA, no el umbral", () => {
    const nivelV = comp.levels.find((l) => l.title.includes("Cuerpo entero"));
    const filaCintura = nivelV?.rows.find((r) => r.key === "cintura");
    expect(filaCintura?.value).toBe(98);
    expect(filaCintura?.value).not.toBe(102);
  });

  it("el umbral de referencia (102) SI esta en los crudos: el bug era de lectura, no de datos", () => {
    // Ambas columnas se persisten; el bug era elegir la de referencia. Documenta que 102 existe.
    expect(raw[normalizeHeader("Patient risk monitoring Waist Size  measurementDetails.REFERENCEESTIMEEEXPORT cm")]).toBe(102);
  });
});
