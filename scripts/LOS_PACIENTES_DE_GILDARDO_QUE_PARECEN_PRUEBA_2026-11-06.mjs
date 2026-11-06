// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS PACIENTES DE GILDARDO QUE PARECEN DE PRUEBA  ·  SOLO LECTURA  ·  2026-11-06
//
// POR QUE EXISTE (Santiago): *"Los 63 de Gildardo: marca tu como 'probable prueba' los obvios (nombres
// tipo 'Hhh Ooo', documentos como '222'; con su criterio escrito). La lista corta que queda va a
// PENDIENTES para que el confirme: los reconoce en su lista de Atlas. El marcado se hace por el flujo con
// auditoria, cuando el responda."*
//
// ESTE SCRIPT NO MARCA NADA. Solo lee y clasifica. Marcar un paciente como de prueba lo saca de las
// cifras y de investigacion, y esa es una decision de Gildardo que ademas tiene su propio flujo con
// auditoria (la propuesta con motivo de la 0180). Un `update` desde aqui seria saltarse las dos cosas.
//
// ═══ DONDE SALE CADA COSA, QUE ES LA PARTE QUE IMPORTA ═══
//
// A LA CONSOLA van CONTEOS y, como mucho, los ocho primeros caracteres de un id. Ni un nombre, ni un
// documento: es la regla del proyecto para todo script de medicion.
//
// EL DETALLE (nombre y documento, que es lo que Gildardo necesita para reconocerlos) se escribe en
// `docs/entregas/dudas/`, que esta en .gitignore por archivo y por carpeta y NO se versiona nunca.
// Santiago le pasa ese archivo; al repositorio solo llegan los conteos y el criterio.
//
// ═══ EL CRITERIO, ESCRITO, Y POR QUE ES TAN ESTRECHO ═══
//
// Cada señal de abajo atrapa lo IMPOSIBLE o lo absurdo, nunca lo improbable, que es la misma regla que
// CLAUDE.md pide para un cinturon sin fuente. Un paciente real con un nombre raro NO puede salir aqui:
// lo que se marca es una cedula de tres cifras o un nombre que no es un nombre.
//
//   1 · DOCUMENTO DEMASIADO CORTO. Una cedula colombiana tiene 6 digitos o mas (las mas viejas, 6; las
//       nuevas, 10). Menos de 6 no es un documento de nadie.
//   2 · DOCUMENTO DE UNA SOLA CIFRA REPETIDA ("222", "11111111") o una secuencia ("123456", "1234567890").
//   3 · NOMBRE CON UNA SOLA LETRA REPETIDA en alguna palabra ("Hhh", "Ooo", "Aaa").
//   4 · NOMBRE QUE SE DICE A SI MISMO: contiene "prueba", "test", "demo", "ejemplo", "paciente x".
//   5 · NOMBRE CON UNA PALABRA DE UNA SOLA LETRA que no sea una inicial con punto.
//   6 · TECLAZO: tres consonantes seguidas que no forman ningun grupo del español ("qwe", "asd", "zxc").
//
// COMO SE CORRE:
//   node --env-file=.env.production.local scripts/LOS_PACIENTES_DE_GILDARDO_QUE_PARECEN_PRUEBA_2026-11-06.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "los pacientes de Gildardo que parecen de prueba (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// ── LAS SEÑALES ──────────────────────────────────────────────────────────────────────────────────
const SECUENCIAS = ["0123456789", "9876543210"];
const TECLAZOS = ["qwe", "asd", "zxc", "qaz", "wsx", "edc", "rfv", "tgb", "yhn", "ujm"];
const SE_DICE = ["prueba", "test", "demo", "ejemplo", "dummy", "fake", "aaa", "xxx", "zzz"];

