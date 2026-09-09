import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { rotuloDisplayDeIndice } from "@/modules/diagnoses/data/indicator-ranges";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

// CANDADO DE LOS ROTULOS DE LA TABLA DE INDICES (2026-09-09).
//
// EL DEFECTO, y lo vio Santiago con Gildardo delante: su tabla dice "Envejecimiento acelerado" y la
// nuestra decia "Acelerado". Al ir a mirar no era una etiqueta suelta, era una FAMILIA ENTERA.
//
// SU ARCHIVO TIENE DOS JUEGOS DE CLASIFICADORES: los CIENTIFICOS (`cIFC`, `cPABU`, `cIAE`, `cIEHH`), que
// son los que el motor congelado sella en el snapshot, y los de DISPLAY (`dIFC`, `dPABU`, `dIAE`,
// `dIEHH`), que son los que su tabla de Diagnostico PINTA. Nosotros mostrabamos los cientificos.
//
// YA LO SABIAMOS POR EL ICA-BIS: esa fila se porto de `dICA` justo por esto, y quedo escrito que su
// archivo "tiene DOS reglas, una por superficie". Lo que no se hizo entonces fue barrer las demas. Es la
// leccion de siempre: arreglar el caso que se reporto y no la FORMA del caso.
//
// SE DERIVA DE SU ARCHIVO VIGENTE. Una tabla de rotulos escrita aqui seria una tercera copia del mismo
// texto, y este texto es lo que el profesional LEE como veredicto.

/** Extrae de su HTML los rotulos de un clasificador de display, en el orden en que aparecen. */
function rotulosDeSuDisplay(nombre: string): string[] {
  const src = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
  const i = src.indexOf(`const ${nombre}  =`) >= 0 ? src.indexOf(`const ${nombre}  =`) : src.indexOf(`const ${nombre} =`);
  if (i < 0) throw new Error(`no aparece ${nombre} en ${HTML_VIGENTE}`);
  const linea = src.slice(i, src.indexOf("\n", i));
  return [...linea.matchAll(/\{l:'([^']+)'/g)].map((m) => m[1]);
}

// Valor que cae en cada escalon, en el MISMO orden en que su clasificador los declara. Es lo unico
// escrito a mano, y tiene que serlo: son sus cortes. Se elige un valor por rama, no el corte exacto.
const SONDAS: Record<string, number[]> = {
  IFC: [2, 5, 8], // <3.5 · 3.5-6.0 · >6.0
  PABU: [1.2, 2.0], // <phi · >phi (la rama de igualdad exacta no se sondea)
  IAE: [-8, 0, 8], // <-5 · -5..5 · >5
  IEHH: [-1, 0.5, 1.5, 3], // <=0 · <=1 · <=2 · resto
};

describe("los rótulos de los índices son los de SU capa de display", () => {
  it("el control: sus clasificadores de display se leen y traen rótulos", () => {
    // Sin esto, un cambio de forma en su HTML daria listas vacias y todo lo de abajo pasaria verde
    // comparando nada contra nada.
    for (const d of ["dIFC", "dIAE", "dIEHH"]) {
      expect(rotulosDeSuDisplay(d).length, `no se leyeron los rótulos de ${d}`).toBeGreaterThan(2);
    }
  });

  it("y cada escalón nuestro coincide con el suyo", () => {
    for (const [codigo, sondas] of Object.entries(SONDAS)) {
      const suyos = rotulosDeSuDisplay(`d${codigo}`);
      const nuestros = sondas.map((v) => rotuloDisplayDeIndice(codigo, v));
      // PABU declara tres ramas y solo se sondean dos: se comparan las que se sondean, en su orden.
      expect(nuestros, `los rótulos de ${codigo} dejaron de ser los suyos`).toEqual(
        suyos.slice(0, nuestros.length),
      );
    }
  });

  it("el IAE es el que se reportó, y trae la palabra que faltaba", () => {
    // El caso concreto que abrio esto. Se deja explicito para que el mensaje de un rojo futuro nombre lo
    // que Gildardo vio en pantalla.
    expect(rotuloDisplayDeIndice("IAE", 8)).toBe("Envejecimiento acelerado");
    expect(rotuloDisplayDeIndice("IAE", -8)).toBe("Envejecimiento desacelerado");
  });

  it("y los que NO difieren no se tocan", () => {
    // IRC e ISCM tienen el mismo rotulo en las dos capas (su `dIRC` delega literalmente en `cIRC`).
    // Meterlos en el mapa seria una copia que puede divergir sola del clasificador congelado.
    expect(rotuloDisplayDeIndice("IRC", 1.5)).toBeNull();
    expect(rotuloDisplayDeIndice("ISCM", -2)).toBeNull();
    expect(rotuloDisplayDeIndice("ICA-BIS", 0.4), "ICA-BIS ya se resuelve entero aparte").toBeNull();
  });

  it("y sin valor no hay rótulo que inventar", () => {
    expect(rotuloDisplayDeIndice("IAE", null)).toBeNull();
  });
});
