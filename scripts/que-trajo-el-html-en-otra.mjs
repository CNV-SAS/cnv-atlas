// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ¿EL HTML TRAJO EL TEXTO LIBRE DE "OTRA"?  ·  SOLO LECTURA, SIN IMPRIMIR PII
//
// ═══ LA PREGUNTA QUE CIERRA EL CASO (Santiago, 2026-10-07) ═══
//
// Santiago insiste, y tiene razon en insistir: dice que en el HTML el paciente SI marco "Otra" Y SI escribio
// el texto, y que eso es lo que no llego a Atlas. Yo dije que vinieron peladas del origen.
//
// UNO DE LOS DOS SE EQUIVOCA, y el JSON exportado lo dice sin opinar. Este script lo lee y cuenta.
//
// ═══ QUE MIRA, Y POR QUE TAMBIEN LAS DEMAS PREGUNTAS ═══
//
// Santiago añadio una duda que vale mas que el caso: si el EXPORTADOR siquiera saca esos campos. Si no los
// saca, el problema no es del importador y afecta a TODAS las preguntas con "Otra", no solo a la 35.
//
// Asi que se recorre el JSON entero buscando dos cosas por cada pregunta con opcion "Otra":
//   · cuantas consultas marcaron una flexion de "Otra" en esa pregunta;
//   · y cuantas de esas traen su campo `<clave>_otro` con texto.
//
// ═══ PII: ESTE ARCHIVO TIENE DATOS REALES DE PACIENTES ═══
//
// Esta en `.gitignore` (regla `atlas-exportacion-*.json`, verificado antes de abrirlo) y NO esta versionado.
// Este script NO IMPRIME NI UN DATO DE PACIENTE: solo conteos por clave de pregunta. Ni nombres, ni
// documentos, ni el contenido de los campos libres.
//
// COMO SE CORRE:
//   node scripts/que-trajo-el-html-en-otra.mjs docs/distribucion/atlas-exportacion-2026-10-02.json
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";

const ruta = process.argv[2] ?? "docs/distribucion/atlas-exportacion-2026-10-02.json";
const ES_OTRA = /^otr[oa]s?$/i;

const crudo = JSON.parse(readFileSync(ruta, "utf8"));

// ── LA FORMA DEL ARCHIVO, LEIDA DEL EXPORTADOR Y DEL IMPORTADOR, no adivinada ─────────────────────
//
// `pacientes[].historia` es el valor CRUDO de localStorage bajo la clave "atlas:{documento}": una CADENA con
// un arreglo JSON de consultas dentro. Mi primera version busco `crudo.consultas` y arreglos sueltos, no
// encontro nada, y el script dijo "0 consultas" con un veredicto tranquilizador al lado. Eso es peor que
// fallar: un barrido que no encuentra nada y concluye que todo esta bien.
//
// Se parsea IGUAL que `importar-archivo.ts`: JSON.parse de la historia, quedarse con los objetos, y filtrar
// por `fechaConsulta` (lo que el importador considera una consulta y no, por ejemplo, el informe guardado).
const consultas = [];
let pacientesIlegibles = 0;
for (const p of crudo.pacientes ?? []) {
  try {
    const h = JSON.parse(p.historia ?? "[]");
    if (!Array.isArray(h)) continue;
    for (const c of h) {
      if (c && typeof c === "object" && typeof c.fechaConsulta === "string" && c.fechaConsulta) consultas.push(c);
    }
  } catch {
    pacientesIlegibles++;
  }
}

console.log(`Pacientes en el archivo: ${(crudo.pacientes ?? []).length}`);
console.log(`Consultas (con fechaConsulta, que es lo que el importador toma): ${consultas.length}`);
if (pacientesIlegibles > 0) console.log(`Pacientes con historia ilegible: ${pacientesIlegibles}`);
if (consultas.length === 0) {
  console.log("\nSIN CONSULTAS NO HAY NADA QUE CONCLUIR. Revisa la forma del archivo antes de creerle a esto.");
  process.exit(1);
}
console.log("");

// ── (1) TODAS LAS CLAVES QUE TIENEN UN CAMPO `_otro` EN EL EXPORT ─────────────────────────────────
//
// Esto contesta la duda de Santiago sobre el exportador: si una pregunta NUNCA trae su `_otro`, el exportador
// no lo saca y el texto no esta en el archivo (y entonces no hay nada que el importador pudiera haber hecho).
const clavesConCampoOtro = new Set();
for (const c of consultas) {
  for (const k of Object.keys(c ?? {})) if (k.endsWith("_otro")) clavesConCampoOtro.add(k);
}

// ── (2) POR PREGUNTA: cuantas marcaron "Otra" y cuantas traen texto ──────────────────────────────
const porClave = new Map(); // clave -> { marcaron, conTexto, sinTexto }

const marcoOtra = (v) => {
  if (typeof v === "string") return ES_OTRA.test(v.trim());
  if (Array.isArray(v)) return v.some((x) => typeof x === "string" && ES_OTRA.test(x.trim()));
  return false;
};

for (const c of consultas) {
  if (!c || typeof c !== "object") continue;
  for (const [clave, valor] of Object.entries(c)) {
    if (clave.endsWith("_otro")) continue;
    if (!marcoOtra(valor)) continue;
    const texto = c[`${clave}_otro`];
    const tiene = typeof texto === "string" && texto.trim() !== "";
    const e = porClave.get(clave) ?? { marcaron: 0, conTexto: 0, sinTexto: 0 };
    e.marcaron++;
    if (tiene) e.conTexto++;
    else e.sinTexto++;
    porClave.set(clave, e);
  }
}

