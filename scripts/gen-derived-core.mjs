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

// Los nombres a exponer (INVENTARIO punto 6b). TODOS existen en engine.core.js y ninguno esta en su
// `module.exports`. Se agregan sin editar el frozen, que es justo para lo que existe este mecanismo.
//
// Los cinco del final entraron con la v17 §2.4 (2026-11-12): son el bloque MCCB de su archivo (los
// cortes de su Tabla 10.2, los dos clasificadores que gobiernan el sector, los nueve sectores de su
// Tabla 11.2 con su fenotipo y su gravedad, y la funcion que resuelve el sector). El motor de Atlas
// los necesita para numerar la Diana, asi que tienen que salir del frozen y no copiarse a TypeScript:
// una copia de nueve sectores en otro archivo es la forma de que un dia digan otra cosa.
export const ADDED_EXPORTS = ["efrProf", "cSMM", "cMMEM", "cASMI", "cFFW", "cEISG",
  "MCCB_CORTES", "cFFMI_MCCB", "cFMI_MCCB", "MCCB_SECTORES", "sectorMCCB",
  // Entraron con el paso 5 (v17 §5 y §6): la normalizacion del sexo, que `engine.indices` necesita para
  // calcular el IEHH y el ISCM-BIS con las z de su tabla; los percentiles del ISCM-BIS por sexo; y el
  // texto de referencia que las pantallas muestran al lado del valor, ahora que el indice no se gradua.
  "sexoBIS", "ISCM_REF", "iscmRefTxt"];

const HEADER = `/*
 * engine.core.derived.js — ARCHIVO GENERADO. NO editar a mano. NO es ciencia editada.
 *
 * Es una copia BYTE A BYTE de engine.core.js (la ciencia congelada de Gildardo, regla 16) mas UNA
 * sola linea final: un Object.assign aditivo que expone los nombres que YA existen en el original
 * pero no estaban en su module.exports (los 6 clasificadores de composicion y, desde la v17, las 5
 * piezas del bloque MCCB: cortes, clasificadores, sectores). Ese es el
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
