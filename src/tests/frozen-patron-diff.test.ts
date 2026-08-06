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
const FROM = 2930; // 1-indexed, inclusive
const TO = 3002;

function vigenteSlice(): string {
  const lines = readFileSync(VIGENTE, "utf8").split("\n");
  return lines.slice(FROM - 1, TO).join("\n");
}

describe("DIFF-patron: calcPatron verbatim de la entrega vigente (gildardo-2026-08-04, v8)", () => {
  const patron = readFileSync("src/clinical-engine/frozen/engine.patron.js", "utf8");
  const block = vigenteSlice();

  it("engine.patron.js contiene el bloque calcPatron (L2930-3002) byte a byte", () => {
    expect(patron.includes(block)).toBe(true);
  });

  it("el bloque abre con la firma esperada y cierra la funcion", () => {
    expect(block.startsWith("const calcPatron = enc => {")).toBe(true);
    expect(block.trimEnd().endsWith("};")).toBe(true);
  });
});
