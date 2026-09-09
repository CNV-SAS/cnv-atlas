import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HTML_VIGENTE } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LA DIRECCION DE LA Δ (2026-09-10).
//
// QUE SE PORTO: su `difCell` colorea la columna Δ de Antropometria segun de que lado de la referencia cae
// el valor. La regla esta en una linea suya: `const esMalo = invertido ? d > 0 : d < 0`. O sea, por defecto
// SUBIR es lo favorable (mas masa magra, mas agua, mas mineral oseo) y en unas pocas filas es al reves.
//
// POR QUE HACE FALTA UN CANDADO: esas "pocas filas" son una lista, y una lista escrita a mano es
// exactamente lo que envejece en silencio cuando el manda otra entrega. Si el añade una fila invertida (o
// invierte una que hoy no lo esta), nuestra tabla pintaria de verde algo que el pinta de rojo, y NADA
// daria error: el numero seria el mismo y solo el color estaria al reves. Un color que miente sobre la
// direccion es peor que no tener color.
//
// SE DERIVA DE SU ARCHIVO VIGENTE, no de una copia escrita aqui.

const SECCION = readFileSync("src/modules/diagnoses/components/composition-section.tsx", "utf8");

/**
 * Las llamadas a `difCell` de su tabla de Wang, con su bandera.
 *
 * La CLAVE de cada fila se toma del primer `bis.X` o `ant.X` de los argumentos, que es el valor que se
 * mide: `difCell(bis.FM, bis.FM_ref, true)` -> FM, `difCell(ant.cintura||bis.cintura, ...)` -> cintura,
 * `difCell(bis.peso||ant.peso, pesoMeta, true)` -> peso. Se ancla en el identificador y no en la posicion
 * de la fila, que se desincroniza sola en cuanto el inserta algo.
 */
function direccionesDeSuArchivo(): { clave: string; invertido: boolean }[] {
  const src = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
  const filas: { clave: string; invertido: boolean }[] = [];
  for (const m of src.matchAll(/difCell\(([^;]{0,200}?),\s*(true|false)\)/g)) {
    const args = m[1];
    const clave = /(?:bis|ant)\.([A-Za-z_][A-Za-z0-9_]*)/.exec(args)?.[1];
    if (!clave || clave.endsWith("_ref")) continue;
    filas.push({ clave, invertido: m[2] === "true" });
  }
  return filas;
}

/** Nuestro `SUBIR_ES_ADVERSO`, leido del codigo y no re-escrito aqui (seria la tercera fuente). */
function nuestrasInvertidas(): string[] {
  const m = /const SUBIR_ES_ADVERSO = new Set\(\[([^\]]*)\]\)/.exec(sinComentarios(SECCION));
  if (!m) throw new Error("no se encontro SUBIR_ES_ADVERSO en composition-section");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
}

describe("la dirección de la Δ es la de su archivo", () => {
  it("el control: su tabla usa difCell en las dos direcciones", () => {
    // Sin esto, una extraccion que fallara y devolviera vacio dejaria pasar en verde todo lo de abajo, y
    // ademas una lista TODA en `false` haria pasar la comparacion si la nuestra tambien se vaciara.
    const filas = direccionesDeSuArchivo();
    expect(filas.length, "no se leyo ninguna llamada a difCell").toBeGreaterThan(20);
    expect(filas.some((f) => f.invertido), "ninguna fila invertida: la extracción está mal").toBe(true);
    expect(filas.some((f) => !f.invertido), "ninguna fila normal: la extracción está mal").toBe(true);
  });

  it("las filas donde SUBIR es lo adverso son exactamente las suyas", () => {
    const suyas = [...new Set(direccionesDeSuArchivo().filter((f) => f.invertido).map((f) => f.clave))].sort();
    expect(
      nuestrasInvertidas(),
      "su archivo invirtió (o dejó de invertir) una fila y nuestro color quedó al revés",
    ).toEqual(suyas);
  });
});

describe("el color de la Δ no es la capa clínica", () => {
  it("usa el par de interfaz `--delta-*`, nunca `--clinical-*`", () => {
    // Su rojo es `#dc2626`, que es el hex EXACTO de nuestro `--clinical-critical`. Portarlo literal
    // gastaria el rojo del veredicto en una senal que no lo es.
    const limpio = sinComentarios(SECCION);
    const helper = limpio.slice(limpio.indexOf("function colorDeDelta"));
    expect(helper.slice(0, 500)).toContain("text-delta-adversa");
    expect(helper.slice(0, 500)).toContain("text-delta-favorable");
    expect(helper.slice(0, 500), "la Δ se pintó con el color de un veredicto").not.toContain("clinical-");
  });

  it("y los dos tonos existen en la capa de interfaz, no en la clínica", () => {
    const CSS = readFileSync("src/app/globals.css", "utf8");
    for (const token of ["--delta-favorable", "--delta-adversa"]) {
      expect(CSS, `falta el token ${token}`).toContain(`${token}:`);
    }
    // Y NO son los hexadecimales clinicos: si coincidieran, la separacion seria solo de nombre.
    const hexDelta = [...CSS.matchAll(/--delta-(?:favorable|adversa):\s*(#[0-9a-f]{6})/g)].map((m) => m[1]);
    const hexClinico = [...CSS.matchAll(/--clinical-(?:optimal|critical):\s*(#[0-9a-f]{6})/g)].map((m) => m[1]);
    expect(hexDelta.length, "no se leyeron los tonos direccionales").toBe(2);
    for (const h of hexDelta) {
      expect(hexClinico, `${h} es un hex de la capa clínica: la separación sería solo de nombre`).not.toContain(h);
    }
  });

  it("y SOLO se pinta en la tabla sin columna de veredicto", () => {
    // Es la regla de su archivo: su Diagnostico pinta las deltas en gris porque alli la direccion la lleva
    // el badge. Verificado en su captura (0.8, -10.0, -0.108, todas grises).
    const limpio = sinComentarios(SECCION);
    const i = limpio.indexOf("colorDeDelta(deltaNum");
    expect(i, "no se encontró el uso del color en la celda").toBeGreaterThan(-1);
    const celda = limpio.slice(Math.max(0, i - 300), i);
    expect(celda, "el color no está condicionado a que NO haya columna de Diagnóstico").toContain(
      "showDiagnosis ?",
    );
  });
});
