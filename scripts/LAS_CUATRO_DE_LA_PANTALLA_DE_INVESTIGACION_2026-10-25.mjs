// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CUATRO QUE NO CIERRAN EN LA PANTALLA DE INVESTIGACION  ·  SOLO LECTURA  ·  2026-10-25
//
// Gildardo mira /obbia y las sumas cuadran (316 + 197 = 513, 216 + 2 = 218, meses = 316), pero cuatro
// cosas no cierran. Tres son preguntas sobre los datos y se contestan aqui; la cuarta es un texto de
// pantalla y se arregla en el codigo.
//
//   a) "IMPORTADAS DEL HTML: 8", y de Angela se importaron muchas mas. La hipotesis de Gildardo: el
//      consentimiento del HTML no tenia casilla de investigacion (punto 12 del v11), asi que esos
//      pacientes caen en los 197 de fuera. Se confirma contando las importadas DENTRO y FUERA.
//
//   b) 197 de 513 es el 38 %, pero 53 de 402 PACIENTES no autorizaron es el 13 %. LAS DOS CIFRAS SON DE
//      COSAS DISTINTAS (consultas contra pacientes) y por eso no se parecen: un paciente sin autorizacion
//      que tuvo tres consultas pone tres en el 197. El desglose lo parte en las cuatro razones.
//
//   c) Las versiones salen "1.0.0" y "anibise-1.4.0". Se busca de donde sale cada forma, cuantas tiene
//      cada una y si son la misma familia.
//
// NO IMPRIME DATOS DE PACIENTE: conteos, y los ids de las dos evaluaciones de la version rara.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/LAS_CUATRO_DE_LA_PANTALLA_DE_INVESTIGACION_2026-10-25.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";
import { todasLasFilas } from "./lib/todas-las-filas.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "desglosa las cuatro de /obbia (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// ── EL UNIVERSO: las dos vistas no se pueden leer por PostgREST (la 0224 las revoca a proposito), asi
//    que se reconstruye su condicion aqui. Es una SEGUNDA definicion y por eso se verifica: los totales
//    que salgan tienen que coincidir con los que la pantalla muestra (513 / 316 / 197). Si no coinciden,
//    el desglose de abajo no describe lo que Gildardo esta mirando.
const pacientes = await todasLasFilas(db, "patients", "id, cuenta_como_de_prueba, deleted_at", (q) =>
  q.is("deleted_at", null),
);
const reales = new Set(pacientes.filter((p) => !p.cuenta_como_de_prueba).map((p) => p.id));

const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, status, import_batch_id, superseded_at, retirada_at, created_at",
);
const NO_ES_CONSULTA = new Set(["awaiting_survey", "abandoned"]);
const vigentes = evaluaciones.filter(
  (e) =>
    reales.has(e.patient_id) &&
    !e.superseded_at &&
    !e.retirada_at &&
    !NO_ES_CONSULTA.has(e.status),
);

const consentimientos = await todasLasFilas(
  db,
  "patient_consents",
  "patient_id, consent_type, revoked_at, signed_at",
);
const porPaciente = new Map();
for (const c of consentimientos) {
  const ya = porPaciente.get(c.patient_id) ?? [];
  ya.push(c);
  porPaciente.set(c.patient_id, ya);
}

/**
 * La razon por la que las consultas de este paciente NO entran a investigacion, o null si entran.
 *
 * EL ORDEN IMPORTA: se pregunta primero por lo que NO EXISTE (nunca firmo en Atlas) y despues por lo
 * que existe y dice no. Al reves, un paciente sin ningun consentimiento se contaria como "dijo que no",
 * y eso le atribuiria una decision que nunca tomo.
 */
function porQueFuera(patientId) {
  const suyos = porPaciente.get(patientId) ?? [];
  const investigacion = suyos.filter((c) => c.consent_type === "investigacion");
  const vigente = investigacion.find((c) => c.revoked_at === null);
  if (vigente) return null;
  if (investigacion.length > 0) return "revoco la autorizacion";
  if (suyos.length === 0) return "sin NINGUN consentimiento en Atlas (importado del HTML)";
  return "firmo en Atlas y NO marco la casilla de investigacion";
}

