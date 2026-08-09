import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF-derivar-composicion: derivar-composicion.js es copia VERBATIM del bloque de derivaciones de la
// entrega VIGENTE de Gildardo (gildardo-2026-08-04/ATLAS_v8.html, L153-235: "Seccion 4 - derivaciones" +
// "Seccion 4.8 - control de calidad"). Es un rango CONTIGUO, asi que se ancla byte a byte (como los motores
// de tratamiento): si alguien edita las identidades de nuestro lado, o Gildardo cambia esa region en una
// entrega nueva, este test cae. El valor correcto sale de SU archivo, no de nuestra salida.

const VIGENTE = "docs/entregas/gildardo-2026-08-04/ATLAS_v8.html";
const FROM = 153,
  TO = 235;

function vigenteSlice(from: number, to: number): string {
  const lines = readFileSync(VIGENTE, "utf8").split("\n");
  return lines.slice(from - 1, to).join("\n");
}

describe("DIFF-derivar-composicion: verbatim de la entrega vigente (v8)", () => {
  const frozen = readFileSync("src/clinical-engine/frozen/derivar-composicion.js", "utf8");
  const block = vigenteSlice(FROM, TO);

  it("derivar-composicion.js contiene el bloque L153-235 byte a byte", () => {
    expect(frozen.includes(block)).toBe(true);
  });

  it("el bloque trae derivarFaltantes y controlCalidadImport", () => {
    expect(block).toContain("function derivarFaltantes(d) {");
    expect(block).toContain("function controlCalidadImport(d) {");
  });

  it("las constantes de las identidades confirmadas van con su valor exacto (en-dash del v8)", () => {
    // Las 5 identidades confirmadas: FFW 0,15 · AEC_sg 0,1125 · AIC_sg 0,0375 · MCA 1,0162. En-dash U+2212.
    expect(block).toContain("ACT - 0.15   * FM");
    expect(block).toContain("AEC - 0.1125 * FM");
    expect(block).toContain("AIC - 0.0375 * FM");
    expect(block).toContain("1.0162 * AIC + MPM");
  });
});
