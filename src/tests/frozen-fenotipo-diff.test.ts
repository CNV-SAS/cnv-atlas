import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF (T2 A3.4): ancla byte a byte que (1) el harness Via C corre los BYTES VERBATIM de Gildardo
// (dxSarcopenia + el clasificador MCCB) y (2) la tabla FENOTIPOS_MCCB es contenido verbatim. Es la
// base de la fidelidad: si un slice deja de coincidir con la fuente, cae aqui, no en silencio, y el
// golden dejaria de probar que nuestra transcripcion coincide con los bytes de Gildardo. Regenerar
// con el script de extraccion; nunca relajar esta comparacion a "aproximada".

const read = (p: string) => readFileSync(p, "utf8");
// RE-ANCLADO al VIGENTE (2026-08-02): antes leia la entrega de julio (gildardo-2026-07/ATLAS.html).
// Gildardo unifico la frontera de desnutricion (FMI H 3.5->3.0, FFMI H 17.92->17, M 15.64->15) en el
// vigente; nuestro port de julio quedo atras. Ahora el harness y la tabla se verifican contra el vigente.
const atlas = read("docs/entregas/gildardo-2026-07-30/ATLAS_v7.html").split("\n");
const slice = (a: number, b: number) => atlas.slice(a - 1, b).join("\n"); // 1-indexed inclusivo

const DX = slice(3417, 3435);
const CLS = slice(11060, 11105);
const TBL = slice(11091, 11102);

const harness = read("src/tests/fixtures/clinical-engine/fenotipo-harness.mjs");
const tabla = read("src/clinical-engine/fenotipos-mccb.ts");

describe("DIFF A3.4: slices verbatim de ATLAS.html", () => {
  it("el harness contiene dxSarcopenia (vigente 3417-3435) byte a byte", () => {
    expect(harness.includes(DX)).toBe(true);
  });

  it("el harness contiene el clasificador MCCB (vigente 11060-11105) byte a byte", () => {
    expect(harness.includes(CLS)).toBe(true);
  });

  it("fenotipos-mccb.ts contiene las 12 entradas (vigente 11091-11102) byte a byte", () => {
    expect(tabla.includes(TBL)).toBe(true);
  });

  it("el harness no re-implementa umbrales ni aritmetica fuera de los slices", () => {
    const outside = harness.replace(DX, "").replace(CLS, "");
    // Solo los umbrales DISTINTIVOS: los inferiores del vigente (3.0/17/15) son substrings demasiado
    // comunes para asertar ausencia. Estos cinco + Math. bastan para atrapar una reimplementacion.
    for (const t of ["6.0", "5.0", "9.0", "21.59", "19.34", "Math."]) {
      expect(outside.includes(t)).toBe(false);
    }
  });
});
