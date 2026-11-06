// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE MIDE HOY LA ALIMENTACION DEL ICEC, Y SI LA D1 DE ATLAS YA TIENE LOS 15 GRUPOS
// SOLO LECTURA  ·  2026-11-05
//
// POR QUE: el documento de cambios de v16 (seccion 7) afirma que en Atlas el componente Alimentacion del
// ICEC "es 30 para todos los pacientes", porque la formula congelada lee `d1_9` y `d1_10` (SIN el sufijo
// `_i`), claves que la encuesta no guarda. Y su seccion 6 afirma que la encuesta del QR tiene 14 grupos en
// D1 y que hay que separar carnes rojas de embutidos y migrar.
//
// LAS DOS AFIRMACIONES SE MIDEN AQUI, contra la base, antes de planear nada:
//
//   A · ¿Existe en el instrumento alguna pregunta con field_key d1_9, d1_10 o d1_16 (sin `_i`)?
//       Si la respuesta es NINGUNA, entonces la rama de Alimentacion cae siempre al mismo caso y el
//       componente vale 30 para TODA evaluacion. Se mide la CAUSA, no el efecto: el componente no se
//       persiste en columna propia, asi que contar "cuantas valen 30" no se puede; contar cuantas pueden
//       valer otra cosa, si.
//
//   B · ¿Cuantas respuestas de encuesta traen el grupo 15 (`d1_15_i`, carnes rojas) separado del 12
//       (`d1_12_i`, embutidos)? Esto dice si la migracion que pide la seccion 6 hace falta o ya esta.
//
//   C · El ICEC que SI esta sellado (indicator_values), para ver su dispersion real.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO: conteos, codigos de indicador y cifras agregadas.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/QUE_MIDE_LA_ALIMENTACION_DEL_ICEC_2026-11-05.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "que mide la alimentacion del ICEC (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

/** Trae TODAS las filas paginando con un orden estable (sin order by, cada pagina es arbitraria). */
async function todas(tabla, columnas, afinar = (q) => q, orden = "id") {
  const filas = [];
  const paso = 1000;
  for (let desde = 0; ; desde += paso) {
    let q = db.from(tabla).select(columnas).order(orden, { ascending: true }).range(desde, desde + paso - 1);
    q = afinar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if ((data ?? []).length < paso) return filas;
  }
}

async function cuantas(tabla, afinar = (q) => q) {
  let q = db.from(tabla).select("*", { count: "exact", head: true });
  q = afinar(q);
  const { count, error } = await q;
  if (error) throw new Error(`${tabla}: ${error.message}`);
  return count ?? 0;
}

// ── A · LAS CLAVES QUE LEE LA FORMULA CONGELADA ──────────────────────────────────────────────────
console.log("\n── A · ¿EXISTE EN EL INSTRUMENTO d1_9 / d1_10 / d1_16 (sin sufijo _i)? ──");
const preguntas = await todas("survey_questions", "id, field_key, survey_version_id", (q) =>
  q.not("field_key", "is", null),
);
const sinSufijo = preguntas.filter((p) => ["d1_9", "d1_10", "d1_16"].includes(p.field_key));
console.log(`  preguntas con field_key en el instrumento: ${preguntas.length}`);
console.log(`  con field_key d1_9 / d1_10 / d1_16: ${sinSufijo.length}`);
if (sinSufijo.length === 0) {
  console.log("  → NINGUNA. La rama de Alimentacion del ICEC cae siempre al mismo caso: 30 para TODA");
  console.log("    evaluacion, sin excepcion posible. Lo de v16 seccion 7 queda CONFIRMADO por la causa.");
} else {
  console.log("  → OJO: existen. Habria que medir el efecto evaluacion por evaluacion.");
}

