// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE PIDE LA CNV-S, MEDIDO ANTES DE PLANEARLA  ·  SOLO LECTURA  ·  2026-11-05
//
// POR QUE: la v15 de Gildardo pide la Encuesta CNV-S (version de seguimiento) desde la segunda consulta,
// con su Modulo S, su bloque de confirmacion y su S1 dinamico. Tres cosas de ese pedido no se pueden
// planear sin medirlas, porque deciden el tamaño del trabajo y si alguna pieza es alcanzable:
//
//   A · ¿A cuanta gente aplica? Pacientes con DOS o mas consultas: son la poblacion de la CNV-S. Si son
//       pocas, el orden del plan cambia.
//   B · El S1 ("[nutraceutico]: ¿con que frecuencia lo tomo?") es DINAMICO: sale de los nutraceuticos
//       indicados en la consulta anterior. Si las consultas anteriores no tienen nutraceuticos
//       registrados, el Modulo S nace con su primera pregunta vacia.
//   C · La fuerza prensil: el error 8 de su especificacion la quiere OBLIGATORIA en la inicial y en cada
//       control. Hoy en Atlas el campo dice "(opcional)". Lo que decide si eso se puede exigir es cuantas
//       consultas la traen hoy: si son pocas, exigirla sin salida registrada no produce dinamometrias,
//       produce cifras inventadas (hazard 6 de CLAUDE.md).
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO: conteos y, donde hace falta, los 8 primeros caracteres de un id.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/LO_QUE_PIDE_LA_CNVS_2026-11-05.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "lo que pide la CNV-S (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

async function todas(tabla, columnas, afinar = (q) => q, orden = "id") {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    let q = db.from(tabla).select(columnas).order(orden, { ascending: true }).range(desde, desde + 999);
    q = afinar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if ((data ?? []).length < 1000) return filas;
  }
}

const evals = await todas("evaluations", "id, patient_id, type, status, created_at, superseded_at, retirada_at");
const vivas = evals.filter((e) => !e.superseded_at && !e.retirada_at);

// ── A · LA POBLACION DE LA CNV-S ─────────────────────────────────────────────────────────────────
console.log("\n── A · ¿A CUANTA GENTE APLICA LA CNV-S? ──");
const porPaciente = new Map();
for (const e of vivas) porPaciente.set(e.patient_id, (porPaciente.get(e.patient_id) ?? 0) + 1);
const reparto = new Map();
for (const n of porPaciente.values()) reparto.set(n, (reparto.get(n) ?? 0) + 1);
console.log(`  pacientes con consulta viva: ${porPaciente.size}`);
for (const n of [...reparto.keys()].sort((a, b) => a - b)) {
  console.log(`    con ${n} consulta${n > 1 ? "s" : ""}: ${reparto.get(n)} pacientes`);
}
const conDos = [...porPaciente.values()].filter((n) => n >= 2).length;
console.log(`  → poblacion de la CNV-S (2 o mas consultas): ${conDos} pacientes`);
const seguimientos = vivas.filter((e) => e.type === "seguimiento");
console.log(`  consultas marcadas como seguimiento: ${seguimientos.length}`);

// ── B · EL S1 DINAMICO ───────────────────────────────────────────────────────────────────────────
console.log("\n── B · EL S1 DINAMICO: ¿HAY NUTRACEUTICOS INDICADOS DE DONDE SACARLO? ──");
// El tratamiento cuelga del DIAGNOSTICO, no de la consulta: hay que dar el salto por diagnoses.
const diagnosticos = await todas("diagnoses", "id, evaluation_id");
const evalDeDiagnostico = new Map(diagnosticos.map((d) => [d.id, d.evaluation_id]));
const tratamientos = await todas("treatments", "id, diagnosis_id, status");
const indicados = await todas("treatment_nutraceuticals", "id, treatment_id, nutraceutical_id");
const tratPorEval = new Map(tratamientos.map((t) => [t.id, evalDeDiagnostico.get(t.diagnosis_id)]));
const evalsConNutra = new Set();
for (const n of indicados) {
  const ev = tratPorEval.get(n.treatment_id);
  if (ev) evalsConNutra.add(ev);
}
console.log(`  tratamientos: ${tratamientos.length} · nutraceuticos indicados (filas): ${indicados.length}`);
console.log(`  consultas con al menos un nutraceutico indicado: ${evalsConNutra.size}`);
// Lo que de verdad importa: de los pacientes con 2 o mas consultas, a cuantos su consulta ANTERIOR le
// dejo nutraceuticos. Esos son los que tendrian S1 con contenido.
const porPacienteOrden = new Map();
for (const e of vivas) {
  if (!porPacienteOrden.has(e.patient_id)) porPacienteOrden.set(e.patient_id, []);
  porPacienteOrden.get(e.patient_id).push(e);
}
let conAnteriorConNutra = 0;
let conAnteriorSinNutra = 0;
for (const lista of porPacienteOrden.values()) {
  if (lista.length < 2) continue;
  lista.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const anterior = lista[lista.length - 2];
  if (evalsConNutra.has(anterior.id)) conAnteriorConNutra += 1;
  else conAnteriorSinNutra += 1;
}
console.log(`  pacientes cuya consulta ANTERIOR dejo nutraceuticos: ${conAnteriorConNutra}`);
console.log(`  pacientes cuya consulta anterior NO dejo ninguno (S1 nace vacio): ${conAnteriorSinNutra}`);

// ── C · LA FUERZA PRENSIL ────────────────────────────────────────────────────────────────────────
console.log("\n── C · LA FUERZA PRENSIL, HOY ──");
const intakes = await todas("evaluation_bis_intake", "evaluation_id, grip_strength_kg");
const conPrensil = intakes.filter((i) => i.grip_strength_kg != null && Number(i.grip_strength_kg) > 0);
console.log(`  consultas con condiciones de la toma guardadas: ${intakes.length}`);
console.log(`  de ellas, con fuerza prensil: ${conPrensil.length}`);
const idsVivas = new Set(vivas.map((e) => e.id));
const intakesVivos = intakes.filter((i) => idsVivas.has(i.evaluation_id));
const conPrensilVivas = intakesVivos.filter((i) => i.grip_strength_kg != null && Number(i.grip_strength_kg) > 0);
console.log(`  sobre consultas vivas: ${conPrensilVivas.length} de ${intakesVivos.length}`);
const pct = intakesVivos.length ? ((100 * conPrensilVivas.length) / intakesVivos.length).toFixed(1) : "—";
console.log(`  → la traen ${pct} % de las consultas que llegaron a condiciones de la toma`);

console.log("\nFin. Nada se escribio.");
