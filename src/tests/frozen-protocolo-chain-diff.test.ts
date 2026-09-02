import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF B: el harness Via C (`protocolo-chain-harness.mjs`) corre los bytes VERBATIM de la cadena de
// Gildardo, no nuestra transcripción de `protocolo-calorico.ts`. Es el ORÁCULO de GOLDEN 1, y este test
// cae si el harness deja de coincidir con la fuente: ahí el oráculo perdería su independencia y GOLDEN 1
// dejaría de probar nada.
//
// ═══ RE-ANCLADO EL 2026-09-02 ═══
//
// Verificaba contra `docs/entregas/gildardo-2026-07/ATLAS.html`, líneas 14124-14137, **de julio**. Dos
// problemas a la vez, y el segundo es el grave:
//
//   1. Estaba clavado a una entrega de hace dos meses y a un RANGO DE LÍNEAS, que es una posición: se
//      desincroniza en cuanto el autor inserta algo más arriba.
//   2. Y ese slice es el bloque de la **fórmula sintética del médico**, que en su archivo está DESACTIVADO
//      (`false && hasBis`, marcado "OLD MEDICO IIFE REMOVED"). Su cadena del plan nutricional **nunca
//      calculó el GEB**: lo lee de `motorTratNutri` desde al menos el 19 de agosto.
//
// O sea que el oráculo verificaba fielmente contra un bloque muerto, y su verde no vio que nuestra cadena
// calculaba el gasto con una fórmula que la suya ya no usaba.
//
// AHORA SE DERIVA: la entrega vigente sale del directorio y la cadena se localiza por su CONTENIDO, no por
// un número de línea. Es la misma corrección que ya se hizo en `motor-trat-nutri` y en `frozen-deriva`.

const DIR = "docs/entregas/Gildardo responses";
const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** La entrega vigente, DERIVADA del directorio: escrita a mano envejece en silencio. */
function entregaVigente(): string {
  const carpetas = readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^html actualizado /.test(d.name))
    .map((d) => {
      const m = /^html actualizado (\d+) (\p{L}+)$/u.exec(d.name);
      if (!m) throw new Error(`carpeta con nombre inesperado: ${d.name}`);
      return { name: d.name, orden: MESES[m[2].toLowerCase()] * 100 + Number(m[1]) };
    })
    .sort((a, b) => a.orden - b.orden);
  return carpetas[carpetas.length - 1].name;
}

/** La cadena del plan nutricional, localizada POR CONTENIDO y no por número de línea. */
function cadenaViva(): string {
  const html = readFileSync(`${DIR}/${entregaVigente()}/ATLAS_v8.html`, "utf8");
  const ini = html.indexOf("      var gebN = formulaEditPN.geb!==undefined");
  const fin = html.indexOf("var docKey", ini);
  if (ini < 0 || fin < 0) throw new Error("no se encuentra la cadena del plan nutricional en su archivo");
  return html.slice(ini, fin).replace(/\s+$/, "");
}

describe("DIFF B: el harness es verbatim de la cadena VIVA del plan nutricional", () => {
  const harness = readFileSync(
    "src/tests/fixtures/clinical-engine/protocolo-chain-harness.mjs",
    "utf8",
  );

  it("el harness contiene la cadena de la entrega VIGENTE, byte a byte", () => {
    expect(harness.includes(cadenaViva())).toBe(true);
  });

  it("y se derivó de la entrega vigente, no de una anterior", () => {
    // CONTROL: sin esto, el caso de arriba pasaría verde con un harness regenerado de cualquier entrega
    // cuya cadena no hubiera cambiado. La cabecera dice de cuál salió, y tiene que ser la de hoy.
    expect(harness).toContain(entregaVigente());
  });

  it("el envoltorio no agrega aritmética (fuera del slice no hay Math.round/max)", () => {
    const fuera = harness.replace(cadenaViva(), "");
    expect(fuera).not.toMatch(/Math\.(round|max)\(/);
  });

  it("y el gasto basal ENTRA al harness, no se calcula dentro", () => {
    // Es lo que distingue la cadena viva de la muerta: la suya recibe `_mtn.geb`; la del bloque
    // desactivado lo calculaba con el `500 + 22 × FFM`. Si esa fórmula reapareciera aquí, el oráculo
    // habría vuelto al bloque muerto.
    expect(harness).not.toContain("500+22*ffm");
    expect(harness).toContain("chainVerbatim(gebAuto,");
  });
});
