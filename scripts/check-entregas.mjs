// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CONTROL: QUE NO ENTRE A docs/entregas/ NADA QUE NO SEA TEXTO REVISABLE
//
// ═══ POR QUE EXISTE (incidente del 2026-11-05) ═══
//
// `docs/entregas/` es la carpeta donde Santiago deja lo que hay que mirar: exports del Biody, capturas,
// PDF de informes, propuestas. Por construccion, **casi todo lo que cae ahi es un documento clinico**:
// lleva nombre, documento, fecha de medicion y cifras de una persona real.
//
// El .gitignore ya frena por EXTENSION (xlsx, xls, csv, pdf, docx, doc, png, jpg, ATLAS_*.html). Esa lista
// se escribio tres veces, cada vez despues de que llegara un formato nuevo: los Excel el 2026-10-02, los
// HTML el 2026-10-22, los PDF el 2026-11-05, este ultimo cuando ONCE PDF de paciente ya estaban en el
// historial publicado y hubo que reescribirlo. **Una lista de lo PROHIBIDO siempre va un formato por
// detras del siguiente archivo que llega**, y `git add -A` no pregunta.
//
// Asi que este control invierte la lista: dice lo que SI puede entrar y rechaza todo lo demas. El
// siguiente formato que nadie previo (un .heic, un .zip, un .webp) queda frenado por defecto, sin que
// nadie tenga que acordarse de anotarlo.
//
// ═══ QUE PERMITE, Y POR QUE ESOS ═══
//
//   .md    los documentos de cambios de Gildardo y los nuestros: texto, se leen en el diff.
//   .sql   los scripts de la nube que quedan como registro de lo que se corrio.
//   .js    el codigo que Gildardo entrega (su `ebBisV7.js`), que se porta y se cotejea byte a byte.
//   .json  sus casos de aceptacion (`casos.json`), que los goldens leen directo de su archivo.
//
// Los cuatro son texto, se revisan en el diff y ninguno ha traido nunca datos de paciente. Lo que queda
// fuera no es "sospechoso": es que **no se puede revisar de un vistazo**, y por eso no entra de paso.
//
// ═══ COMO SE CORRE ═══
//
//   node scripts/check-entregas.mjs            el gancho de pre-commit: mira lo que esta EN EL INDICE
//   node scripts/check-entregas.mjs --todos    barre todo lo versionado (para `pnpm verify` y auditoria)
//
// El gancho vive en `.githooks/pre-commit` y se activa una vez por clon con:
//   git config core.hooksPath .githooks
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";

const RAIZ = "docs/entregas/";
const PERMITIDAS = [".md", ".sql", ".js", ".json"];

// LO QUE YA ESTABA VERSIONADO ANTES DE ESTE CONTROL (2026-11-05). No se desversiona de paso: sacar los
// siete .docx y los doce HTML es una decision con su consecuencia (un clon nuevo se queda sin las
// especificaciones de Gildardo), ya anotada en el .gitignore para que Santiago la tome. Hasta entonces,
// modificar o mover uno de estos no debe trabar un commit. NINGUNO lleva datos de paciente: los .docx y
// los HTML se barrieron el 2026-11-05 (cero rotulos de identidad, cero numeros de 7 a 11 digitos) y el CSV
// es una cohorte seudonimizada (columnas n, sexo, edad y variables bioelectricas, sin identificadores).
const HEREDADOS = new Set([
  "docs/entregas/Decisiones_ANI-BIS-E_2026-07-29.docx",
  "docs/entregas/Gildardo responses/Nuevos cambios html/EB_BIS_v7_Especificacion_ATLAS_CNV_2026-10-24.docx",
  "docs/entregas/Gildardo responses/RESPUESTA_GILDARDO_2026-08-17.docx",
  "docs/entregas/Gildardo responses/RESPUESTA_GILDARDO_2026-08-18.docx",
  "docs/entregas/Gildardo responses/RESPUESTA_GILDARDO_2026-08-20.docx",
  "docs/entregas/Gildardo responses/RESPUESTA_GILDARDO_2026-08-20_version2.docx",
  "docs/entregas/Gildardo responses/cohorte_AEC_ACT_2026-08-18.csv",
  "docs/entregas/Gildardo responses/html actualizado 1 septiembre/ATLAS_v8.html",
  "docs/entregas/Gildardo responses/html actualizado 19 agosto/ATLAS_v8.html",
  "docs/entregas/Gildardo responses/html actualizado 2 septiembre/ATLAS_v8.html",
  "docs/entregas/Gildardo responses/html actualizado 21 septiembre/ATLAS_v9.html",
  "docs/entregas/Gildardo responses/html actualizado 28 agosto/ATLAS_v8.html",
  "docs/entregas/Gildardo responses/html actualizado 29 agosto/ATLAS_v8.html",
  "docs/entregas/Gildardo responses/html actualizado 3 septiembre/ATLAS_v8.html",
  "docs/entregas/Gildardo responses/html actualizado 4 septiembre/ATLAS_v8.html",
  "docs/entregas/gildardo-2026-07-30/ATLAS_v7.html",
  "docs/entregas/gildardo-2026-07/ATLAS.html",
  "docs/entregas/gildardo-2026-08-04/ATLAS_v8.html",
  "docs/entregas/gildardo-2026-08-04/CAMBIOS_ATLAS_v8_para_Santiago.docx",
  "docs/entregas/gildardo-2026-08-13/ATLAS_v8.html",
]);

