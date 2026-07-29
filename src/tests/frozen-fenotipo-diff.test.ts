import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF (T2 A3.4): ancla byte a byte que (1) el harness Via C corre los BYTES VERBATIM de Gildardo
// (dxSarcopenia + el clasificador MCCB) y (2) la tabla FENOTIPOS_MCCB es contenido verbatim. Es la
// base de la fidelidad: si un slice deja de coincidir con la fuente, cae aqui, no en silencio, y el
// golden dejaria de probar que nuestra transcripcion coincide con los bytes de Gildardo. Regenerar
// con el script de extraccion; nunca relajar esta comparacion a "aproximada".

const read = (p: string) => readFileSync(p, "utf8");
const atlas = read("docs/entregas/gildardo-2026-07/ATLAS.html").split("\n");
const slice = (a: number, b: number) => atlas.slice(a - 1, b).join("\n"); // 1-indexed inclusivo

const DX = slice(3414, 3432);
const CLS = slice(10864, 10916);
const TBL = slice(10892, 10903);

const harness = read("src/tests/fixtures/clinical-engine/fenotipo-harness.mjs");
const tabla = read("src/clinical-engine/fenotipos-mccb.ts");

describe("DIFF A3.4: slices verbatim de ATLAS.html", () => {
  it("el harness contiene dxSarcopenia (3414-3432) byte a byte", () => {
    expect(harness.includes(DX)).toBe(true);
  });

  it("el harness contiene el clasificador MCCB (10864-10916) byte a byte", () => {
    expect(harness.includes(CLS)).toBe(true);
  });

  it("fenotipos-mccb.ts contiene las 12 entradas (10892-10903) byte a byte", () => {
    expect(tabla.includes(TBL)).toBe(true);
  });

  it("el harness no re-implementa umbrales ni aritmetica fuera de los slices", () => {
    const outside = harness.replace(DX, "").replace(CLS, "");
    for (const t of ["3.5", "6.0", "5.0", "9.0", "17.92", "21.59", "15.64", "19.34", "Math."]) {
      expect(outside.includes(t)).toBe(false);
    }
  });
});
