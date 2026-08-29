import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ENTREGAS, HTML_VIGENTE } from "./fixtures/html-vigente";

// CANDADO SOBRE EL SITIO DE LLAMADA, no sobre la funcion, porque el defecto es una OMISION: nadie
// "llamo mal" a nada, simplemente se dejo una ruta escrita a mano apuntando a la entrega anterior. Un
// candado sobre `HTML_VIGENTE` habria pasado verde mientras los tests seguian sin usarla.
//
// Lo que atrapa: que un test de paridad vuelva a anclar a un ATLAS_v8.html por ruta literal.

describe("la fuente vigente de Gildardo se deriva, y nadie la escribe a mano", () => {
  it("HTML_VIGENTE apunta a la ULTIMA entrega y el archivo existe", () => {
    expect(ENTREGAS.length).toBeGreaterThan(1);
    expect(HTML_VIGENTE).toContain(ENTREGAS[ENTREGAS.length - 1]);
    expect(existsSync(HTML_VIGENTE)).toBe(true);
  });

  it("ningún test ancla a un ATLAS_v8.html por ruta literal: todos pasan por HTML_VIGENTE", () => {
    // EXCEPCIONES DELIBERADAS, cada una con su razon. Anclan a una entrega CONGELADA a proposito: no
    // son "el archivo vigente", son la foto contra la que se porto un trozo que el no ha vuelto a tocar.
    // Si alguna vez lo toca, el candado de abajo (el de las entregas nuevas) es el que avisa.
    const CONGELADOS = new Set([
      "frozen-derivar-composicion-diff.test.ts",
      "frozen-dfi-ffmilow-diff.test.ts",
      "frozen-patron-diff.test.ts",
      "frozen-protocolo-diff.test.ts",
      "dfi-narrative.golden.test.ts",
    ]);

    const sueltos: string[] = [];
    for (const f of readdirSync("src/tests").filter((f) => f.endsWith(".test.ts"))) {
      if (CONGELADOS.has(f) || f === "html-vigente-lock.test.ts") continue;
      const src = readFileSync(`src/tests/${f}`, "utf8");
      // Solo lineas de CODIGO: un comentario que nombre el archivo es documentacion, no un anclaje.
      const codigo = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      if (/html actualizado \d+ \p{L}+/u.test(codigo)) sueltos.push(f);
    }
    expect(
      sueltos,
      `estos tests anclan a una entrega por ruta literal; usa HTML_VIGENTE de fixtures/html-vigente: ${sueltos.join(", ")}`,
    ).toEqual([]);
  });

  it("los tests CONGELADOS declaran contra qué entrega están anclados", () => {
    // Un ancla congelada es legitima, pero tiene que decir a que se congelo y por que. Si no lo dice,
    // dentro de un mes nadie sabe si es deliberada o si es la de esta vez: una que se quedo atras.
    for (const f of [
      "frozen-derivar-composicion-diff.test.ts",
      "frozen-dfi-ffmilow-diff.test.ts",
      "frozen-patron-diff.test.ts",
      "frozen-protocolo-diff.test.ts",
    ]) {
      const src = readFileSync(`src/tests/${f}`, "utf8");
      expect(/VIGENTE|FUENTE/.test(src), `${f} no declara su ancla`).toBe(true);
    }
  });
});
