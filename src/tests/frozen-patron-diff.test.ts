import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CAMBIOS_NUEVOS, htmlDeCambioNuevo } from "./fixtures/html-vigente";

// DIFF-patron: `engine.patron.js` es copia VERBATIM del patron alimentario del archivo de Gildardo. Ancla
// la sincronia byte a byte: si alguien edita `calcPatron` de nuestro lado, o si Gildardo cambia esa region
// en una entrega nueva, este test cae. El valor correcto sale de SU archivo, no de nuestra salida.
//
// ═══ RE-ANCLADO AL v16 EL 2026-11-06, Y EL ANCLA VIEJA ERA EL DEFECTO QUE ESTE CANDADO EXISTE PARA EVITAR
//
// Hasta hoy este archivo comparaba contra una ruta ESCRITA A MANO (`docs/entregas/gildardo-2026-08-04/
// ATLAS_v8.html`) y contra RANGOS DE LINEA fijos (L2930-3002, L1221-1296). Las dos cosas son lo que la
// cabecera de `fixtures/html-vigente.ts` prohibe, y por la razon que ahi esta escrita: un diff anclado a
// una entrega superada **pasa verde por construccion**. No compara mal: compara bien contra el archivo
// equivocado. Entre el v8 del 4 de agosto y el v16 del 4 de noviembre Gildardo reescribio `calcPatron`
// entero (su §4.2), y este test siguio verde tres meses.
//
// Ahora: la entrega va DERIVADA del directorio (`htmlDeCambioNuevo`, la unica ruta literal del repositorio
// vive en el fixture) y los bloques se buscan por NOMBRE, no por posicion. Mismo patron que
// `frozen-d1-clasificacion-diff.test.ts`, que ya anclaba bien.
//
// LA CARPETA SI SE NOMBRA, igual que alla: este candado afirma "se porto de ESA entrega", que es una foto
// a proposito. "La entrega de hoy" la mira `frozen-deriva-vigente`.

const ENTREGA = "4 noviembre";

/** El bloque de una funcion de flecha `const <nombre> = enc => { ... };`, contando llaves. */
function bloqueFlecha(src: string, nombre: string): string {
  const i = src.indexOf(`const ${nombre} = enc => {`);
  expect(i, `no aparece const ${nombre} = enc => { en su archivo`).toBeGreaterThan(0);
  let prof = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") prof++;
    else if (src[j] === "}" && --prof === 0) return src.slice(i, j + 1);
  }
  throw new Error(`const ${nombre} no cierra en su archivo`);
}

describe("DIFF-patron: verbatim de la entrega del 4 de noviembre (ATLAS_v16)", () => {
  const nuestro = readFileSync("src/clinical-engine/frozen/engine.patron.js", "utf8").replace(/\r\n/g, "\n");

  it("la entrega del 4 de noviembre existe y se deriva del directorio", () => {
    // Sin esto, un cambio de nombre de carpeta dejaria los `it` de abajo sin correr, y cero aserciones
    // tambien pasa verde.
    expect(CAMBIOS_NUEVOS).toContain(ENTREGA);
  });

  const suyo = readFileSync(htmlDeCambioNuevo(ENTREGA), "utf8").replace(/\r\n/g, "\n");

  it("calcPatron esta byte a byte como en su v16", () => {
    expect(nuestro.includes(bloqueFlecha(suyo, "calcPatron"))).toBe(true);
  });

  // LOS CINCO BLOQUES DE DATOS, PIEZA POR PIEZA Y NO EN UN SOLO TROZO. En el v8 eran contiguos (L1221-1296)
  // y en el v16 no lo son, asi que comparar el trozo entero daria rojo sin que ninguna pieza haya cambiado.
  // Medido el 2026-11-06: las cinco son IDENTICAS del v8 al v16.
  const DATOS: Array<[string, string]> = [
    ["FREQ_GROUPS", "const FREQ_OPC = ["],
    ["FREQ_OPC", "const catColor = {"],
    ["catColor", "const catLabel = {"],
    ["catLabel", "const FREQ_SUP = ["],
    ["FREQ_SUP", "const calcPatron = enc => {"],
  ];

  for (const [nombre, siguiente] of DATOS) {
    it(`el bloque de datos ${nombre} esta byte a byte como en su v16`, () => {
      const a = nuestro.indexOf(`const ${nombre} = `);
      expect(a, `no aparece const ${nombre} en engine.patron.js`).toBeGreaterThan(0);
      const b = nuestro.indexOf(siguiente, a + 1);
      expect(b, `no aparece ${siguiente} despues de ${nombre}`).toBeGreaterThan(a);
      const pieza = nuestro.slice(a, b).trimEnd();
      expect(suyo.includes(pieza)).toBe(true);
    });
  }

  it("FREQ_OPC trae el en-dash U+2013 (no guion normal)", () => {
    // La opcion "1-2 dias" lleva EN-DASH U+2013 (–); parte del acoplamiento por texto con la encuesta.
    expect(nuestro).toContain("1–2 días"); // en-dash
    expect(nuestro).not.toContain("1-2 días"); // guion normal U+002D no aparece en esa opcion
  });

  it("el UNICO andamiaje nuestro es el module.exports", () => {
    // Si manana alguien agrega una linea propia dentro del bloque, este test lo dice. La cabecera de
    // comentario no cuenta: se quita antes de comparar, como en el resto del frozen.
    const sinCabecera = nuestro.replace(/\/\*[\s\S]*?\*\//g, "");
    const propias = sinCabecera
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//"))
      .filter((l) => !suyo.includes(l));
    expect(propias).toEqual([
      "module.exports = { FREQ_GROUPS, FREQ_OPC, catColor, catLabel, FREQ_SUP, calcPatron };",
    ]);
  });

  it("y las cuatro piezas del cambio de su §4.2 estan, cada una con su marca", () => {
    // EL CONTROL POSITIVO del re-porte: sin esto, el dia que alguien revirtiera `calcPatron` al v8 los
    // `includes` de arriba seguirian pasando si tambien se cambiara el ancla. Esto nombra lo que su §4.2
    // decide, que es lo que no se puede perder sin que alguien lo note.
    // Se mira el BLOQUE DE CODIGO, no el archivo: la cabecera de arriba nombra lo que el v8 hacia, y
    // buscarlo en todo el archivo lo encontraria en un comentario.
    const codigo = bloqueFlecha(nuestro, "calcPatron");
    expect(codigo).toContain("score += protPts * 6 / 7;"); // 1 · los siete protectores, reescalados
    expect(codigo).toContain("const emb = riesgo[1];"); // 2 · embutidos al doble
    expect(codigo).toContain("const rojas = neutro[3];"); // 3 · carnes rojas penalizadas
    expect(codigo).toContain("if (riesgo[1] >= 2) score = Math.min(score, 54);"); // 4 · el tope de 54
    expect(codigo).not.toContain("prot.slice(0, 6)"); // lo que el v8 hacia con los huevos
  });
});
