import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF (regla dura 16, D-008/D-014): frozen/atlas-tratamiento.js son los motores de tratamiento por
// profesion copiados VERBATIM del archivo VIGENTE (gildardo-2026-07-30/ATLAS_v7.html), la autoridad
// actual. Este test cae si alguien edita la ciencia congelada: el cuerpo debe coincidir byte a byte
// con su rango en el vigente. Si Gildardo mueve su archivo, tambien cae, y eso es correcto: se
// re-extrae citando la instruccion. Se agrega un motor por vez (D-008: psico -> ejercicio -> medico).

function vigenteSlice(from: number, to: number): string {
  const lines = readFileSync("docs/entregas/gildardo-2026-07-30/ATLAS_v7.html", "utf8").split("\n");
  return lines.slice(from - 1, to).join("\n"); // from/to 1-indexed, inclusive
}

describe("DIFF: atlas-tratamiento.js verbatim del vigente ATLAS_v7.html", () => {
  const frozen = readFileSync("src/clinical-engine/frozen/atlas-tratamiento.js", "utf8");

  it("motorTratPsico coincide byte a byte con L14235-14254", () => {
    expect(frozen.includes(vigenteSlice(14235, 14254))).toBe(true);
  });

  it("lo unico despues del ultimo motor es la linea aditiva module.exports", () => {
    const body = vigenteSlice(14235, 14254);
    const after = frozen.slice(frozen.indexOf(body) + body.length);
    expect(after.trim()).toBe("module.exports = { motorTratPsico };");
  });

  it("antes del primer motor solo hay el encabezado de custodia (un comentario)", () => {
    const idx = frozen.indexOf("function motorTratPsico");
    expect(frozen.slice(0, idx).trimEnd()).toMatch(/^\/\*\*[\s\S]*\*\/$/);
  });
});