const extensionDe = (ruta) => {
  const punto = ruta.lastIndexOf(".");
  const barra = ruta.lastIndexOf("/");
  return punto > barra ? ruta.slice(punto).toLowerCase() : "";
};

/**
 * LA DECISION, aparte del CLI para que un candado pueda EJECUTARLA y no solo leerla.
 * `true` = esa ruta puede entrar al repositorio.
 */
export function entraAEntregas(ruta) {
  if (!ruta.startsWith(RAIZ)) return true; // fuera de la carpeta, no es asunto de este control
  if (HEREDADOS.has(ruta)) return true;
  return PERMITIDAS.includes(extensionDe(ruta));
}

export const LO_PERMITIDO = PERMITIDAS;
export const LO_HEREDADO = HEREDADOS;

// Si lo importa un candado, el modulo solo exporta la decision y no corre nada.
if (process.argv[1] && /check-entregas\.mjs$/.test(process.argv[1])) correrElCli();

function correrElCli() {
const todos = process.argv.includes("--todos");

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// `--diff-filter=d` deja fuera los BORRADOS: sacar un archivo de la carpeta nunca se frena, solo meterlo.
const rutas = todos
  ? git(["ls-files", "--", RAIZ])
  : git(["diff", "--cached", "--name-only", "--diff-filter=d", "--", RAIZ]);

const rechazadas = rutas.filter((r) => !entraAEntregas(r));

if (rechazadas.length === 0) {
  if (todos) console.log(`check:entregas · ${rutas.length} archivos bajo ${RAIZ}, todos permitidos.`);
  process.exit(0);
}

console.error("");
console.error("  ══════════════════════════════════════════════════════════════════════════════════");
console.error(`  NO ENTRA A ${RAIZ} · ${rechazadas.length} archivo(s)`);
console.error("  ══════════════════════════════════════════════════════════════════════════════════");
console.error("");
for (const r of rechazadas) console.error(`    ${r}`);
console.error("");
console.error(`  Ahi solo entra texto revisable: ${PERMITIDAS.join(", ")}.`);
console.error("");
console.error("  Un archivo de esa carpeta es, por defecto, un documento clinico: lleva nombre,");
console.error("  documento y cifras de una persona. El 2026-11-05 hubo que reescribir el historial");
console.error("  publicado por once PDF de paciente que entraron asi, en un `git add -A`.");
console.error("");
console.error("  QUE HACER:");
console.error("    · si es un archivo para mirar y no para versionar (lo normal):");
console.error("        git restore --staged \"<ruta>\"      y se queda en tu disco, sin entrar al repo");
console.error("    · si de verdad NO lleva PII y tiene que versionarse: se excepciona POR NOMBRE en");
console.error("      HEREDADOS de scripts/check-entregas.mjs, con la razon escrita al lado.");
console.error("");
process.exit(1);
}