console.log("══ POR PREGUNTA: quien marco 'Otra' y si trajo texto ══\n");
console.log("clave      marcaron  con texto  SIN texto   ¿el export trae su campo _otro?");
for (const [clave, e] of [...porClave].sort()) {
  const campo = clavesConCampoOtro.has(`${clave}_otro`) ? "si" : "NO";
  console.log(
    `${clave.padEnd(10)} ${String(e.marcaron).padStart(8)} ${String(e.conTexto).padStart(10)} ${String(e.sinTexto).padStart(10)}   ${campo}`,
  );
}

// ── (3) EL VEREDICTO ──────────────────────────────────────────────────────────────────────────────
const sinTextoTotal = [...porClave.values()].reduce((s, e) => s + e.sinTexto, 0);
const conTextoTotal = [...porClave.values()].reduce((s, e) => s + e.conTexto, 0);
const preguntasSinCampo = [...porClave.keys()].filter((k) => !clavesConCampoOtro.has(`${k}_otro`));

console.log("\n══ VEREDICTO ══\n");
console.log(`Marcaron "Otra" con texto: ${conTextoTotal}   ·   sin texto: ${sinTextoTotal}`);

if (preguntasSinCampo.length > 0) {
  console.log(
    `\nEL EXPORTADOR NO SACA EL CAMPO LIBRE DE: ${preguntasSinCampo.join(", ")}\n` +
      "En esas preguntas el texto NO ESTA en el archivo, asi que el importador no pudo traerlo. El arreglo es\n" +
      "del exportador (el HTML), no de Atlas.",
  );
} else {
  console.log(
    "\nEL EXPORTADOR SACA EL CAMPO LIBRE DE TODAS las preguntas que lo tienen marcado. Asi que lo que hay en\n" +
      "el archivo es lo que el paciente dejo: las que salen SIN texto se marcaron sin especificar.",
  );
}

// ── (4) LAS CONSULTAS SIN NINGUNA RESPUESTA DE ENCUESTA ──────────────────────────────────────────
//
// La otra pregunta abierta: el import dejo 15 evaluaciones VACIAS (0 respuestas). ¿Venian asi del HTML?
// Se cuenta cuantas consultas del archivo no traen NINGUNA clave de pregunta con valor.
const esClaveDePregunta = (k) => /^d\d+_/.test(k) || /^d\d+_qx$/.test(k);
let vacias = 0;
for (const c of consultas) {
  if (!c || typeof c !== "object") continue;
  const conValor = Object.entries(c).filter(
    ([k, v]) => esClaveDePregunta(k) && v != null && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
  if (conValor.length === 0) vacias++;
}
console.log(`\n══ CONSULTAS SIN NINGUNA RESPUESTA DE ENCUESTA EN EL ARCHIVO: ${vacias} ══`);
console.log(
  vacias > 0
    ? "Venian vacias del HTML. Las 15 evaluaciones vacias de Atlas no son una perdida de la importacion."
    : "Ninguna venia vacia: si Atlas tiene evaluaciones sin respuestas, se perdieron al importar.",
);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// (5) RECUPERAR EL TEXTO DE UNOS PACIENTES CONCRETOS
//
// EL NUMERO QUE CIERRA EL CASO: en d4_35 el HTML trae 56 marcadas y 54 CON TEXTO. Atlas tiene 5 peladas en
// esa pregunta. O sea que 3 PERDIERON SU TEXTO, y la consulta del audit habia encontrado exactamente 3
// evaluaciones editadas mientras el defecto del widget estaba vivo.
//
// ASI QUE EL TEXTO NO SE PERDIO PARA SIEMPRE: esta en este archivo. Pasandole los documentos de esos
// pacientes, esto imprime lo que el HTML traia, para que la integrante lo vuelva a escribir.
//
// COMO SE CORRE (los documentos salen de la consulta `DOCUMENTOS_DE_LAS_TRES_2026-10-07.sql`):
//   node scripts/que-trajo-el-html-en-otra.mjs <archivo.json> 1234567 7654321
//
// IMPRIME EL TEXTO LIBRE, que es dato clinico, SOLO de los documentos que se le pidan. Es lo que se quiere
// recuperar, asi que tiene que verse; lo que no hace es volcar los 160 pacientes.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const documentosPedidos = process.argv.slice(3).map((d) => d.trim()).filter(Boolean);
if (documentosPedidos.length > 0) {
  console.log(`\n══ EL TEXTO QUE TRAIA EL HTML, para ${documentosPedidos.length} documento(s) ══\n`);
  for (const p of crudo.pacientes ?? []) {
    const doc = String(p.documento ?? "").trim();
    if (!documentosPedidos.includes(doc)) continue;
    let historia = [];
    try {
      const h = JSON.parse(p.historia ?? "[]");
      if (Array.isArray(h)) historia = h;
    } catch {
      console.log(`${doc}: historia ilegible`);
      continue;
    }
    for (const c of historia) {
      if (!c || typeof c !== "object" || !c.fechaConsulta) continue;
      // SOLO LAS CLAVES CON TEXTO LIBRE DE "OTRA": no se imprime el resto de la consulta.
      const libres = Object.entries(c)
        .filter(([k, v]) => k.endsWith("_otro") && typeof v === "string" && v.trim() !== "")
        .map(([k, v]) => `    ${k.replace(/_otro$/, "")} = "${String(v).trim()}"`);
      console.log(`${doc} · consulta ${String(c.fechaConsulta).slice(0, 10)}`);
      console.log(libres.length ? libres.join("\n") : "    (sin texto libre en ninguna pregunta)");
    }
  }
}
