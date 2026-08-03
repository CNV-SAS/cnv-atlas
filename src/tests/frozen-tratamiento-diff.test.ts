import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF (regla dura 16, D-008/D-014): frozen/atlas-tratamiento.js son los tres motores de tratamiento
// por profesion (medico, ejercicio, psico) copiados VERBATIM del rango CONTIGUO L14176-14254 del
// archivo VIGENTE (gildardo-2026-07-30/ATLAS_v7.html), la autoridad actual. Cae si alguien edita la
// ciencia congelada o si Gildardo mueve su archivo (correcto: se re-extrae citando la instruccion).

function vigenteSlice(from: number, to: number): string {
  const lines = readFileSync("docs/entregas/gildardo-2026-07-30/ATLAS_v7.html", "utf8").split("\n");
  return lines.slice(from - 1, to).join("\n"); // from/to 1-indexed, inclusive
}

describe("DIFF: atlas-tratamiento.js verbatim del vigente ATLAS_v7.html (L14176-14254)", () => {
  const frozen = readFileSync("src/clinical-engine/frozen/atlas-tratamiento.js", "utf8");
  const body = vigenteSlice(14176, 14254);

  it("los tres motores coinciden byte a byte con el rango contiguo L14176-14254", () => {
    expect(frozen.includes(body)).toBe(true);
  });

  it("antes del cuerpo solo hay el encabezado de custodia (un comentario)", () => {
    expect(frozen.slice(0, frozen.indexOf(body)).trimEnd()).toMatch(/^\/\*\*[\s\S]*\*\/$/);
  });

  it("despues del cuerpo solo la linea aditiva module.exports de los tres", () => {
    const after = frozen.slice(frozen.indexOf(body) + body.length);
    expect(after.trim()).toBe("module.exports = { motorTratMedico, motorTratEjercicio, motorTratPsico };");
  });
});