function sinTildes(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function señalesDelDocumento(doc) {
  const d = String(doc ?? "").replace(/\D/g, "");
  const s = [];
  if (!d) return ["documento vacío"];
  if (d.length < 6) s.push(`documento de ${d.length} cifra(s)`);
  if (d.length >= 3 && new Set(d).size === 1) s.push("documento de una sola cifra repetida");
  if (d.length >= 4 && SECUENCIAS.some((seq) => seq.includes(d))) s.push("documento en secuencia");
  return s;
}

function señalesDelNombre(nombre) {
  const n = sinTildes(String(nombre ?? "").trim());
  const s = [];
  if (!n) return ["nombre vacío"];
  const palabras = n.split(/\s+/);
  if (palabras.some((p) => p.length >= 2 && new Set(p).size === 1)) s.push("palabra de una letra repetida");
  if (SE_DICE.some((w) => n.includes(w))) s.push("el nombre se dice de prueba");
  if (palabras.some((p) => p.length === 1 && !/[a-z]\./.test(p))) s.push("palabra de una sola letra");
  if (TECLAZOS.some((t) => n.includes(t))) s.push("teclazo en el nombre");
  return s;
}

// ── LOS DATOS ────────────────────────────────────────────────────────────────────────────────────
async function todas(tabla, columnas, afinar = (q) => q, orden = "id") {
  const filas = [];
  const paso = 500;
  for (let desde = 0; ; desde += paso) {
    let q = db.from(tabla).select(columnas).order(orden, { ascending: true }).range(desde, desde + paso - 1);
    q = afinar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if ((data ?? []).length < paso) return filas;
  }
}

// El profesional Gildardo, por su perfil. Se busca por nombre completo (un nombre de PROFESIONAL si se
// puede nombrar: la regla es sobre pacientes).
const perfiles = await todas("profiles", "id, full_name");
const gil = perfiles.filter((p) => sinTildes(p.full_name ?? "").includes("gildardo"));
if (gil.length !== 1) {
  console.error(`Se esperaba UN perfil de Gildardo y hay ${gil.length}. Se para antes que adivinar.`);
  process.exit(1);
}
console.log(`\nProfesional: ${gil[0].full_name}`);

const rel = await todas(
  "patient_professional_relationships",
  "patient_id, professional_id, status",
);
const profs = await todas("professional_profiles", "id, profile_id");
const suyos = new Set(
  rel
    .filter((r) => profs.some((p) => p.id === r.professional_id && p.profile_id === gil[0].id))
    .map((r) => r.patient_id),
);
console.log(`Pacientes relacionados con él: ${suyos.size}`);

const pacientes = await todas("patients", "id, document_number, is_test, cuenta_como_de_prueba, test_proposed_at");
const perfilesPac = await todas("patient_profiles", "patient_id, first_name, last_name", (q) => q, "patient_id");
const nombreDe = new Map(perfilesPac.map((p) => [p.patient_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));

const mios = pacientes.filter((p) => suyos.has(p.id));
const yaMarcados = mios.filter((p) => p.is_test || p.cuenta_como_de_prueba);
const sinMarcar = mios.filter((p) => !p.is_test && !p.cuenta_como_de_prueba);

console.log(`  ya marcados como de prueba: ${yaMarcados.length}`);
console.log(`  SIN marcar: ${sinMarcar.length}`);

const sospechosos = [];
for (const p of sinMarcar) {
  const señales = [...señalesDelDocumento(p.document_number), ...señalesDelNombre(nombreDe.get(p.id))];
  if (señales.length) sospechosos.push({ p, señales });
}

console.log(`\n── PROBABLE PRUEBA (por el criterio escrito en la cabecera) ──`);
console.log(`  señalados: ${sospechosos.length} de ${sinMarcar.length}`);
const porSeñal = new Map();
for (const s of sospechosos) for (const x of s.señales) porSeñal.set(x, (porSeñal.get(x) ?? 0) + 1);
for (const [señal, n] of [...porSeñal].sort((a, b) => b[1] - a[1])) console.log(`    ${señal}: ${n}`);
console.log(`\n  quedan SIN señal (parecen reales): ${sinMarcar.length - sospechosos.length}`);
console.log(`  ya tenían propuesta de prueba registrada: ${sinMarcar.filter((p) => p.test_proposed_at).length}`);

// ── EL DETALLE, FUERA DEL REPOSITORIO ────────────────────────────────────────────────────────────
mkdirSync("docs/entregas/dudas", { recursive: true });
const destino = `docs/entregas/dudas/PACIENTES_DE_GILDARDO_PROBABLE_PRUEBA_2026-11-06.md`;
const lineas = [
  "# Pacientes de Gildardo que parecen de prueba",
  "",
  "**Este archivo NO está en el repositorio** (`docs/entregas/dudas/**` está en .gitignore).",
  "Lleva nombres y documentos para que Gildardo los reconozca; al repositorio solo llegan los conteos.",
  "",
  "**Nadie ha marcado nada.** El marcado se hace por el flujo con auditoría cuando él confirme.",
  "",
  `Pacientes suyos sin marcar: ${sinMarcar.length}. Señalados por el criterio: ${sospechosos.length}.`,
  "",
  "| Paciente | Documento | Por qué se señala |",
  "|---|---|---|",
  ...sospechosos.map(
    (s) => `| ${nombreDe.get(s.p.id) ?? "(sin perfil)"} | ${s.p.document_number ?? ""} | ${s.señales.join("; ")} |`,
  ),
  "",
  "## Los que NO se señalan y siguen sin marcar",
  "",
  "Si alguno de estos es suyo de prueba, dígalo: el criterio de arriba solo atrapa lo imposible.",
  "",
  "| Paciente | Documento |",
  "|---|---|",
  ...sinMarcar
    .filter((p) => !sospechosos.some((s) => s.p.id === p.id))
    .map((p) => `| ${nombreDe.get(p.id) ?? "(sin perfil)"} | ${p.document_number ?? ""} |`),
  "",
];
writeFileSync(destino, lineas.join("\n"), "utf8");
console.log(`\nEl detalle con nombres quedó en ${destino} (fuera del repositorio).`);
console.log("\nFin. Nada se escribió en la base.");

// ── FORMA DE LOS DATOS, SIN IDENTIDADES ──────────────────────────────────────────────────────────
// Un criterio que no encuentra casi nada puede ser estrecho con razon, o estar ciego porque el dato no
// tiene la forma que supone. Esto lo distingue sin imprimir ni un nombre.
const porLargoDoc = new Map();
for (const p of sinMarcar) {
  const d = String(p.document_number ?? "").replace(/\D/g, "");
  porLargoDoc.set(d.length, (porLargoDoc.get(d.length) ?? 0) + 1);
}
console.log(`\n── FORMA DE LOS DOCUMENTOS (cuantos digitos) ──`);
for (const [largo, n] of [...porLargoDoc].sort((a, b) => a[0] - b[0])) console.log(`    ${largo} dígitos: ${n}`);
const conLetras = sinMarcar.filter((p) => /[a-zA-Z]/.test(String(p.document_number ?? ""))).length;
console.log(`    con alguna letra: ${conLetras}`);

const porPalabras = new Map();
let sinPerfil = 0;
for (const p of sinMarcar) {
  const n = nombreDe.get(p.id);
  if (!n) { sinPerfil += 1; continue; }
  const k = n.trim().split(/\s+/).length;
  porPalabras.set(k, (porPalabras.get(k) ?? 0) + 1);
}
console.log(`\n── FORMA DE LOS NOMBRES (cuantas palabras) ──`);
for (const [k, n] of [...porPalabras].sort((a, b) => a[0] - b[0])) console.log(`    ${k} palabra(s): ${n}`);
console.log(`    sin perfil (no tienen nombre registrado): ${sinPerfil}`);

// ── DE DONDE SALE LA CIFRA DE "63" ───────────────────────────────────────────────────────────────
// La ronda habla de "los 63 de Gildardo" y aqui salen 95 relacionados. No son la misma pregunta: una es
// a quien tiene ASIGNADO y otra a quien ha ATENDIDO. Se miden las dos para que la cifra deje de bailar.
const evs = await todas("evaluations", "id, patient_id, status, professional_id, created_at");
const profIds = new Set(profs.filter((p) => p.profile_id === gil[0].id).map((p) => p.id));
const suyas = evs.filter((e) => profIds.has(e.professional_id));
const pacientesAtendidos = new Set(suyas.map((e) => e.patient_id));
console.log(`\n── CONSULTAS SUYAS ──`);
console.log(`    consultas: ${suyas.length}`);
console.log(`    pacientes distintos en ellas: ${pacientesAtendidos.size}`);
const porEstado = new Map();
for (const e of suyas) porEstado.set(e.status, (porEstado.get(e.status) ?? 0) + 1);
for (const [est, n] of [...porEstado].sort((a, b) => b[1] - a[1])) console.log(`      ${est}: ${n}`);
const soloBorrador = new Set(
  suyas.filter((e) => e.status === "draft" || e.status === "borrador").map((e) => e.patient_id),
);
console.log(`    pacientes que SOLO aparecen en consultas en borrador: ${
  [...soloBorrador].filter((pid) => !suyas.some((e) => e.patient_id === pid && e.status !== "draft" && e.status !== "borrador")).length
}`);