// ── B · LOS 15 GRUPOS DE D1 ──────────────────────────────────────────────────────────────────────
console.log("\n── B · LOS GRUPOS DE D1 EN EL INSTRUMENTO ──");
const porVersion = new Map();
for (const p of preguntas) {
  const m = /^d1_(\d+)_i$/.exec(p.field_key ?? "");
  if (!m) continue;
  if (!porVersion.has(p.survey_version_id)) porVersion.set(p.survey_version_id, new Set());
  porVersion.get(p.survey_version_id).add(Number(m[1]));
}
const versiones = await todas("survey_versions", "id, version_number, published_at");
const nombreDeVersion = new Map(versiones.map((v) => [v.id, `v${v.version_number} (${String(v.published_at).slice(0, 10)})`]));
for (const [vid, grupos] of porVersion) {
  const ordenados = [...grupos].sort((a, b) => a - b);
  const tiene15 = grupos.has(15);
  console.log(
    `  version ${nombreDeVersion.get(vid) ?? vid.slice(0, 8)}: ${ordenados.length} grupos ` +
      `(${ordenados.join(",")}) · grupo 15 (carnes rojas): ${tiene15 ? "SI" : "NO"}`,
  );
}

console.log("\n  ¿Cuantas respuestas de encuesta traen contestado el grupo 15?");
const idsG15 = preguntas.filter((p) => p.field_key === "d1_15_i").map((p) => p.id);
const idsG12 = preguntas.filter((p) => p.field_key === "d1_12_i").map((p) => p.id);
const idsG1 = preguntas.filter((p) => p.field_key === "d1_1_i").map((p) => p.id);
const totalRespuestas = await cuantas("survey_responses");
const con15 = idsG15.length
  ? await cuantas("survey_answers", (q) => q.in("question_id", idsG15).not("answer_value", "is", null))
  : 0;
const con12 = idsG12.length
  ? await cuantas("survey_answers", (q) => q.in("question_id", idsG12).not("answer_value", "is", null))
  : 0;
const con1 = idsG1.length
  ? await cuantas("survey_answers", (q) => q.in("question_id", idsG1).not("answer_value", "is", null))
  : 0;
console.log(`  encuestas (survey_responses) en total: ${totalRespuestas}`);
console.log(`  con el grupo 1 contestado (respondio la matriz D1): ${con1}`);
console.log(`  con el grupo 12 contestado (embutidos): ${con12}`);
console.log(`  con el grupo 15 contestado (carnes rojas): ${con15}`);
if (con1 > 0 && con15 === con1) {
  console.log("  → TODAS las que contestaron D1 traen los dos grupos separados. La migracion que pide");
  console.log("    v16 seccion 6 NO hace falta en Atlas: el instrumento ya tiene los 15.");
} else if (con15 < con1) {
  console.log(`  → ${con1 - con15} encuestas contestaron D1 SIN el grupo 15: esas si son instrumento viejo.`);
}

// ── C · EL ICEC SELLADO ──────────────────────────────────────────────────────────────────────────
console.log("\n── C · EL ICEC QUE ESTA SELLADO EN indicator_values ──");
const defs = await todas("indicator_definitions", "id, code, name");
const defIcec = defs.filter((d) => /icec/i.test(d.code ?? "") || /epigen|conductual/i.test(d.name ?? ""));
console.log(`  definiciones de indicador: ${defs.length}`);
console.log(`  candidatas a ICEC: ${defIcec.map((d) => d.code).join(", ") || "ninguna"}`);
for (const d of defIcec) {
  const vals = await todas("indicator_values", "value, evaluation_id", (q) =>
    q.eq("indicator_definition_id", d.id).not("value", "is", null),
  );
  const nums = vals.map((v) => Number(v.value)).filter((n) => !isNaN(n));
  if (nums.length === 0) {
    console.log(`  ${d.code}: ningun valor no nulo`);
    continue;
  }
  nums.sort((a, b) => a - b);
  const pct = (p) => nums[Math.min(nums.length - 1, Math.floor((p / 100) * nums.length))];
  const distintos = new Set(nums.map((n) => Math.round(n * 100) / 100)).size;
  console.log(
    `  ${d.code}: n=${nums.length} · min ${nums[0].toFixed(1)} · p25 ${pct(25).toFixed(1)} · ` +
      `mediana ${pct(50).toFixed(1)} · p75 ${pct(75).toFixed(1)} · max ${nums[nums.length - 1].toFixed(1)} · ` +
      `valores distintos: ${distintos}`,
  );
}

console.log("\nFin. Nada se escribio.");
