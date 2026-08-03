// Generador determinista de los archivos *.authorized.js del frozen (mecanismo de modificaciones
// autorizadas). Lee el original intacto + el manifiesto y escribe el generado (el que corre).
// Uso: node scripts/gen-authorized.cjs
// Es un script de build en CommonJS (.cjs): require es la forma correcta aqui.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const {
  AUTHORIZED_MODIFICATIONS,
  buildAuthorizedFile,
  GENERATED_HEADER,
} = require("../src/clinical-engine/frozen/authorized-modifications.js");

const FROZEN = path.join(__dirname, "..", "src", "clinical-engine", "frozen");
// Un archivo generado por cada targetFile con modificaciones.
const targets = [...new Set(AUTHORIZED_MODIFICATIONS.map((m) => m.targetFile))];
for (const target of targets) {
  const original = fs.readFileSync(path.join(FROZEN, target), "utf8");
  const mods = AUTHORIZED_MODIFICATIONS.filter((m) => m.targetFile === target);
  const outName = target.replace(/\.js$/, ".authorized.js");
  const content = buildAuthorizedFile(original, mods, GENERATED_HEADER);
  fs.writeFileSync(path.join(FROZEN, outName), content);
  console.log(`generado ${outName} (${mods.length} modificacion(es): ${mods.map((m) => m.caId).join(", ")})`);
}
