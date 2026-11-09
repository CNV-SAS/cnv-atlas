// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SIMULACION DE LA v17 SOBRE LA COHORTE  ·  SOLO LECTURA  ·  2026-11-09
//
// COMO SE CORRE (Santiago):
//
//   contra la NUBE:   node --env-file=.env.production.local scripts/simular-v17.mjs
//   contra LOCAL:     node --env-file=.env.local scripts/simular-v17.mjs
//
// NO ESCRIBE NADA. Ni una fila, ni una columna: solo SELECT. Y no imprime ningun dato de paciente
// (ni nombre ni documento): solo cifras agregadas y, en los ejemplos, el prefijo del id de la consulta
// con sus indicadores.
//
// CONTRA LOCAL NO SIRVE PARA MEDIR LA COHORTE, y conviene saberlo antes de leer sus porcentajes: la
// base local tiene 391 informes con solo CUATRO tuplas distintas de (IFC, IRC, FFMI, FMI), o sea filas
// clonadas de demo. Lo que si valida en local es la ARITMETICA (ver el bloque de validacion).
//
// No escribe nada. Recalcula, desde el SNAPSHOT SELLADO de cada consulta vigente, que cambiaria con los
// criterios de CAMBIOS_ATLAS_v17_URGENTE_para_Santiago.docx.
//
// ═══ PRIMERO SE VALIDA CONTRA LO SELLADO ═══
//
// Antes de decir cuanto cambia, el script reproduce los valores de HOY (sector, dominios, riesgo) desde
// los mismos insumos y los compara con los que el snapshot ya trae. Si no coinciden, la aritmetica de la
// simulacion esta mal y la cifra de cambio no vale nada.
//
// ═══ LO QUE NO SE PUEDE SIMULAR, Y SE DICE ═══
//
// El IEHH y el ISCM-BIS de la v17 se recalculan con formulas y z POR SEXO distintas (docx §5). Eso
// necesita los datos crudos y el porte de `calcIEHH_ISCM`, que no es parte de una simulacion. Aqui solo
// se simula el cambio de ZONA del IEHH sobre el valor ACTUAL, que es una COTA INFERIOR del cambio real.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Copiado del motor congelado SOLO para la simulacion (no es codigo de produccion) ──
const EFR_RISK_ORDER = [[3,1],[3,2],[2,1],[2,2],[3,3],[2,3],[1,1],[1,2],[1,3]];
const rank = (a, b) => EFR_RISK_ORDER.findIndex(([x, y]) => x === a && y === b);
const D1 = { "Alto|Bajo":0,"Alto|Normal":1,"Normal|Bajo":1,"Alto|Alto":2,"Normal|Normal":2,"Bajo|Bajo":2,"Normal|Alto":2,"Bajo|Normal":3,"Bajo|Alto":3 };
const cap3 = (n) => Math.max(0, Math.min(3, n));
const W = [0.30, 0.25, 0.15, 0.15, 0.15];

// IFC: etiqueta y banda (k). HOY vs v17.
const ifcHoy = (v, s) => { const lo = s === "M" ? 4.12 : s === "F" ? 2.08 : 3.5, hi = s === "M" ? 6.68 : s === "F" ? 3.28 : 6.0;
  return v > hi ? ["Alto", 3] : v >= lo ? ["Normal", 2] : ["Bajo", 1]; };
const ifcV17 = (v, s) => { if (s !== "M" && s !== "F") return [null, null];
  const lo = s === "M" ? 4.1 : 2.1, hi = s === "M" ? 6.7 : 3.3;
  return v > hi ? ["Alto", 3] : v >= lo ? ["Normal", 2] : ["Bajo", 1]; };
// IRC: no cambia.
const ircBanda = (v, s) => { const lo = s === "F" ? 2.3 : 1.7, hi = s === "F" ? 2.8 : 2.1;
  return v < lo ? ["Bajo", 1] : v <= hi ? ["Normal", 2] : ["Alto", 3]; };
