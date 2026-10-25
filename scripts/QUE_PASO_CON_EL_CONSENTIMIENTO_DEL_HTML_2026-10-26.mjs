// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS PACIENTES DEL HTML Y SU CONSENTIMIENTO  ·  SOLO LECTURA  ·  2026-10-26
//
// ═══ LAS TRES PREGUNTAS DE GILDARDO ═══
//
//   1. ¿El consentimiento del HTML quedo guardado en algun lado (texto, fecha, firma tecleada)?
//   2. Si no esta: esos pacientes tienen consultas en Atlas sin consentimiento registrado. ¿El gate ya
//      les pide firmar en la proxima consulta?
//   3. ¿Ese consentimiento cubria investigacion?
//
// ═══ LO QUE ESTE SCRIPT MIDE Y LO QUE NO ═══
//
// MIDE los hechos de la base: cuantos pacientes importados tienen fila en `patient_external_consents`,
// con que version de texto, con firma o sin ella, y cuantos tienen ADEMAS autorizaciones de Atlas.
//
// NO DECIDE si ese texto cubria investigacion: eso no esta en Atlas. Lo unico que Atlas guarda del texto
// es su VERSION y su HASH; el texto vive en el HTML de Gildardo. Lo que si se puede afirmar es si la
// importacion creo o no autorizaciones de investigacion, que es la pregunta operativa.
//
// NO IMPRIME DATOS DE PACIENTE: conteos, versiones de texto y fechas agregadas por mes.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/QUE_PASO_CON_EL_CONSENTIMIENTO_DEL_HTML_2026-10-26.mjs
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
anunciarBase(url, "mira el consentimiento de los pacientes importados del HTML (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// ── EL UNIVERSO: los pacientes con al menos una consulta IMPORTADA ──────────────────────────────────
const pacientes = await todasLasFilas(db, "patients", "id, cuenta_como_de_prueba, deleted_at", (q) =>
  q.is("deleted_at", null),
);
const reales = new Set(pacientes.filter((p) => !p.cuenta_como_de_prueba).map((p) => p.id));

const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, status, import_batch_id, superseded_at, retirada_at",
);
const NO_ES_CONSULTA = new Set(["awaiting_survey", "abandoned"]);
const vigentes = evaluaciones.filter(
  (e) =>
    reales.has(e.patient_id) && !e.superseded_at && !e.retirada_at && !NO_ES_CONSULTA.has(e.status),
);
const importadas = vigentes.filter((e) => e.import_batch_id !== null);
const pacientesImportados = new Set(importadas.map((e) => e.patient_id));

console.log("0 · EL UNIVERSO");
console.log(`  consultas importadas vigentes: ${importadas.length}`);
console.log(`  pacientes con alguna importada: ${pacientesImportados.size}`);

// ── 1 · ¿QUEDO GUARDADO EL CONSENTIMIENTO DEL HTML? ─────────────────────────────────────────────────
const externos = await todasLasFilas(
  db,
  "patient_external_consents",
  "patient_id, origin, text_version, typed_name, recorded_date, source_consultation_date, signature_method, document_hash",
);
console.log("\n1 · EL CONSENTIMIENTO DEL HTML, EN `patient_external_consents`");
console.log(`  filas en total: ${externos.length}`);
const pacientesConExterno = new Set(externos.map((c) => c.patient_id));
console.log(`  pacientes distintos con consentimiento del HTML guardado: ${pacientesConExterno.size}`);
const importadosConExterno = [...pacientesImportados].filter((id) => pacientesConExterno.has(id));
console.log(`  de los ${pacientesImportados.size} importados, con el suyo guardado: ${importadosConExterno.length}`);
console.log(`  de los ${pacientesImportados.size} importados, SIN nada guardado: ${pacientesImportados.size - importadosConExterno.length}`);

