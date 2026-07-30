// Generador determinista del archivo derivado del motor congelado (mecanismo de archivo derivado,
// ARCHITECTURE regla 16 / INVENTARIO 2026-07 punto 6). Produce engine.core.derived.js = encabezado
// de custodia + copia BYTE A BYTE de engine.core.js + una unica linea final aditiva que expone 6
// funciones que YA existen en el frozen pero no estaban en su module.exports. NO agrega logica ni
// cambia una formula: solo exporta lo que ya esta. El test DIFF C (derived-core-lock.test.ts)
// verifica que el archivo commiteado es exactamente lo que produce este generador.
//
// Correr: node scripts/gen-derived-core.mjs   (reescribe engine.core.derived.js desde engine.core.js)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ORIGINAL = join(ROOT, "src/clinical-engine/frozen/engine.core.js");
export const DERIVED = join(ROOT, "src/clinical-engine/frozen/engine.core.derived.js");

// Las 6 funciones a exponer (INVENTARIO punto 6b). Existen en engine.core.js, no en su module.exports.
export const ADDED_EXPORTS = ["efrProf", "cSMM", "cMMEM", "cASMI", "cFFW", "cEISG"];

const HEADER = `/*
 * engine.core.derived.js — ARCHIVO GENERADO. NO editar a mano. NO es ciencia editada.
 *
 * Es una copia BYTE A BYTE de engine.core.js (la ciencia congelada de Gildardo, regla 16) mas UNA
 * sola linea final: un Object.assign aditivo que expone 6 funciones que YA existen en el original
 * pero no estaban en su module.exports (efrProf, cSMM, cMMEM, cASMI, cFFW, cEISG). Ese es el
 * mecanismo de archivo derivado: exponer sin editar el frozen. NO agrega logica ni cambia una
 * formula; si algo mas cambia, se rompio el mecanismo.
 *
 * Este archivo es EL MOTOR VIVO: los imports del clinical-engine apuntan aqui, no al original.
 * Regenerar: node scripts/gen-derived-core.mjs. El test DIFF C (src/tests/derived-core-lock.test.ts)
 * verifica que este archivo es exactamente header + engine.core.js + la linea de export (byte a byte);
 * si engine.core.js cambia (swap de Gildardo), el candado truena y hay que regenerar.
 */
`;

const ASSIGN = `\nObject.assign(module.exports, { ${ADDED_EXPORTS.join(", ")} });\n`;

// Composicion determinista: header + original verbatim + linea de export. Una sola fuente de verdad,
// compartida con el test (que la importa para comparar contra el archivo commiteado).
export function buildDerived(originalContent) {
  return HEADER + originalContent + ASSIGN;
}

// main: solo cuando se ejecuta directo (no cuando el test lo importa).
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/gen-derived-core.mjs")) {
  const original = readFileSync(ORIGINAL, "utf8");
  writeFileSync(DERIVED, buildDerived(original));
  console.log(`engine.core.derived.js regenerado desde engine.core.js (+${ADDED_EXPORTS.length} exports aditivos).`);
}