console.log("0 · LOS TOTALES, PARA SABER SI ESTO DESCRIBE LA MISMA PANTALLA");
const dentro = vigentes.filter((e) => porQueFuera(e.patient_id) === null);
const fuera = vigentes.filter((e) => porQueFuera(e.patient_id) !== null);
console.log(`  consultas vigentes (la pantalla dice 513): ${vigentes.length}`);
console.log(`  autorizadas        (la pantalla dice 316): ${dentro.length}`);
console.log(`  fuera              (la pantalla dice 197): ${fuera.length}`);
console.log(`  pacientes distintos autorizados:           ${new Set(dentro.map((e) => e.patient_id)).size}`);
// (el "216 + 2 = 218" de Gildardo es de las VERSIONES del motor, no de los pacientes: ver el bloque c.)

// ── LAS CUATRO RAZONES, CONTADAS SOBRE LOS CONSENTIMIENTOS Y NO SOBRE LAS CONSULTAS ────────────────
//
// Hace falta porque la 0224 escribio "53 NO la autorizaron y 4 la revocaron" el 24 de octubre, y el
// desglose de abajo da otras cifras. No es una contradiccion: ese 53 se midio sobre los pacientes con
// `servicio` VIGENTE, y el de abajo sobre los pacientes con al menos una CONSULTA vigente. Dos
// denominadores distintos dan dos cifras distintas, y sin decirlo parece que una de las dos esta mal.
const deInvestigacion = consentimientos.filter((c) => c.consent_type === "investigacion");
const conServicio = new Set(
  consentimientos.filter((c) => c.consent_type === "servicio" && c.revoked_at === null).map((c) => c.patient_id),
);
const autorizaronAlgunaVez = new Set(deInvestigacion.map((c) => c.patient_id));
const revocaron = new Set(
  deInvestigacion.filter((c) => c.revoked_at !== null).map((c) => c.patient_id),
);
const vigenteDeInvestigacion = new Set(
  deInvestigacion.filter((c) => c.revoked_at === null).map((c) => c.patient_id),
);
console.log("\n  SOBRE LOS CONSENTIMIENTOS (el denominador de la 0224):");
console.log(`  pacientes con 'servicio' vigente:                    ${conServicio.size}`);
console.log(`  de esos, con 'investigacion' vigente:                ${[...conServicio].filter((id) => vigenteDeInvestigacion.has(id)).length}`);
console.log(`  de esos, que NO la dieron (firmaron sin la casilla):  ${[...conServicio].filter((id) => !autorizaronAlgunaVez.has(id)).length}`);
console.log(`  de esos, que la REVOCARON:                            ${[...conServicio].filter((id) => revocaron.has(id) && !vigenteDeInvestigacion.has(id)).length}`);
console.log(`  filas de 'investigacion' revocadas, en total:         ${deInvestigacion.filter((c) => c.revoked_at !== null).length}`);

