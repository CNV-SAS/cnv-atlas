import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF-patron: engine.patron.js es copia VERBATIM de calcPatron en la entrega VIGENTE de
// Gildardo (gildardo-2026-08-04/ATLAS_v8.html, L2930-3002, bloque "PANTALLA MOTOR"). Ancla la
// sincronia byte a byte: si alguien edita calcPatron de nuestro lado, o si Gildardo cambia esa
// region en una entrega nueva, este test cae. El valor correcto sale de SU archivo, no de
// nuestra salida.
//
// A diferencia de DIFF-dfi (que sigue anclado al v7 mientras el re-sync de core esta en pausa),
// este bloque NO tenia version previa: se porta directo del vigente v8. calcPatron es identica
// en v7 y v8 (misma matematica, mismos umbrales), asi que anclar al vigente no arrastra deuda.

const VIGENTE = "docs/entregas/gildardo-2026-08-04/ATLAS_v8.html";
// engine.patron.js trae DOS regiones verbatim NO contiguas del v8:
const FN_FROM = 2930, FN_TO = 3002;       // calcPatron ("PANTALLA MOTOR")
const DATA_FROM = 1221, DATA_TO = 1296;   // FREQ_GROUPS, FREQ_OPC, catColor, catLabel, FREQ_SUP

function vigenteSlice(from: number, to: number): string {
  const lines = readFileSync(VIGENTE, "utf8").split("\n");
  return lines.slice(from - 1, to).join("\n");
}

describe("DIFF-patron: verbatim de la entrega vigente (gildardo-2026-08-04, v8)", () => {
  const patron = readFileSync("src/clinical-engine/frozen/engine.patron.js", "utf8");
  const fnBlock = vigenteSlice(FN_FROM, FN_TO);
  const dataBlock = vigenteSlice(DATA_FROM, DATA_TO);

  it("engine.patron.js contiene el bloque calcPatron (L2930-3002) byte a byte", () => {
    expect(patron.includes(fnBlock)).toBe(true);
  });

  it("engine.patron.js contiene el bloque de datos FREQ_* (L1221-1296) byte a byte", () => {
    expect(patron.includes(dataBlock)).toBe(true);
  });

  it("el bloque de calcPatron abre con la firma esperada y cierra la funcion", () => {
    expect(fnBlock.startsWith("const calcPatron = enc => {")).toBe(true);
    expect(fnBlock.trimEnd().endsWith("};")).toBe(true);
  });

  it("el bloque de datos trae FREQ_OPC con el en-dash U+2013 (no guion normal)", () => {
    // La opcion "1-2 dias" lleva EN-DASH U+2013 (–); parte del acoplamiento por texto.
    expect(dataBlock).toContain("FREQ_OPC");
    expect(dataBlock).toContain("1–2 días"); // en-dash
    expect(dataBlock).not.toContain("1-2 días"); // guion normal U+002D no aparece en esa opcion
  });
});