// FMI / FFMI: cortes del Excel (hoy) y del MCCB del libro (v17).
const fmiHoy = (v, s) => s === "M" ? (v < 3 ? 1 : v <= 6 ? 2 : 3) : (v < 5 ? 1 : v <= 9 ? 2 : 3);
const ffmiHoy = (v, s) => s === "M" ? (v < 17 ? 1 : v <= 25 ? 2 : 3) : (v < 15 ? 1 : v <= 23 ? 2 : 3);
const fmiV17 = (v, s) => s === "M" ? (v < 3.7 ? 1 : v <= 6.4 ? 2 : 3) : (v < 5.0 ? 1 : v <= 8.1 ? 2 : 3);
const ffmiV17 = (v, s) => s === "M" ? (v < 18.8 ? 1 : v <= 21.0 ? 2 : 3) : (v < 15.5 ? 1 : v <= 17.1 ? 2 : 3);
// Dominio 2 de la v17: gravedad base por sector (docx §8) + modificador de adiposidad central.
const SEV_POR_SECTOR = [0, 0, 0, 0, 1, 1, 3, 2, 3]; // indices 0..8 = S1..S9
const nivelDe = (score01, sev, veto) => {
  let n = score01 < 0.20 ? 0 : score01 < 0.45 ? 1 : score01 < 0.70 ? 2 : 3;
  if (sev.some((s) => s === 3) && n < 2) n = 2;
  if (veto && (sev[0] >= 2 || sev[1] >= 2)) n = 3;
  if (sev[0] === 3 && sev[1] === 3) n = 3;
  if (sev[3] === 3) n = Math.max(n, 2);
  return n;
};

// ── Los datos: una consulta vigente, su informe mas reciente ──
const { data: evs } = await sb
  .from("evaluations")
  .select("id, patient_id, created_at")
  .is("superseded_at", null)
  .is("retirada_at", null);
const { data: reps } = await sb
  .from("reports")
  .select("evaluation_id, created_at, snapshot")
  .eq("type", "paciente")
  .order("created_at", { ascending: false });
const vigentes = new Set(evs.map((e) => e.id));
const porEval = new Map();
for (const r of reps) if (vigentes.has(r.evaluation_id) && !porEval.has(r.evaluation_id)) porEval.set(r.evaluation_id, r.snapshot);

// Cintura e ICT por medicion -> por consulta
const { data: med } = await sb.from("bis_measurements").select("id, evaluation_id");
const evalPorMed = new Map(med.map((m) => [m.id, m.evaluation_id]));
const cintura = new Map(), ict = new Map();
for (const [variable, destino] of [["Waist Size cm", cintura], ["Ratio Cintura/Altura valor", ict]]) {
  const { data } = await sb.from("bis_raw_values").select("measurement_id, value").eq("variable_name", variable);
  for (const r of data ?? []) {
    const e = evalPorMed.get(r.measurement_id);
    const v = Number(r.value);
    if (e && Number.isFinite(v) && v > 0) destino.set(e, v);
  }
}

console.log(`consultas vigentes con informe: ${porEval.size} (de ${vigentes.size} vigentes)`);

const c = {
  usables: 0, validaSector: 0, validaSector_no: 0, validaDom1: 0, validaDom1_no: 0, validaScore: 0, validaScore_no: 0,
  ifcCambia: 0, ifcSinSexo: 0, sectorCambia: 0, anilloCambia: 0, estadoCambia: 0,
  dom1Cambia: 0, dom2Cambia: 0, dom3Cambia: 0, scoreCambia: 0, nivelCambia: 0,
  r1Entra: 0, r1Sale: 0, r2Entra: 0, r2Sale: 0, r4Sale: 0,
  icaSignoMal: 0, iehhFueraAbajo: 0, iaeEscalon: 0, sinCinturaNiIct: 0, conAdiposidad: 0,
};
const ejemplos = [];

