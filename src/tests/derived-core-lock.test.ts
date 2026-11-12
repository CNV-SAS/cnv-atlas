import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// DIFF C (T2b, mecanismo de archivo derivado, regla dura 16): engine.core.derived.js es el MOTOR
// VIVO (los 4 imports del clinical-engine apuntan ahi, no al original). Debe ser EXACTAMENTE
// engine.core.js (verbatim) mas el encabezado de custodia y una unica linea final aditiva
// (Object.assign) que expone 6 funciones que ya existen en el frozen. Se regenera con
// `node scripts/gen-derived-core.mjs`.
//
// QUE PROTEGE: (1) que el cuerpo del derivado sea el original byte a byte (si alguien edita la
// ciencia en el derivado, o si engine.core.js cambia sin regenerar el derivado, este test cae);
// (2) que lo unico agregado sea aditivo (header comentado + linea de export), NUNCA logica ni una
// formula.
// QUE NO PROTEGE (lo cubren otros): la fidelidad de engine.core.js a la fuente HTML (eso es del swap
// del frozen y sus golden, familia de DIFF A/B). DIFF C toma engine.core.js como dado y garantiza
// que el derivado no le agrega nada mas que los exports.

const ORIGINAL = "src/clinical-engine/frozen/engine.core.js";
const DERIVED = "src/clinical-engine/frozen/engine.core.derived.js";

// ═══ LA LINEA ESPERADA SE DERIVA DEL GENERADOR, NO SE ESCRIBE AQUI (2026-11-12) ═══
//
// Estaba escrita a mano. Al exponer las cinco piezas del bloque MCCB de la v17 el generador cambio y
// este candado cayo por la razon equivocada: no porque alguien hubiera editado la ciencia, sino porque
// la copia de aqui habia envejecido. Es la misma leccion del HTML vigente, un archivo mas abajo: una
// cadena escrita a mano junto a su original es una segunda fuente, y la segunda fuente miente primero.
//
// Lo que se compara ahora es LO MISMO pero sin copia: el archivo commiteado tiene que ser exactamente
// lo que `buildDerived` produce desde el original. Eso sigue atrapando las dos cosas que este candado
// existe para atrapar (una edicion de la ciencia en el derivado, y un `engine.core.js` que cambio sin
// regenerar), y ademas atrapa una tercera: una edicion del propio derivado que el generador no haria.
const { ADDED_EXPORTS, buildDerived } = await import("../../scripts/gen-derived-core.mjs");
const ASSIGN_LINE = `Object.assign(module.exports, { ${ADDED_EXPORTS.join(", ")} });`;

describe("DIFF C: engine.core.derived.js = engine.core.js + exports aditivos", () => {
  const original = readFileSync(ORIGINAL, "utf8");
  const derived = readFileSync(DERIVED, "utf8");

  it("contiene el original byte a byte (no se edito la ciencia congelada)", () => {
    expect(derived.includes(original)).toBe(true);
  });

  it("lo unico antes del original es el encabezado de custodia (un comentario)", () => {
    const before = derived.slice(0, derived.indexOf(original));
    expect(before.trimEnd()).toMatch(/^\/\*[\s\S]*\*\/$/);
  });

  it("lo unico despues del original es la linea aditiva Object.assign (sin logica)", () => {
    const after = derived.slice(derived.indexOf(original) + original.length);
    expect(after.trim()).toBe(ASSIGN_LINE);
  });

  it("el archivo commiteado es EXACTAMENTE lo que produce el generador", () => {
    // La comparacion de fondo: sin copias intermedias. Si falla, se regenera con
    // `node scripts/gen-derived-core.mjs` y se revisa el diff antes de commitear.
    expect(derived).toBe(buildDerived(original));
  });

  it("todo nombre expuesto EXISTE en el original (el assign es aditivo, no inventa)", () => {
    // Un nombre en ADDED_EXPORTS que no exista en el frozen rompe el modulo en runtime con un
    // ReferenceError, y lo haria al CARGAR el motor, o sea en la primera consulta que se abra.
    for (const nombre of ADDED_EXPORTS) {
      expect(
        new RegExp(`(const|function|var|let)\\s+${nombre}\\b`).test(original),
        `${nombre} no esta definido en engine.core.js`,
      ).toBe(true);
    }
  });
});