const porVersion = new Map();
const porMetodo = new Map();
let conFirma = 0;
for (const c of externos) {
  porVersion.set(c.text_version, (porVersion.get(c.text_version) ?? 0) + 1);
  porMetodo.set(c.signature_method, (porMetodo.get(c.signature_method) ?? 0) + 1);
  if (c.typed_name != null && String(c.typed_name).trim() !== "") conFirma++;
}
console.log(`\n  CON NOMBRE TECLEADO (la firma del HTML): ${conFirma} de ${externos.length}`);
console.log("  por version del texto:");
for (const [v, n] of [...porVersion].sort((a, b) => b[1] - a[1])) console.log(`    ${n}  ${v}`);
console.log("  por metodo de firma:");
for (const [m, n] of [...porMetodo].sort((a, b) => b[1] - a[1])) console.log(`    ${n}  ${m}`);
const hashes = new Set(externos.map((c) => c.document_hash));
console.log(`  hashes distintos del documento: ${hashes.size} (uno por version del texto, si todo cuadra)`);
const fechas = [...new Set(externos.map((c) => String(c.source_consultation_date).slice(0, 7)))].sort();
console.log(`  meses de consulta cubiertos: ${fechas.join(", ")}`);

// ── 2 · ¿TIENEN AUTORIZACIONES DE ATLAS? ────────────────────────────────────────────────────────────
//
// Las NECESARIAS son las que el gate de la regla dura 15 exige para crear una evaluacion nueva.
const NECESARIAS = ["servicio", "datos_sensibles"];
const consents = await todasLasFilas(
  db,
  "patient_consents",
  "patient_id, consent_type, revoked_at, signed_at",
);
const porPaciente = new Map();
for (const c of consents) {
  const ya = porPaciente.get(c.patient_id) ?? [];
  ya.push(c);
  porPaciente.set(c.patient_id, ya);
}
const tieneNecesarias = (id) => {
  const suyos = (porPaciente.get(id) ?? []).filter((c) => c.revoked_at === null);
  return NECESARIAS.every((t) => suyos.some((c) => c.consent_type === t));
};

console.log("\n2 · LAS AUTORIZACIONES DE ATLAS (las que mira el gate de la regla dura 15)");
const conGate = [...pacientesImportados].filter((id) => tieneNecesarias(id));
console.log(`  importados que YA pueden abrir una consulta nueva: ${conGate.length}`);
console.log(`  importados que NO (el gate les pedira firmar): ${pacientesImportados.size - conGate.length}`);
const sinNingunConsent = [...pacientesImportados].filter((id) => (porPaciente.get(id) ?? []).length === 0);
console.log(`  importados SIN NINGUNA fila en patient_consents: ${sinNingunConsent.length}`);
const conAlgoPeroNoLasDos = [...pacientesImportados].filter(
  (id) => (porPaciente.get(id) ?? []).length > 0 && !tieneNecesarias(id),
);
console.log(`  importados con algo pero no las dos necesarias: ${conAlgoPeroNoLasDos.length}`);

// ── 3 · ¿LA IMPORTACION CREO AUTORIZACIONES DE INVESTIGACION? ───────────────────────────────────────
console.log("\n3 · INVESTIGACION");
const deInvestigacion = consents.filter((c) => c.consent_type === "investigacion");
const importadosConInvestigacion = [...pacientesImportados].filter((id) =>
  deInvestigacion.some((c) => c.patient_id === id && c.revoked_at === null),
);
console.log(`  filas de 'investigacion' en toda la base: ${deInvestigacion.length}`);
console.log(`  importados con 'investigacion' vigente: ${importadosConInvestigacion.length}`);
console.log(
  `  (los que la tienen firmaron el consentimiento de ATLAS despues de la importacion; la importacion\n` +
    `   no crea autorizaciones: solo archiva el texto del HTML en patient_external_consents)`,
);

// ── 4 · Y EL CRUCE QUE IMPORTA: CUANTOS DE LOS EXCLUIDOS SON ESTOS ──────────────────────────────────
const fueraPorNada = [...pacientesImportados].filter((id) => (porPaciente.get(id) ?? []).length === 0);
const consultasDeEsos = importadas.filter((e) => fueraPorNada.includes(e.patient_id)).length;
console.log("\n4 · LO QUE LA PANTALLA DE INVESTIGACION LLAMA 'sin ningun consentimiento en Atlas'");
console.log(`  pacientes: ${fueraPorNada.length}`);
console.log(`  sus consultas importadas vigentes: ${consultasDeEsos}`);
const deEsosConExterno = fueraPorNada.filter((id) => pacientesConExterno.has(id)).length;
console.log(`  de esos, CON su consentimiento del HTML archivado: ${deEsosConExterno}`);
console.log(`  de esos, sin nada en ninguna de las dos tablas: ${fueraPorNada.length - deEsosConExterno}`);

console.log("\nListo. Nada se escribio.\n");