for (const [evId, snap] of porEval) {
  const i = snap?.indicators ?? {};
  const s = snap?.sexo === "M" || snap?.sexo === "F" ? snap.sexo : null;
  const dom = snap?.dfi?.domains ?? [];
  const sevHoy = ["d1","d2","d3","d4","d5"].map((id) => dom.find((d) => d.id === id)?.sev ?? null);
  const ifc = Number(i.ifc), irc = Number(i.irc), ffmi = Number(i.FFMI), fmi = Number(i.FMI);
  const iehh = i.iehh == null ? null : Number(i.iehh);
  const iae = i.iae == null ? null : Number(i.iae);
  const pabu = i.pabu == null ? null : Number(i.pabu);
  if (![ifc, irc, ffmi, fmi].every(Number.isFinite) || sevHoy.some((v) => v == null)) continue;
  c.usables++;
  if (!s) c.ifcSinSexo++;

  // ── HOY, recalculado (validacion) ──
  const [ifcLH, ifcKH] = ifcHoy(ifc, s);
  const [ircL, ircK] = ircBanda(irc, s);
  const anilloH = rank(ifcKH, ircK);
  const sectorH = rank(ffmiHoy(ffmi, s), fmiHoy(fmi, s));
  const estadoH = anilloH * 9 + sectorH + 1;
  let d1H = D1[`${ifcLH}|${ircL}`] ?? 1;
  if (iehh != null && iehh > 1) d1H = cap3(d1H + 1);
  const estadoSellado = snap?.efrStateNumber ?? snap?.classifications?.efrStateNumber ?? null;
  if (estadoSellado != null) { if (estadoSellado === estadoH) c.validaSector++; else c.validaSector_no++; }
  if (d1H === sevHoy[0]) c.validaDom1++; else c.validaDom1_no++;
  const scoreH = Math.round(sevHoy.reduce((a, v, k) => a + W[k] * (v / 3), 0) * 100);
  if (snap?.dfi?.riesgo?.score === scoreH) c.validaScore++; else c.validaScore_no++;

  // ── v17 ──
  const [ifcLV, ifcKV] = ifcV17(ifc, s);
  if (ifcLV !== ifcLH) c.ifcCambia++;
  const anilloV = ifcKV == null ? null : rank(ifcKV, ircK);
  const sectorV = s ? rank(ffmiV17(ffmi, s), fmiV17(fmi, s)) : null;
  if (sectorV != null && sectorV !== sectorH) c.sectorCambia++;
  if (anilloV != null && anilloV !== anilloH) c.anilloCambia++;
  const estadoV = anilloV != null && sectorV != null ? anilloV * 9 + sectorV + 1 : null;
  if (estadoV != null && estadoV !== estadoH) {
    c.estadoCambia++;
    if (ejemplos.length < 6) ejemplos.push(`  ${evId.slice(0, 8)} ${s} IFC ${ifc.toFixed(2)} IRC ${irc.toFixed(2)} FFMI ${ffmi.toFixed(1)} FMI ${fmi.toFixed(1)}: #${estadoH} -> #${estadoV} (S${sectorH + 1}->S${sectorV + 1}, A${anilloH + 1}->A${anilloV + 1})`);
  }

  // dominio 1: matriz con la etiqueta v17 + IEHH fuera de -1..+1 (cota inferior: el valor no se recalcula)
  let d1V = ifcLV == null ? null : (D1[`${ifcLV}|${ircL}`] ?? 1);
  if (d1V != null && iehh != null && (iehh > 1 || iehh < -1)) d1V = cap3(d1V + 1);
  if (iehh != null && iehh < -1) c.iehhFueraAbajo++;
  if (d1V != null && d1V !== sevHoy[0]) c.dom1Cambia++;

  // dominio 2: sector + adiposidad central
  let d2V = sectorV == null ? null : SEV_POR_SECTOR[sectorV];
  const cm = cintura.get(evId) ?? null, ic = ict.get(evId) ?? null;
  if (cm == null && ic == null) c.sinCinturaNiIct++;
  const adiposidad = (cm != null && s && cm >= (s === "M" ? 94 : 80)) || (ic != null && ic >= 0.5);
  if (adiposidad) c.conAdiposidad++;
  if (d2V != null && adiposidad) d2V = cap3(d2V + 1);
  if (d2V != null && d2V !== sevHoy[1]) c.dom2Cambia++;

  // dominio 3: se retira el escalon de IAE > 3 en concordante
  let d3V = sevHoy[2];
  if (iae != null && iae > 3 && iae < 5 && sevHoy[2] === 1) { d3V = 0; c.iaeEscalon++; }
  if (d3V !== sevHoy[2]) c.dom3Cambia++;

  // riesgo integrado
  if (d1V != null && d2V != null) {
    const sevV = [d1V, d2V, d3V, sevHoy[3], sevHoy[4]];
    const scoreV = Math.round(sevV.reduce((a, v, k) => a + W[k] * (v / 3), 0) * 100);
    if (scoreV !== snap?.dfi?.riesgo?.score) c.scoreCambia++;
    const veto = snap?.dfi?.veto === true;
    if (nivelDe(scoreV / 100, sevV, veto) !== nivelDe((snap?.dfi?.riesgo?.score ?? 0) / 100, sevHoy, veto)) c.nivelCambia++;
    // rutas
    if (d1V >= 2 && sevHoy[0] < 2) c.r1Entra++;
    if (d1V < 2 && sevHoy[0] >= 2) c.r1Sale++;
    if (d2V >= 2 && sevHoy[1] < 2) c.r2Entra++;
    if (d2V < 2 && sevHoy[1] >= 2) c.r2Sale++;
    if (d3V < 2 && sevHoy[2] >= 2) c.r4Sale++;
  }

  if (pabu != null && Number.isFinite(pabu) && pabu < 1.618) c.icaSignoMal++;
}

