// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS LECTURAS DE ENVEJECIMIENTO, HOY  ·  SOLO LECTURA  ·  2026-11-06
//
// POR QUE EXISTE: es la primera mitad de la simulacion que pide el punto 3 de la ronda, y se puede medir
// sobre los snapshots YA SELLADOS, sin tocar el motor. Dice el TAMAÑO del recalculo antes de que nadie lo
// apruebe, y cuantos de los informes frenados quedarian entregables.
//
// ═══ EL ERROR QUE ESTE SCRIPT CORRIGE, Y CONVIENE QUE QUEDE ESCRITO ═══
//
// La primera version comparaba `indicators.iae` contra `ebBis.iae` y daba 0,0 de diferencia en LAS 411
// consultas. No era un acuerdo: son el MISMO numero. `analizarDesdeBiody` ya esta migrada a la v7, asi
// que `indices.IAE` y `ebBis.iae` salen los dos de `ebBisV7`. Una diferencia de 0,0 a una decima en 411
// casos no es un hallazgo, es la firma de comparar un valor consigo mismo.
//
// EL IAE DE LA v5 NO VIVE EN `indicators`: lo calcula `analizarDFI` por dentro (`ix.computeIAE`) y solo
// deja su rastro en el dominio 3 del DFI (su severidad, su lectura) y en las rutas activas. Asi que la
// comparacion correcta es la que ya hace el freno de la contradiccion (0229, 2026-11-03), y este script
// usa SU MISMO CRITERIO para no inventar un segundo: el DFI habla de aceleracion por severidad >= 2, por
// su lectura, o por tener la R4 activa.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO DE PACIENTE: conteos, y los 8 primeros caracteres de un id.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/QUE_MUEVE_EL_IAE_DE_LA_V7_2026-11-06.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "las dos lecturas de envejecimiento (SOLO LECTURA)");

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

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** La banda de su tabla 3: acelerado desde +5 (el corte que ya usa el texto que el paciente lee). */
const BANDA_IAE_ANIOS = 5;

// EL CLASIFICADOR DE ATLAS HOY (`engine.core.js` L140-149): el borde de abajo es ABIERTO (-5,0 queda
// Concordante) y el de arriba CERRADO (+5,0 queda Concordante).
const bandaDeAtlas = (v) => (v < -5 ? "Desacelerado" : v <= 5 ? "Concordante" : "Acelerado");
// EL DE SU v15 (su `cIAE`, linea 4487): los DOS bordes inclusivos hacia el extremo.
const bandaDeV15 = (v) => (v <= -5 ? "Desacelerado" : v < 5 ? "Concordante" : "Acelerado");

// ── LOS DATOS ────────────────────────────────────────────────────────────────────────────────────
const reportes = await todas(
  "reports",
  "id, evaluation_id, created_at, snapshot, type, sent_at",
  (q) => q.eq("type", "paciente"),
);
console.log(`\nInformes del paciente sellados: ${reportes.length}`);

// UNO POR EVALUACION, el mas reciente: reemitir crea otro informe de la misma consulta, y contar los dos
// duplicaria el tamaño del recalculo. Es la misma regla del lector de la serie y del propio freno.
const porEval = new Map();
for (const r of reportes) {
  const prev = porEval.get(r.evaluation_id);
  if (!prev || r.created_at > prev.created_at) porEval.set(r.evaluation_id, r);
}
console.log(`Evaluaciones distintas: ${porEval.size}`);

let conV7 = 0;
let soloV5 = 0;
let sinDfi = 0;
let coinciden = 0;
const contradicen = { dice_acelerado_y_no_lo_trata: 0, no_lo_dice_y_lo_trata: 0 };
const yaEnviados = { coinciden: 0, contradicen: 0 };
let bordeAtlas = 0;
let bordeV15 = 0;
const exactos5 = [];

