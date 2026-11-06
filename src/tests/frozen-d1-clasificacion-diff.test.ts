import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CAMBIOS_NUEVOS, htmlDeCambioNuevo } from "./fixtures/html-vigente";

// DIFF-d1: `engine.d1-clasificacion.js` es copia VERBATIM del bloque de clasificacion del patron usual de
// la entrega del 4 de noviembre de 2026 (`ATLAS_v16.html`, L1401-1455): `D1_FREQ_TXT`, `d1EstadoGrupo`,
// `d1Clasificar`, `d1Lista` y `d1TextoPatron`. Ancla la sincronia byte a byte: si alguien edita el
// clasificador de nuestro lado, o si Gildardo cambia esa region en una entrega nueva, este test cae. El
// valor correcto sale de SU archivo, no de nuestra salida.
//
// POR QUE ANCLA POR NOMBRE DE FUNCION Y NO POR RANGO DE LINEAS: un rango es una posicion, y una posicion se
// desincroniza en cuanto el autor inserta algo mas arriba (ya paso el 29 de agosto con el piso calorico).
// Los helpers `funcionDelHtml` del fixture cuentan llaves desde el nombre.
//
// LA ENTREGA VA DERIVADA, no escrita a mano: `htmlDeCambioNuevo` es la unica ruta literal del repositorio
// y vive en el fixture. La carpeta SI se nombra, porque este candado afirma "se porto de ESA entrega", que
// es una foto a proposito, no "la entrega de hoy" (eso lo mira `frozen-deriva-vigente`).

const ENTREGA = "4 noviembre";

describe("DIFF-d1: verbatim de la entrega del 4 de noviembre (ATLAS_v16)", () => {
  const nuestro = readFileSync("src/clinical-engine/frozen/engine.d1-clasificacion.js", "utf8").replace(/\r\n/g, "\n");

  it("la entrega del 4 de noviembre existe y se deriva del directorio", () => {
    // Sin esto, un cambio de nombre de carpeta dejaria los `it` de abajo sin correr, y cero aserciones
    // tambien pasa verde.
    expect(CAMBIOS_NUEVOS).toContain(ENTREGA);
  });

  const suyo = readFileSync(htmlDeCambioNuevo(ENTREGA), "utf8").replace(/\r\n/g, "\n");

  for (const nombre of ["d1EstadoGrupo", "d1Clasificar", "d1Lista", "d1TextoPatron"]) {
    it(`${nombre} esta byte a byte como en su archivo`, () => {
      const i = suyo.indexOf(`function ${nombre}(`);
      expect(i, `no aparece function ${nombre}( en su archivo`).toBeGreaterThan(0);
      let prof = 0;
      let bloque = "";
      for (let j = suyo.indexOf("{", i); j < suyo.length; j++) {
        if (suyo[j] === "{") prof++;
        else if (suyo[j] === "}" && --prof === 0) {
          bloque = suyo.slice(i, j + 1);
          break;
        }
      }
      expect(bloque.length, `function ${nombre} no cierra en su archivo`).toBeGreaterThan(0);
      expect(nuestro.includes(bloque)).toBe(true);
    });
  }

  it("D1_FREQ_TXT (los cinco textos de frecuencia) esta byte a byte", () => {
    const linea = suyo.split("\n").find((l) => l.startsWith("const D1_FREQ_TXT = "));
    expect(linea, "no aparece const D1_FREQ_TXT en su archivo").toBeTruthy();
    expect(nuestro.includes(linea as string)).toBe(true);
  });

  it("y el comentario con los cortes por grupo viaja con el codigo", () => {
    // Su comentario de cabecera es donde estan escritas las FUENTES de cada corte (IARC grupo 1,
    // WCRF/AICR 3 porciones por semana). Un umbral clinico sin su fuente al lado no se escribe (regla de
    // Santiago, 2026-10-02), asi que el comentario no es decoracion: es la mitad que lo justifica.
    expect(nuestro).toContain("Carnes procesadas (12) ..... exceso ≥ 2 · a moderar 1 (IARC grupo 1; WCRF «poco o nada»)");
    expect(nuestro).toContain("Carnes rojas (15) .......... exceso ≥ 3 · a moderar 2 (WCRF/AICR: ≤ 3 porciones por semana)");
  });

  it("el UNICO andamiaje nuestro es el require de FREQ_GROUPS y el module.exports", () => {
    // Si manana alguien agrega una linea propia dentro del bloque, este test lo dice. La cabecera de
    // comentario no cuenta: se quita antes de comparar, como en el resto del frozen.
    const sinCabecera = nuestro.replace(/\/\*[\s\S]*?\*\//g, "");
    const propias = sinCabecera
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//"))
      .filter((l) => !suyo.includes(l));
    expect(propias).toEqual([
      "const { FREQ_GROUPS } = require('./engine.patron.js');",
      "module.exports = { D1_FREQ_TXT, d1EstadoGrupo, d1Clasificar, d1Lista, d1TextoPatron };",
    ]);
  });

  it("FREQ_GROUPS no se duplico: la tabla sigue viniendo de engine.patron.js", () => {
    // La razon por la que se puede requerir la del v8: es IDENTICA a la del v16. Si el cambiara la tabla
    // en una entrega nueva, esto se pone rojo y hay que decidir, en vez de arrastrar dos tablas.
    const patron = readFileSync("src/clinical-engine/frozen/engine.patron.js", "utf8").replace(/\r\n/g, "\n");
    const i = patron.indexOf("const FREQ_GROUPS = [");
    const j = patron.indexOf('const FREQ_OPC = [', i);
    const tabla = patron.slice(i, j).trimEnd();
    expect(suyo.includes(tabla)).toBe(true);
    expect(nuestro).not.toContain("const FREQ_GROUPS = [");
  });
});
