// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE TAN DISTINTO ES "ALGUN TRATAMIENTO" DE "EL MAS RECIENTE"  ·  SOLO LECTURA  ·  2026-11-06
//
// POR QUE EXISTE: el lector de la tarjeta del informe preguntaba por una columna que no existe
// (`protocol_snapshot`) y ademas SIN `order by`, o sea "existe algun tratamiento con protocolo". La
// condicion que de verdad usa `getPlanPaciente` es otra: "el tratamiento MAS RECIENTE de la consulta
// tiene protocolo sellado". Antes de escribir el arreglo hay que saber si las dos difieren en la base
// real, porque de eso depende si el `order by` es una formalidad o una divergencia viva.
//
// Y mide el PESO del jsonb, para decidir si la comprobacion puede traerlo o tiene que esquivarlo.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO: conteos y tamaños.
//
// COMO SE CORRE:
//   node --env-file=.env.production.local scripts/EL_PLAN_DE_LA_TARJETA_2026-11-06.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "el plan de la tarjeta del informe (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

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

// Los tratamientos con su consulta y su protocolo. Se trae el jsonb a proposito: es lo que se quiere pesar.
const trats = await todas("treatments", "id, created_at, status, protocol_suggested, protocol_approved, diagnoses!inner(evaluation_id)");
console.log(`\nTratamientos: ${trats.length}`);

const porEval = new Map();
for (const t of trats) {
  const ev = t.diagnoses?.evaluation_id;
  if (!ev) continue;
  if (!porEval.has(ev)) porEval.set(ev, []);
  porEval.get(ev).push(t);
}
console.log(`Consultas con al menos un tratamiento: ${porEval.size}`);

let variosTrat = 0;
let algunoSi = 0;
let masRecienteSi = 0;
let difieren = 0;
let sinProtocoloNinguno = 0;
const pesos = [];

for (const [, lista] of porEval) {
  if (lista.length > 1) variosTrat += 1;
  lista.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); // mas reciente primero
  const alguno = lista.some((t) => t.protocol_suggested != null);
  const reciente = lista[0].protocol_suggested != null;
  if (alguno) algunoSi += 1;
  else sinProtocoloNinguno += 1;
  if (reciente) masRecienteSi += 1;
  if (alguno !== reciente) difieren += 1;
  for (const t of lista) {
    if (t.protocol_suggested != null) pesos.push(JSON.stringify(t.protocol_suggested).length);
  }
}

pesos.sort((a, b) => a - b);
const pct = (p) => (pesos.length ? pesos[Math.min(pesos.length - 1, Math.floor((p / 100) * pesos.length))] : 0);

console.log(`\n── LAS DOS CONDICIONES ──`);
console.log(`  consultas con MAS DE UN tratamiento: ${variosTrat}`);
console.log(`  "existe ALGUN tratamiento con protocolo sellado": ${algunoSi}`);
console.log(`  "el tratamiento MAS RECIENTE tiene protocolo sellado": ${masRecienteSi}   <- esta es la de getPlanPaciente`);
console.log(`  CONSULTAS DONDE LAS DOS DIFIEREN: ${difieren}`);
console.log(`  consultas con tratamiento y SIN protocolo en ninguno: ${sinProtocoloNinguno}`);

console.log(`\n── EL PESO DEL JSONB protocol_suggested ──`);
console.log(`  sellados: ${pesos.length}`);
if (pesos.length) {
  console.log(`  minimo ${pesos[0]} B · mediana ${pct(50)} B · p90 ${pct(90)} B · maximo ${pesos[pesos.length - 1]} B`);
}

console.log("\nFin. Nada se escribio.");
