import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CAMBIOS_NUEVOS, htmlDeCambioNuevo } from "./fixtures/html-vigente";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DIFF-core: las piezas de `engine.core.js` que se portaron del ATLAS_v17.html  ·  2026-11-11
//
// ═══ POR QUE ESTE CANDADO EXISTE ═══
//
// `frozen-deriva-vigente` compara todo el frozen contra `HTML_VIGENTE`, que resuelve al **v16** (la
// convencion de carpeta nueva no entra ahi a proposito: sus HTML estan en `.gitignore` y un candado que
// dependiera de ellos fallaria en cualquier clon). Al portar la v17, `engine.core.js` deja de coincidir
// con el v16 **a proposito**, asi que sale de esa lista y entra aqui, con su propio ancla: es el mismo
// mecanismo que ya usan `engine.patron.js` y `engine.d1-clasificacion.js`.
//
// LO QUE SE COMPARA SON LAS CINCO PIEZAS DE LA v17 §3 y §4, una por una, contra SU archivo:
//
//   · `sexoBIS`      · el sexo se normaliza en un solo sitio (antes cada clasificador lo leia a su modo);
//   · `ICA_BIS_REF`  · su Tabla 7.3, los percentiles del ICA-BIS por sexo (n = 5.891);
//   · `calcPABU`     · k 0,78 / 0,46, y SIN SEXO devuelve 0 (la k = 0,9 retirada);
//   · `cIFC`         · los cortes de su Tabla 6.1 (H 4,1/6,7 · M 2,1/3,3) y "sin sexo no se clasifica";
//   · `cPABU`        · la lectura del ICA-BIS por percentiles, con direccion y grado.
//
// SE COMPARA IGNORANDO EL ESPACIO, como `frozen-deriva-vigente`: entre entregas el reformateo cambia el
// espaciado sin tocar la ciencia. Lo que atrapa es un token distinto: una constante, un corte, un color.
//
// Y FALLA RUIDOSO SIN EL ARCHIVO, que es lo correcto: su HTML vive solo en la maquina de Santiago.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const ENTREGA = "9 noviembre";

const sinEspacio = (t: string) => t.replace(/\s+/g, "");

/** El bloque `const <nombre> = ...`, contando llaves (o hasta el `;` de nivel 0 si no las tiene). */
function bloque(src: string, nombre: string, conLlaves: boolean): string {
  const i = src.indexOf(`const ${nombre}`);
  expect(i, `no aparece const ${nombre} en el archivo`).toBeGreaterThan(-1);
  if (conLlaves) {
    let prof = 0;
    for (let j = src.indexOf("{", i); j < src.length; j++) {
      if (src[j] === "{") prof++;
      else if (src[j] === "}" && --prof === 0) return src.slice(i, j + 1);
    }
  } else {
    let prof = 0;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if ("{[(".includes(c)) prof++;
      else if ("}])".includes(c)) prof--;
      else if (c === ";" && prof === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error(`const ${nombre} no cierra`);
}

const PIEZAS: { nombre: string; conLlaves: boolean; debeTener: string[] }[] = [
  { nombre: "sexoBIS", conLlaves: false, debeTener: ["Masculino", "Femenino", "null"] },
  { nombre: "ICA_BIS_REF", conLlaves: false, debeTener: ["-0.43", "-0.50", "0.86", "0.83"] },
  { nombre: "calcPABU", conLlaves: true, debeTener: ["0.78", "0.46", "sexoBIS"] },
  { nombre: "cIFC", conLlaves: true, debeTener: ["4.1", "6.7", "2.1", "3.3", "Sin sexo"] },
  { nombre: "cPABU", conLlaves: true, debeTener: ["ICA_BIS_REF", "Rango habitual", "deficit", "exceso"] },
];

describe(`engine.core.js: las piezas de la v17 salen de su ATLAS del ${ENTREGA}`, () => {
  it("la entrega existe en disco (sin ella, este candado no compara nada)", () => {
    expect(CAMBIOS_NUEVOS, `no esta la entrega ${ENTREGA}`).toContain(ENTREGA);
    expect(existsSync(htmlDeCambioNuevo(ENTREGA))).toBe(true);
  });

  const suyo = () => readFileSync(htmlDeCambioNuevo(ENTREGA), "utf8").replace(/\r\n/g, "\n");
  const nuestro = () => readFileSync("src/clinical-engine/frozen/engine.core.js", "utf8").replace(/\r\n/g, "\n");

  for (const pieza of PIEZAS) {
    it(`${pieza.nombre} es identico al de su archivo`, () => {
      const deEl = bloque(suyo(), pieza.nombre, pieza.conLlaves);
      const deNosotros = bloque(nuestro(), pieza.nombre, pieza.conLlaves);
      // Primero lo que la pieza TIENE QUE DECIR: si su archivo cambiara de forma, el mensaje de abajo
      // seria un muro de texto sin pista. Esto nombra la ciencia que se espera encontrar.
      for (const t of pieza.debeTener) {
        expect(deEl, `su ${pieza.nombre} ya no trae "${t}"`).toContain(t);
      }
      expect(
        sinEspacio(deNosotros),
        `${pieza.nombre} difiere de su ATLAS del ${ENTREGA}. O lo cambio y falta portarlo, o lo cambiamos ` +
          `nosotros sin registrarlo en authorized-modifications.js.\n  suyo:     ${deEl.slice(0, 300)}\n  nuestro:  ${deNosotros.slice(0, 300)}`,
      ).toBe(sinEspacio(deEl));
    });
  }

  it("y los cortes retirados no quedan en ninguna parte del modulo", () => {
    // Los del Excel (4,12 / 6,68 / 2,08 / 3,28), el corte global (3,5 / 6,0) y la k sin sexo (0,9). Su
    // §14 los pone como criterio de aceptacion: "ninguna pantalla ni funcion contiene los cortes 3,5/6,0
    // del IFC... ni la k = 0,9".
    const src = nuestro()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    for (const retirado of ["4.12", "6.68", "2.08", "3.28"]) {
      expect(src, `el corte retirado ${retirado} sigue en el modulo`).not.toContain(retirado);
    }
    // La k = 0,9 se busca en su forma exacta: `0.9` suelto aparece en otras constantes legitimas.
    expect(src, "la k = 0,9 sigue viva").not.toMatch(/\?\s*0\.78\s*:.*\?\s*0\.46\s*:\s*0\.9/);
  });
});
