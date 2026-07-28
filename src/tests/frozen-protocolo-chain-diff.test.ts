import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF B (T2 A3): el harness Via C (protocolo-chain-harness.mjs) corre los bytes VERBATIM de
// ATLAS.html:14124-14137 (la cadena aritmetica), no nuestra transcripcion de protocolo-calorico.ts.
// Es el ORACULO de GOLDEN 1. Este test cae si el slice del harness deja de coincidir byte a byte
// con la fuente: si eso pasa, el oraculo perdio su independencia y GOLDEN 1 dejaria de probar que
// nuestra transcripcion coincide con los bytes de Gildardo.

const FROM = 14124; // 1-indexed, inclusive
const TO = 14137;

function atlasSlice(): string {
  const lines = readFileSync("docs/entregas/gildardo-2026-07/ATLAS.html", "utf8").split("\n");
  return lines.slice(FROM - 1, TO).join("\n");
}

describe("DIFF B: harness Via C verbatim de ATLAS.html", () => {
  const harness = readFileSync(
    "src/tests/fixtures/clinical-engine/protocolo-chain-harness.mjs",
    "utf8",
  );
  const slice = atlasSlice();

  it("el harness contiene el slice 14124-14137 byte a byte", () => {
    expect(harness.includes(slice)).toBe(true);
  });

  it("el envoltorio no agrega aritmetica (fuera del slice no hay Math.round/max)", () => {
    const outside = harness.replace(slice, "");
    expect(outside).not.toMatch(/Math\.(round|max)\(/);
  });
});
