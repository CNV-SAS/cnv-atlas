import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF A (T2 A3, regla dura 16): frozen/atlas-protocolo.js es `motorProtocolo` copiado
// VERBATIM del archivo VIGENTE de Gildardo. Este test cae si alguien edita la ciencia congelada: el
// cuerpo debe coincidir byte a byte con ese rango, y lo unico agregado es el encabezado de
// custodia (un comentario /** */) y la linea aditiva `module.exports` (mecanismo de archivo
// derivado). Si cambia la fuente, tambien cae, y eso es correcto: se re-extrae.
// RE-ANCLADO 2026-08-19 al SWAP contra ATLAS_v8.html del 18 (punto 6, objetivo calorico a 0): antes
// anclaba contra gildardo-2026-07/ATLAS.html L13532-13603; ese swap movio la fuente y se re-extrajo.

// RE-ANCLADO 2026-08-27: la ruta apuntaba a "Gildardo responses/ATLAS_v8.html", que NO EXISTE (sus
// entregas viven en carpetas fechadas), asi que el test llevaba dias rojo por ENOENT y no por la
// ciencia. Se ancla al archivo del que SE EXTRAJO el frozen (la entrega del 18, carpeta "19 agosto"),
// que es lo que este diff dice verificar. NO se ancla al mas nuevo: si la ciencia cambia en la entrega
// siguiente esto tiene que ROMPERSE para que se re-extraiga, no seguirla en silencio.
const FUENTE = "docs/entregas/Gildardo responses/html actualizado 19 agosto/ATLAS_v8.html";

const FROM = 15411; // 1-indexed, inclusive (motorProtocolo en el archivo del 18)
const TO = 15488;

function atlasSlice(): string {
  // El archivo del 18 viene en CRLF (nota de Gildardo); el frozen esta en LF. Se normaliza a LF
  // (split /\r?\n/) para comparar la CIENCIA, no los saltos de linea. La matematica es la misma.
  const lines = readFileSync(FUENTE, "utf8").split(/\r?\n/);
  return lines.slice(FROM - 1, TO).join("\n");
}

describe("DIFF A: atlas-protocolo.js verbatim del archivo del 18", () => {
  const frozen = readFileSync("src/clinical-engine/frozen/atlas-protocolo.js", "utf8");
  const body = atlasSlice();

  it("contiene el rango 15411-15488 (motorProtocolo del 18) byte a byte", () => {
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
