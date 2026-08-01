import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF-dfi (re-sync 2026-08-01): el bloque de calcLE8 en engine.dfi.js (el interruptor
// LE8_MAPEO_CORREGIDO + el mapeo del ICEC + la función calcLE8) es copia VERBATIM de la entrega
// VIGENTE de Gildardo (gildardo-2026-07-30/ATLAS_v7.html), líneas 6509-6590. Ancla la sincronía: si
// alguien edita calcLE8 de nuestro lado, o si Gildardo cambia esa región en una entrega nueva, este
// test cae. El valor correcto sale de SU archivo, no de nuestra salida.
//
// (engine.core.js NO tiene un DIFF así a propósito: está desactualizado, con cPABU/cMMEM retenidos
// esperando Q27; ver su encabezado. Cuando se resuelva, entra su DIFF-core.)

const VIGENTE = "docs/entregas/gildardo-2026-07-30/ATLAS_v7.html";
const FROM = 6509; // 1-indexed, inclusive
const TO = 6590;

function vigenteSlice(): string {
  const lines = readFileSync(VIGENTE, "utf8").split("\n");
  return lines.slice(FROM - 1, TO).join("\n");
}

describe("DIFF-dfi: calcLE8 verbatim de la entrega vigente (gildardo-2026-07-30)", () => {
  const dfi = readFileSync("src/clinical-engine/frozen/engine.dfi.js", "utf8");
  const block = vigenteSlice();

  it("engine.dfi.js contiene el bloque calcLE8 (L6509-6590) byte a byte", () => {
    expect(dfi.includes(block)).toBe(true);
  });

  it("el bloque trae el interruptor en OFF (mapeo dormido, sin cambio de comportamiento)", () => {
    expect(block).toContain("const LE8_MAPEO_CORREGIDO = false;");
    expect(dfi).toContain("const LE8_MAPEO_CORREGIDO = false;");
  });
});
