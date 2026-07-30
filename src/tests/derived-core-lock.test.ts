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
const ASSIGN_LINE = "Object.assign(module.exports, { efrProf, cSMM, cMMEM, cASMI, cFFW, cEISG });";

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
});