for (const r of porEval.values()) {
  const snap = r.snapshot ?? {};
  const motor = String(snap.versions?.engine ?? "");
  const iae = snap.ebBis?.estado === "ok" ? num(snap.ebBis.iae) : null;

  // SOLO LAS SELLADAS CON LA v7: antes, las dos lecturas salian del MISMO calculo y no podian discrepar.
  if (!motor.startsWith("2.") || iae === null) {
    soloV5 += 1;
    continue;
  }
  const dominios = Array.isArray(snap.dfi?.domains) ? snap.dfi.domains : [];
  const d3 = dominios.find((d) => d?.id === "d3");
  if (!d3) {
    sinDfi += 1;
    continue;
  }
  conV7 += 1;

  const rutas = Array.isArray(snap.dfi?.rutas) ? snap.dfi.rutas.map(String) : [];
  // EL MISMO CRITERIO DEL FRENO (0229): el DFI habla de aceleracion por tres vias, y las tres cuentan.
  const segunElDfi =
    (num(d3.sev) ?? 0) >= 2 || /acelerad/i.test(String(d3.lectura ?? "")) || rutas.some((x) => x.startsWith("R4"))
      ? "acelerado"
      : "no acelerado";
  const segunLaEbBis = iae >= BANDA_IAE_ANIOS ? "acelerado" : "acorde o desacelerado";

  const enConflicto =
    (segunLaEbBis === "acelerado" && segunElDfi === "no acelerado") ||
    (segunLaEbBis === "acorde o desacelerado" && segunElDfi === "acelerado");

  if (!enConflicto) coinciden += 1;
  else if (segunLaEbBis === "acelerado") contradicen.dice_acelerado_y_no_lo_trata += 1;
  else contradicen.no_lo_dice_y_lo_trata += 1;

  if (r.sent_at) {
    if (enConflicto) yaEnviados.contradicen += 1;
    else yaEnviados.coinciden += 1;
  }

  if (bandaDeAtlas(iae) === "Acelerado") bordeAtlas += 1;
  if (bandaDeV15(iae) === "Acelerado") bordeV15 += 1;
  if (Math.abs(Math.abs(iae) - 5) < 0.05) exactos5.push({ id: r.evaluation_id, iae });
}

console.log(`\n── COBERTURA ──`);
console.log(`  selladas con la v7 y con dominio 3 (comparables): ${conV7}`);
console.log(`  selladas antes de la v7, o sin su cifra: ${soloV5}  ← estas las tiene que recalcular el motor`);
console.log(`  con la v7 y sin dominio 3 del DFI: ${sinDfi}`);

console.log(`\n── 1 · LAS DOS LECTURAS DE ENVEJECIMIENTO, HOY ──`);
const total = contradicen.dice_acelerado_y_no_lo_trata + contradicen.no_lo_dice_y_lo_trata;
console.log(`  coinciden: ${coinciden} de ${conV7}`);
console.log(`  SE CONTRADICEN: ${total}`);
console.log(`    dice ACELERADO arriba y el DFI no lo trata: ${contradicen.dice_acelerado_y_no_lo_trata}  ← el peor: se le nombra el problema y no se prescribe nada`);
console.log(`    dice "acorde" arriba y el DFI SI lo trata: ${contradicen.no_lo_dice_y_lo_trata}`);
console.log(`  (ya enviados: ${yaEnviados.coinciden} de los que coinciden, ${yaEnviados.contradicen} de los que se contradicen)`);
console.log(`\n  → ESOS ${total} SON LOS QUE EL FRENO DE LA CONTRADICCION (0229) NO DEJA ENTREGAR.`);
console.log(`     Se liberan cuando \`analizarDFI\` lea el IAE de la v7, que es lo que su v15 responde.`);

console.log(`\n── 2 · EL BORDE DE ±5, YA CON LA CIFRA DE LA v7 ──`);
console.log(`  acelerados con NUESTRO corte (iae > 5): ${bordeAtlas}`);
console.log(`  acelerados con el corte de v15 (iae >= 5): ${bordeV15}`);
console.log(`  exactamente en ±5,0: ${exactos5.length}`);
for (const e of exactos5) {
  console.log(`    consulta ${e.id.slice(0, 8)} · IAE ${e.iae} · Atlas: ${bandaDeAtlas(e.iae)} · v15: ${bandaDeV15(e.iae)}`);
}

console.log("\nFin. Nada se escribio.");
