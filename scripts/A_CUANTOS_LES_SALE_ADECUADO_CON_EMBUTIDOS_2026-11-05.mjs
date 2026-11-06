// ══════════════════════════════════════════════════════════════════════════════════════════════════
// A CUANTOS PACIENTES LES SALE "ADECUADO" EN VERDE CON EMBUTIDOS FRECUENTES  ·  SOLO LECTURA
// 2026-11-05
//
// POR QUE: la v16 de Gildardo nace de que una nutricionista reporto que la encuesta presenta como
// protectoras las carnes rojas y los embutidos. La causa 1 de su documento es **el promedio de los cuatro
// grupos de riesgo**: embutidos 5 a 6 dias con los otros tres en "nunca" da 0,75, por debajo del corte de
// 1, y la tarjeta sale "Adecuado".
//
// ESA CAUSA ESTA EN ATLAS, y no por porte infiel: la tarjeta de categoria de
// `survey-diagnosis-section.tsx` promedia [11, 12, 13, 14] y `catEstado` pinta `avg <= 1` como "Adecuado"
// en verde (#059669). Es el mismo promedio de su archivo, portado verbatim del 13 de agosto.
//
// LO QUE ESTO MIDE es a cuanta gente real le esta pasando hoy en la pantalla del profesional, que es lo
// que decide si conviene contenerlo ANTES de v15 o si entra con el resto. Se cuenta el caso exacto: la
// tarjeta dice "Adecuado" (promedio <= 1) **y** algun grupo de riesgo esta en 3 o 4 (5-6 dias o diario).
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO: conteos, y los 8 primeros caracteres de un id donde hace falta.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/A_CUANTOS_LES_SALE_ADECUADO_CON_EMBUTIDOS_2026-11-05.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { FREQ_OPC } from "../src/clinical-engine/frozen/engine.patron.js";
import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "a cuantos les sale Adecuado con embutidos (SOLO LECTURA)");

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

// El acoplamiento es por TEXTO y por POSICION, igual que en el reader del patron: el ordinal 0-4 sale del
// INDICE de la opcion en FREQ_OPC del frozen, no de una tabla escrita aqui.
const ordinalDe = (texto) => {
  const i = FREQ_OPC.indexOf(String(texto ?? "").trim());
  return i >= 0 ? i : null;
};

const RIESGO = [11, 12, 13, 14];
const preguntas = await todas("survey_questions", "id, field_key", (q) => q.not("field_key", "is", null));
const campoDe = new Map(preguntas.map((p) => [p.id, p.field_key]));
const idsDeRiesgo = new Set(preguntas.filter((p) => RIESGO.some((n) => p.field_key === `d1_${n}_i`)).map((p) => p.id));

const respuestas = await todas("survey_answers", "response_id, question_id, answer_value", (q) =>
  q.in("question_id", [...idsDeRiesgo]),
);
const responses = await todas("survey_responses", "id, evaluation_id");
const evalDeResponse = new Map(responses.map((r) => [r.id, r.evaluation_id]));

const porResponse = new Map();
for (const a of respuestas) {
  const campo = campoDe.get(a.question_id);
  const ord = ordinalDe(a.answer_value);
  if (!campo || ord == null) continue;
  if (!porResponse.has(a.response_id)) porResponse.set(a.response_id, {});
  porResponse.get(a.response_id)[campo] = ord;
}

// La MISMA aritmetica de la tarjeta: promedio de los grupos respondidos, y `avg <= 1` = "Adecuado".
let conLosCuatro = 0;
let adecuadoConAlguidoAlto = 0;
let elevadoDeVerdad = 0;
const ejemplos = [];
const repartoEmbutidos = new Map();
const porGrupoQueLoCausa = new Map();

for (const [respId, campos] of porResponse) {
  const vals = RIESGO.map((n) => campos[`d1_${n}_i`]).filter((v) => v != null);
  if (vals.length < 4) continue;
  conLosCuatro += 1;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const etiqueta = avg <= 1 ? "Adecuado" : avg <= 2 ? "Moderado" : "Elevado";
  const algunoAlto = vals.some((v) => v >= 3);
  const emb = campos["d1_12_i"];
  repartoEmbutidos.set(emb, (repartoEmbutidos.get(emb) ?? 0) + 1);
  if (algunoAlto && etiqueta === "Adecuado") {
    adecuadoConAlguidoAlto += 1;
    const ev = evalDeResponse.get(respId);
    porGrupoQueLoCausa.set(RIESGO[vals.indexOf(Math.max(...vals))], (porGrupoQueLoCausa.get(RIESGO[vals.indexOf(Math.max(...vals))]) ?? 0) + 1);
    if (ejemplos.length < 8) {
      ejemplos.push(
        `    consulta ${(ev ?? respId).slice(0, 8)} · frecuencias [${vals.join(",")}] · promedio ${avg.toFixed(2)} → "${etiqueta}" en verde`,
      );
    }
  }
  if (algunoAlto) elevadoDeVerdad += 1;
}

console.log(`\nEncuestas con los CUATRO grupos de riesgo respondidos: ${conLosCuatro}`);
console.log(`  con algun grupo de riesgo en 5-6 dias o diario: ${elevadoDeVerdad}`);
console.log(`  y de esas, la tarjeta dice "Adecuado" EN VERDE: ${adecuadoConAlguidoAlto}`);
console.log("\n  cual grupo lo causa (el de mayor frecuencia en cada caso):");
for (const [n, c] of [...porGrupoQueLoCausa].sort((a, b) => b[1] - a[1])) console.log(`    grupo ${n}: ${c}`);
if (ejemplos.length) {
  console.log(`\n  ejemplos (sin id completo):`);
  for (const e of ejemplos) console.log(e);
}

console.log(`\n── LA FRECUENCIA DE EMBUTIDOS (grupo 12) EN LA COHORTE ──`);
for (const ord of [0, 1, 2, 3, 4]) {
  const n = repartoEmbutidos.get(ord) ?? 0;
  console.log(`  ${FREQ_OPC[ord]}: ${n}`);
}
const tresOMas = (repartoEmbutidos.get(2) ?? 0) + (repartoEmbutidos.get(3) ?? 0) + (repartoEmbutidos.get(4) ?? 0);
console.log(`  → 3 dias por semana o mas (el corte de exceso de v16): ${tresOMas}`);

console.log("\nFin. Nada se escribio.");
