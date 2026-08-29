import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { funcionDelHtml, HTML_VIGENTE } from "./fixtures/html-vigente";

// DIFF (regla dura 16, D-008/D-014): `frozen/atlas-tratamiento.js` son los tres motores de tratamiento
// por profesión (médico, ejercicio, psico), copiados VERBATIM de su archivo.
//
// RE-ANCLADO EL 2026-08-29, y por dos motivos que conviene separar:
//
//   1. LA ENTREGA. Estaba clavado a `gildardo-2026-07-30/ATLAS_v7.html` por ruta literal. Mientras él no
//      tocara ese trozo daba igual; el 29 lo tocó (reescribió el mensaje de la salvaguarda de TCA) y el
//      test habría seguido verde contra el archivo viejo. Ahora deriva la entrega.
//
//   2. EL RANGO. Estaba clavado a `L14176-14254`, que es una POSICIÓN, y una posición se desincroniza en
//      cuanto él escribe algo más arriba. Ahora extrae POR NOMBRE de función, que es el identificador.
//
// EL CAMBIO QUE LO DISPARÓ: CA-2 se retiró. Su archivo del 29 ya trae la corrección de la salvaguarda con
// SUS palabras ("el sistema AVISA y marca remisión; NO pausa el plan"), así que la divergencia autorizada
// dejó de hacer falta y el original se re-portó con su texto. Es la regla de VIGENCIA que el propio
// manifiesto exige al llegar un motor nuevo: o sigue haciendo falta, o él la absorbió y se retira.

const MOTORES = ["motorTratMedico", "motorTratEjercicio", "motorTratPsico"] as const;

describe(`DIFF: atlas-tratamiento.js verbatim de ${HTML_VIGENTE}`, () => {
  const frozen = readFileSync("src/clinical-engine/frozen/atlas-tratamiento.js", "utf8");

  for (const nombre of MOTORES) {
    it(`${nombre} coincide byte a byte con el de su archivo`, () => {
      expect(frozen.includes(funcionDelHtml(nombre))).toBe(true);
    });
  }

  it("los tres van en el MISMO ORDEN que en su archivo", () => {
    // El orden no es cosmético aquí: el rango contiguo original lo garantizaba y al extraer por nombre se
    // perdería sin querer. Tres funciones correctas en otro orden pasarían las tres pruebas de arriba.
    const posiciones = MOTORES.map((n) => frozen.indexOf(`function ${n}(`));
    expect(posiciones.every((p) => p >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it("antes del primer motor solo hay el encabezado de custodia (un comentario)", () => {
    const cabecera = frozen.slice(0, frozen.indexOf("function motorTratMedico(")).trimEnd();
    expect(cabecera).toMatch(/^\/\*\*[\s\S]*\*\/$/);
  });

  it("después del último solo la línea aditiva module.exports de los tres", () => {
    const ultimo = funcionDelHtml("motorTratPsico");
    const after = frozen.slice(frozen.indexOf(ultimo) + ultimo.length);
    expect(after.trim()).toBe(
      "module.exports = { motorTratMedico, motorTratEjercicio, motorTratPsico };",
    );
  });

  it("no hay nada NUESTRO entre los tres motores", () => {
    // El rango contiguo también garantizaba esto: que no se colara una línea propia en medio. Extrayendo
    // por nombre hay que pedirlo aparte, o el hueco entre dos funciones deja de estar vigilado.
    const ini = frozen.indexOf("function motorTratMedico(");
    const fin = frozen.indexOf(funcionDelHtml("motorTratPsico"));
    const enMedio = frozen.slice(ini, fin);
    const suyo = funcionDelHtml("motorTratMedico") + "\n" + funcionDelHtml("motorTratEjercicio");
    // Lo que sobra entre el primero y el ultimo son solo saltos de linea.
    expect(enMedio.replace(suyo.split("\n")[0], "").length).toBeGreaterThan(0);
    expect(enMedio.replace(/\s/g, "").length).toBe(suyo.replace(/\s/g, "").length);
  });
});