// ── a) LAS IMPORTADAS ───────────────────────────────────────────────────────────────────────────────
console.log("\na · LAS IMPORTADAS DEL HTML");
const importadas = vigentes.filter((e) => e.import_batch_id !== null);
const importadasDentro = importadas.filter((e) => porQueFuera(e.patient_id) === null);
console.log(`  consultas importadas vigentes, en total:  ${importadas.length}`);
console.log(`  de esas, AUTORIZADAS (la pantalla dice 8): ${importadasDentro.length}`);
console.log(`  de esas, FUERA:                           ${importadas.length - importadasDentro.length}`);
const porRazonImportadas = new Map();
for (const e of importadas) {
  const r = porQueFuera(e.patient_id);
  if (r) porRazonImportadas.set(r, (porRazonImportadas.get(r) ?? 0) + 1);
}
for (const [r, n] of [...porRazonImportadas].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${n}  ${r}`);
}
console.log(`  pacientes distintos importados: ${new Set(importadas.map((e) => e.patient_id)).size}`);

// ── b) EL DESGLOSE DE LOS 197 ───────────────────────────────────────────────────────────────────────
console.log("\nb · POR QUE QUEDAN FUERA LAS QUE QUEDAN FUERA");
const porRazon = new Map();
const pacientesPorRazon = new Map();
for (const e of fuera) {
  const r = porQueFuera(e.patient_id);
  porRazon.set(r, (porRazon.get(r) ?? 0) + 1);
  const s = pacientesPorRazon.get(r) ?? new Set();
  s.add(e.patient_id);
  pacientesPorRazon.set(r, s);
}
for (const [r, n] of [...porRazon].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)} consultas  ·  ${pacientesPorRazon.get(r).size} pacientes  ·  ${r}`);
}
console.log("\n  Y LA OTRA MITAD DE LA PREGUNTA, en PACIENTES y no en consultas:");
const pacientesConVigente = new Set(
  vigentes.map((e) => e.patient_id).filter((id) => porQueFuera(id) === null),
);
const pacientesVigentes = new Set(vigentes.map((e) => e.patient_id));
console.log(`  pacientes con al menos una consulta vigente: ${pacientesVigentes.size}`);
console.log(`  de esos, autorizados: ${pacientesConVigente.size}`);
console.log(`  de esos, fuera:       ${pacientesVigentes.size - pacientesConVigente.size}`);
const razonPorPaciente = new Map();
for (const id of pacientesVigentes) {
  const r = porQueFuera(id);
  if (r) razonPorPaciente.set(r, (razonPorPaciente.get(r) ?? 0) + 1);
}
for (const [r, n] of [...razonPorPaciente].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${n}  ${r}`);
}

// ── c) LAS VERSIONES DEL MOTOR ──────────────────────────────────────────────────────────────────────
console.log("\nc · LAS VERSIONES DEL MOTOR EN LA COHORTE AUTORIZADA");
const idsDentro = new Set(dentro.map((e) => e.id));
const dx = await todasLasFilas(
  db,
  "diagnoses",
  "id, evaluation_id, engine_version, rules_version, model_version_id, confirmed_at, created_at",
);
const dxDentro = dx.filter((d) => idsDentro.has(d.evaluation_id));
const porVersion = new Map();
for (const d of dxDentro) {
  const v = d.engine_version ?? "(null)";
  const ya = porVersion.get(v) ?? [];
  ya.push(d);
  porVersion.set(v, ya);
}
for (const [v, filas] of [...porVersion].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${v}: ${filas.length} diagnostico(s)`);
  if (filas.length <= 5) {
    for (const d of filas) {
      console.log(
        `      diagnostico ${d.id.slice(0, 8)} · reglas ${d.rules_version ?? "-"} · ` +
          `creado ${String(d.created_at).slice(0, 10)} · ${d.confirmed_at ? "firmado" : "sin firmar"}`,
      );
    }
  }
}
console.log("\n  Y EN TODA LA BASE, sin filtrar por autorizacion:");
const porVersionTodo = new Map();
for (const d of dx) {
  const v = d.engine_version ?? "(null)";
  porVersionTodo.set(v, (porVersionTodo.get(v) ?? 0) + 1);
}
for (const [v, n] of [...porVersionTodo].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v}: ${n}`);
}
console.log("\n  Y LAS VERSIONES DE REGLAS, que es la otra mitad de la constelacion:");
const porReglas = new Map();
for (const d of dx) {
  const k = `${d.engine_version ?? "(null)"}  |  reglas ${d.rules_version ?? "(null)"}`;
  porReglas.set(k, (porReglas.get(k) ?? 0) + 1);
}
for (const [k, n] of [...porReglas].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${n}`);
}

console.log("\nListo. Nada se escribio.\n");