const pc = (n) => `${n} (${((n / c.usables) * 100).toFixed(1)} %)`;
console.log(`\n── VALIDACION contra lo sellado (si esto no cuadra, lo de abajo no vale) ──`);
console.log(`  dominio 1 reproducido: ${c.validaDom1} bien, ${c.validaDom1_no} mal`);
console.log(`  riesgo integrado reproducido: ${c.validaScore} bien, ${c.validaScore_no} mal`);
console.log(`  numero de estado reproducido: ${c.validaSector} bien, ${c.validaSector_no} mal (0/0 = el snapshot no lo trae)`);
console.log(`\n── CUANTO CAMBIA (sobre ${c.usables} consultas vigentes con informe) ──`);
console.log(`  IFC cambia de categoria:        ${pc(c.ifcCambia)}`);
console.log(`  sin sexo (v17 no clasifica):   ${pc(c.ifcSinSexo)}`);
console.log(`  SECTOR de la Diana cambia:     ${pc(c.sectorCambia)}`);
console.log(`  ANILLO de la Diana cambia:     ${pc(c.anilloCambia)}`);
console.log(`  NUMERO de estado cambia:       ${pc(c.estadoCambia)}`);
console.log(`  dominio 1 cambia:              ${pc(c.dom1Cambia)}`);
console.log(`  dominio 2 cambia:              ${pc(c.dom2Cambia)}`);
console.log(`  dominio 3 cambia:              ${pc(c.dom3Cambia)}  (escalon IAE>3 retirado: ${c.iaeEscalon})`);
console.log(`  riesgo integrado cambia:       ${pc(c.scoreCambia)}`);
console.log(`  NIVEL de riesgo cambia:        ${pc(c.nivelCambia)}`);
console.log(`  R1 entra / sale:               ${c.r1Entra} / ${c.r1Sale}`);
console.log(`  R2 entra / sale:               ${c.r2Entra} / ${c.r2Sale}`);
console.log(`  R4 sale:                       ${c.r4Sale}`);
console.log(`  IEHH por DEBAJO de -1 (hoy no suma, v17 si): ${pc(c.iehhFueraAbajo)}`);
console.log(`  adiposidad central (cintura OMS o ICT>=0,5): ${pc(c.conAdiposidad)}`);
console.log(`  sin cintura NI ICT:            ${pc(c.sinCinturaNiIct)}`);
console.log(`  ICA-BIS guardado con el signo EQUIVOCADO (PABU < phi): ${pc(c.icaSignoMal)}`);
if (ejemplos.length) console.log(`\n── ejemplos del cambio de estado ──\n${ejemplos.join("\n")}`);
