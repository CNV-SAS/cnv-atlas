import { readFileSync } from "node:fs";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

import { describe, expect, it } from "vitest";

// DIFF A (T2 A3, regla dura 16): frozen/atlas-protocolo.js es `motorProtocolo` copiado
// VERBATIM del archivo VIGENTE de Gildardo. Este test cae si alguien edita la ciencia congelada: el
// cuerpo debe coincidir byte a byte con ese rango, y lo unico agregado es el encabezado de
// custodia (un comentario /** */) y la linea aditiva `module.exports` (mecanismo de archivo
// derivado). Si cambia la fuente, tambien cae, y eso es correcto: se re-extrae.
// RE-ANCLADO 2026-08-19 al SWAP contra ATLAS_v8.html del 18 (punto 6, objetivo calorico a 0): antes
// anclaba contra gildardo-2026-07/ATLAS.html L13532-13603; ese swap movio la fuente y se re-extrajo.

// RE-ANCLADO EL 2026-09-04, por dos motivos a la vez:
//
//   1. LA FUENTE SE MOVIO. Su entrega del 3 retira la fila renal de proteina de `motorProtocolo`, y esa
//      retirada se porto. Este diff seguia comparando contra la entrega del 18, que si la tiene, asi que
//      se puso rojo diciendo la verdad: el frozen ya no es el del 18, es el de hoy.
//   2. Y ESTABA ANCLADO POR RANGO DE LINEAS (15411-15488), que es una POSICION y se desincroniza en
//      cuanto el inserta algo mas arriba. Es el mismo antipatron que ya se corrigio en `motor-trat-nutri`
//      y en el candado de la cadena calorica. Ahora se extrae POR NOMBRE.
//
// Lo que el diff afirma NO cambia: que el frozen es su funcion verbatim, con lo unico nuestro siendo la
// cabecera de custodia y el `module.exports` final.
describe("DIFF A: atlas-protocolo.js verbatim de su entrega vigente", () => {
  const frozen = readFileSync("src/clinical-engine/frozen/atlas-protocolo.js", "utf8");
  // `funcionDelHtml` no sirve aqui: `motorProtocolo` es una funcion FLECHA (`const motorProtocolo = (...)
  // => {`), no una declaracion. Se extrae con su forma, y sigue siendo por NOMBRE y no por posicion, que
  // es lo que importa.
  const body = (() => {
    const lineas = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n").split("\n");
    const i = lineas.findIndex((l) => l.startsWith("const motorProtocolo = "));
    if (i < 0) throw new Error("no aparece `const motorProtocolo = ` en la entrega vigente");
    let prof = 0;
    let j = i;
    do {
      prof += (lineas[j].match(/\{/g) ?? []).length - (lineas[j].match(/\}/g) ?? []).length;
      j++;
    } while (prof > 0 && j < lineas.length);
    return lineas.slice(i, j).join("\n");
  })();

  it("contiene su `motorProtocolo` entero, byte a byte", () => {
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
