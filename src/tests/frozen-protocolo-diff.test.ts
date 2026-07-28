import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF A (T2 A3, regla dura 16): frozen/atlas-protocolo.js es `motorProtocolo` copiado
// VERBATIM de ATLAS.html:13532-13603. Este test cae si alguien edita la ciencia congelada: el
// cuerpo debe coincidir byte a byte con ese rango, y lo unico agregado es el encabezado de
// custodia (un comentario /** */) y la linea aditiva `module.exports` (mecanismo de archivo
// derivado). Si cambia la fuente en ATLAS.html, tambien cae, y eso es correcto: se re-extrae.

const FROM = 13532; // 1-indexed, inclusive
const TO = 13603;

function atlasSlice(): string {
  const lines = readFileSync("docs/entregas/gildardo-2026-07/ATLAS.html", "utf8").split("\n");
  return lines.slice(FROM - 1, TO).join("\n");
}

describe("DIFF A: atlas-protocolo.js verbatim de ATLAS.html", () => {
  const frozen = readFileSync("src/clinical-engine/frozen/atlas-protocolo.js", "utf8");
  const body = atlasSlice();

  it("contiene el rango 13532-13603 byte a byte", () => {
    expect(frozen.includes(body)).toBe(true);
  });

  it("lo unico antes del cuerpo es el encabezado de custodia (un comentario)", () => {
    const before = frozen.slice(0, frozen.indexOf(body));
    expect(before.trimEnd()).toMatch(/^\/\*\*[\s\S]*\*\/$/);
  });

  it("lo unico despues del cuerpo es la linea aditiva module.exports", () => {
    const after = frozen.slice(frozen.indexOf(body) + body.length);
    expect(after.trim()).toBe("module.exports = { motorProtocolo };");
  });
});
