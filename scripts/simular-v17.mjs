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
import { createRequire } from "node:module";

import { createClient } from "@supabase/supabase-js";

// ═══ EL LADO v17 YA NO ES UNA COPIA: ES EL MOTOR (2026-11-12) ═══
//
// La primera version de este script reimplementaba los criterios de la v17 a mano, porque el motor
// todavia no los tenia. Eso medía una copia, no el codigo: si la copia y el porte diferian, la
// simulacion decia una cosa y el sistema haria otra, y nadie se enteraria.
//
// Con los pasos 3 y 4 construidos, el motor YA trae `cIFC` con los cortes de su Tabla 6.1, los
// clasificadores MCCB de su Tabla 10.2, los nueve sectores con su gravedad y el mapa DX. Asi que el
// lado v17 los LLAMA. El lado HOY sigue escrito a mano, y tiene que seguir asi: esos cortes ya NO
// existen en el codigo (la v17 los retiro), y son justo lo que hay que reproducir para validar.
const require = createRequire(import.meta.url);
const core = require("../src/clinical-engine/frozen/engine.core.derived.js");
const ix = require("../src/clinical-engine/frozen/engine.indices.js");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Copiado del motor congelado SOLO para la simulacion (no es codigo de produccion) ──
const EFR_RISK_ORDER = [[3,1],[3,2],[2,1],[2,2],[3,3],[2,3],[1,1],[1,2],[1,3]];
const rank = (a, b) => EFR_RISK_ORDER.findIndex(([x, y]) => x === a && y === b);
const D1 = { "Alto|Bajo":0,"Alto|Normal":1,"Normal|Bajo":1,"Alto|Alto":2,"Normal|Normal":2,"Bajo|Bajo":2,"Normal|Alto":2,"Bajo|Normal":3,"Bajo|Alto":3 };
const cap3 = (n) => Math.max(0, Math.min(3, n));
const W = [0.30, 0.25, 0.15, 0.15, 0.15];

// IFC HOY: escrito a mano porque sus cortes (4,12/6,68 y 2,08/3,28, y la caida global 3,5/6,0) ya no
// existen en el codigo. Es lo que hay que reproducir para validar contra lo sellado.
const ifcHoy = (v, s) => { const lo = s === "M" ? 4.12 : s === "F" ? 2.08 : 3.5, hi = s === "M" ? 6.68 : s === "F" ? 3.28 : 6.0;
  return v > hi ? ["Alto", 3] : v >= lo ? ["Normal", 2] : ["Bajo", 1]; };
// IFC v17: del MOTOR. `cIFC` devuelve k = 0 sin sexo, que es su "no se clasifica".
const ifcV17 = (v, s) => {
  const k = core.cIFC(v, s).k;
  return k === 0 ? [null, null] : [k === 3 ? "Alto" : k === 2 ? "Normal" : "Bajo", k];
};
// IRC: no cambia.
const ircBanda = (v, s) => { const lo = s === "F" ? 2.3 : 1.7, hi = s === "F" ? 2.8 : 2.1;
  return v < lo ? ["Bajo", 1] : v <= hi ? ["Normal", 2] : ["Alto", 3]; };
// FMI / FFMI: cortes del Excel (hoy) y del MCCB del libro (v17).
const fmiHoy = (v, s) => s === "M" ? (v < 3 ? 1 : v <= 6 ? 2 : 3) : (v < 5 ? 1 : v <= 9 ? 2 : 3);
const ffmiHoy = (v, s) => s === "M" ? (v < 17 ? 1 : v <= 25 ? 2 : 3) : (v < 15 ? 1 : v <= 23 ? 2 : 3);
// FMI / FFMI v17: del MOTOR (sus cortes MCCB por sexo). Devuelven k = 0 sin sexo o sin valor.
const fmiV17 = (v, s) => core.cFMI_MCCB(v, s).k || null;
const ffmiV17 = (v, s) => core.cFFMI_MCCB(v, s).k || null;
// Dominio 2 de la v17: gravedad base por sector (docx §8) + modificador de adiposidad central.
// La gravedad de cada sector sale de SU tabla en el motor (MCCB_SECTORES), ordenada igual que
// EFR_RISK_ORDER: indice 0 = S1. Antes estaba escrita a mano aqui.
const SEV_POR_SECTOR = core.MCCB_SECTORES.map((x) => x.g);
const nivelDe = (score01, sev, veto) => {
  let n = score01 < 0.20 ? 0 : score01 < 0.45 ? 1 : score01 < 0.70 ? 2 : 3;
  if (sev.some((s) => s === 3) && n < 2) n = 2;
  if (veto && (sev[0] >= 2 || sev[1] >= 2)) n = 3;
  if (sev[0] === 3 && sev[1] === 3) n = 3;
  if (sev[3] === 3) n = Math.max(n, 2);
  return n;
};

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// TRAER TODAS LAS FILAS, Y NO LAS PRIMERAS MIL  ·  2026-11-12
//
// ═══ EL RIESGO QUE CIERRA, Y YA NOS COSTO UNA CIFRA ═══
//
// PostgREST devuelve como maximo MIL filas por consulta y **no lo dice**: no hay error, no hay aviso, la
// respuesta llega completa en apariencia. Un script de medicion que pida `reports` o `evaluations` sin
// paginar mide la cohorte que CABE en mil filas y reporta porcentajes sobre ella como si fueran de todas.
// Ya paso: una pantalla decia 316 y el dato real eran 136.
//
// EL ORDEN NO ES ESTETICO, ES LO QUE HACE QUE LA PAGINACION SIGNIFIQUE ALGO. Paginar sin un `order by`
// estable no define que trae cada pagina: el motor puede devolver la misma fila dos veces y perder otra,
// y el total sale mal por los dos lados a la vez. Se ordena por `id`, que es unico.
//
// Y FALLA RUIDOSO ante un error de base, en vez de devolver lo que alcanzo a traer: una medicion a medias
// con forma de medicion completa es peor que ninguna.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
const PAGINA = 1000;
async function traerTodo(tabla, columnas, filtrar = (q) => q, orden = "id") {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await filtrar(sb.from(tabla).select(columnas))
      .order(orden, { ascending: true })
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) return filas;
  }
}

// ── Los datos: una consulta vigente, su informe mas reciente ──
const evs = await traerTodo("evaluations", "id, patient_id, created_at", (q) =>
  q.is("superseded_at", null).is("retirada_at", null),
);
// El informe se pide con su `id` para poder paginar por una columna unica, y el MAS RECIENTE por
// consulta se elige despues ordenando en memoria: el `order by created_at` de la consulta ya no puede
// decidirlo, porque la paginacion ordena por id. Es la misma cantidad de datos y una comparacion mas,
// a cambio de que el total sea el total.
const reps = await traerTodo("reports", "id, evaluation_id, created_at, snapshot", (q) => q.eq("type", "paciente"));
const vigentes = new Set(evs.map((e) => e.id));
const porEval = new Map();
for (const r of [...reps].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
  if (vigentes.has(r.evaluation_id) && !porEval.has(r.evaluation_id)) porEval.set(r.evaluation_id, r.snapshot);
}

// Cintura e ICT por medicion -> por consulta
const med = await traerTodo("bis_measurements", "id, evaluation_id");
const evalPorMed = new Map(med.map((m) => [m.id, m.evaluation_id]));
const cintura = new Map(), ict = new Map();
// ═══ LOS SIETE COMPONENTES DEL IEHH Y DEL ISCM-BIS (v17 §5) ═══
//
// Hasta la corrida del 11 de noviembre el IEHH se simulaba cambiando solo su ZONA sobre el valor
// ACTUAL, que era una COTA INFERIOR del cambio real y se dijo asi. Ahora el porte existe, asi que el
// indice se RECALCULA con su funcion y sus referencias por sexo, desde los crudos de la medicion.
//
// LOS NOMBRES SON LOS NORMALIZADOS de `bis_raw_values`, que no son los encabezados del export: el
// import los pasa por `normalizeHeader` (recorta y traduce los tokens del equipo). Se verificaron
// contra la base, uno por uno, en vez de deducirlos del contrato del motor.
const crudos = {
  Re: new Map(), Rinf: new Map(), C: new Map(), MCA: new Map(),
  AECsg: new Map(), AICsg: new Map(), FFW: new Map(),
};
const VARIABLE_DE = {
  Re: "Extracellular resistance",
  Rinf: "Infinite resistance",
  C: "Membrane capacitance nF",
  MCA: "Masa celular activa valor kg",
  AECsg: "Agua extracelular sin grasa valor L",
  AICsg: "Agua intracelular sin grasa valor L",
  FFW: "Fat free water valor L",
};
for (const [campo, variable] of Object.entries(VARIABLE_DE)) {
  const data = await traerTodo("bis_raw_values", "id, measurement_id, value", (q) =>
    q.eq("variable_name", variable),
  );
  for (const r of data) {
    const e = evalPorMed.get(r.measurement_id);
    const v = Number(r.value);
    if (e && Number.isFinite(v) && v > 0) crudos[campo].set(e, v);
  }
}

for (const [variable, destino] of [["Waist Size cm", cintura], ["Ratio Cintura/Altura valor", ict]]) {
  const data = await traerTodo("bis_raw_values", "id, measurement_id, value", (q) =>
    q.eq("variable_name", variable),
  );
  for (const r of data) {
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
  // Los cortes MCCB mueven tambien la CATEGORIA del FMI que el dominio conductual usa para medir la
  // distorsion de imagen corporal, y la LISTA DE NUTRACEUTICOS que el mapa DX sugiere por celda.
  fmiCatCambia: 0, fmiCatCambia_conDistorsion: 0, fmiCatCambia_sinDistorsion: 0,
  // El IEHH y el ISCM-BIS recalculados de verdad (ya no una cota).
  iehhRecalculable: 0, iehhCambiaZona: 0, iehhEntraEnDeficit: 0, iehhSaleDeDeficit: 0,
  iscmRecalculable: 0, iscmCambiaBanda: 0, sinCrudosParaIehh: 0,
  nutraCambia: 0, validaNutra: 0, validaNutra_no: 0,
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
  // ═══ CORREGIDO (2026-11-12): EL NUMERO DE ESTADO SI VIENE EN EL SNAPSHOT ═══
  //
  // Esta linea buscaba `snap.efrStateNumber` y `snap.classifications.efrStateNumber`, y ninguna de las
  // dos existe. Por eso la corrida del 11 de noviembre imprimio "numero de estado reproducido: 0 bien,
  // 0 mal", que se leyo como "el snapshot no lo trae" y llevo a responderle a Santiago que habia que
  // sellarlo. NO hacia falta: esta sellado desde siempre, en `efrPhenotype.stateNumber`, y con el las
  // CUATRO BANDAS (`efrPhenotype.bands`). El script miraba el sitio equivocado.
  //
  // La leccion, que es la misma de otras tres veces: un 0/0 no es un dato, es una pregunta sin
  // responder. Un contador que no se incrementa nunca tiene que decir "no lo encontre", no "no hay".
  const estadoSellado = snap?.efrPhenotype?.stateNumber ?? null;
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

  // ── EL IEHH Y EL ISCM-BIS, RECALCULADOS CON SU FUNCION Y SUS REFERENCIAS POR SEXO (v17 §5) ──
  //
  // Ya no es una cota: se llama a `calcIEHH_ISCM` con los siete componentes crudos de ESTA medicion.
  // Si falta alguno, su funcion devuelve 0 (sin dato) y aqui se cuenta aparte en vez de mezclarse con
  // un cero medido, que con el ISCM-BIS es un valor perfectamente normal.
  const comp = {
    sexo: s,
    Re: crudos.Re.get(evId) ?? null,
    Rinf: crudos.Rinf.get(evId) ?? null,
    C: crudos.C.get(evId) ?? null,
    MCA: crudos.MCA.get(evId) ?? null,
    AECsg: crudos.AECsg.get(evId) ?? null,
    AICsg: crudos.AICsg.get(evId) ?? null,
    FMI: fmi,
    FFW: crudos.FFW.get(evId) ?? null,
  };
  const nuevos = ix.calcIEHH_ISCM(comp);
  const iehhV17 = nuevos.iehh === 0 ? null : nuevos.iehh;
  const iscmV17 = nuevos.iscm === 0 ? null : nuevos.iscm;
  if (iehhV17 == null) c.sinCrudosParaIehh++;
  else {
    c.iehhRecalculable++;
    // La ZONA de hoy se deriva del valor SELLADO con los grados de la v16; la nueva, de sus tres zonas.
    const zonaHoy = iehh == null ? null : iehh <= 0 ? 0 : 1; // v16: el cero era el optimo
    const zonaV17 = iehhV17 < -1 ? -1 : iehhV17 <= 1 ? 0 : 1;
    if (zonaHoy !== zonaV17) c.iehhCambiaZona++;
    if (zonaV17 === -1) c.iehhEntraEnDeficit++;
    if (iehh != null && iehh < -1 && zonaV17 !== -1) c.iehhSaleDeDeficit++;
  }
  if (iscmV17 != null) {
    c.iscmRecalculable++;
    const banda = (v) => core.cISCM(v, s).banda;
    if (banda(iscmV17) !== banda(i.iscm == null ? null : Number(i.iscm))) c.iscmCambiaBanda++;
  }

  // dominio 1: matriz con la etiqueta v17 + el IEHH RECALCULADO fuera de -1..+1, en las dos direcciones
  let d1V = ifcLV == null ? null : (D1[`${ifcLV}|${ircL}`] ?? 1);
  if (d1V != null && iehhV17 != null && (iehhV17 > 1 || iehhV17 < -1)) d1V = cap3(d1V + 1);
  if (iehhV17 != null && iehhV17 < -1) c.iehhFueraAbajo++;
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

  // ── EL DOMINIO 4: COTA, Y SE DICE QUE ES UNA COTA ──
  //
  // La distorsion de imagen corporal compara lo que el paciente dice de su cuerpo contra su fenotipo
  // REAL, que el DFI resume en tres categorias de FMI (bajo_grasa / normal / exceso). Esa categoria
  // ahora se calcula con los cortes MCCB, asi que puede cambiar, y con ella la distorsion.
  //
  // LO QUE NO SE PUEDE SABER DESDE EL SNAPSHOT es que respondio el paciente sobre su imagen (no viaja
  // en el informe), asi que no se puede recalcular el dominio. Lo que SI se puede medir es cuantas
  // consultas cambian de CATEGORIA de FMI: solo esas pueden mover el dominio 4, y es por tanto una
  // COTA SUPERIOR. Se parte en dos para que se vea la direccion del riesgo: las que hoy tienen la
  // distorsion marcada podrian PERDERLA, y las que no, podrian GANARLA.
  const catDe = (k) => (k == null ? null : k <= 1 ? "bajo_grasa" : k === 2 ? "normal" : "exceso");
  const catHoy = catDe(fmiHoy(fmi, s));
  const catV17 = catDe(fmiV17(fmi, s));
  if (catV17 != null && catV17 !== catHoy) {
    c.fmiCatCambia++;
    const itemsD4 = dom.find((d) => d.id === "d4")?.items ?? [];
    if (itemsD4.some((t) => /Distorsi/i.test(String(t)))) c.fmiCatCambia_conDistorsion++;
    else c.fmiCatCambia_sinDistorsion++;
  }

  // ── LA LISTA DE NUTRACEUTICOS SUGERIDOS, que sale de la celda del estado ──
  //
  // El mapa DX se indexa por las cuatro bandas, asi que al moverse el sector cambia la celda y con
  // ella su lista. Esto NO es una cota: la lista se puede reproducir entera desde el snapshot, y
  // primero se VALIDA contra la que el informe ya trae sellada.
  const nutraSellada = typeof snap?.nutraceuticos === "string" ? snap.nutraceuticos.trim() : null;
  const nutraHoy = core.getDX(ifcKH, ircK, ffmiHoy(ffmi, s), fmiHoy(fmi, s)).n;
  if (nutraSellada) { if (nutraSellada === String(nutraHoy).trim()) c.validaNutra++; else c.validaNutra_no++; }
  if (ifcKV != null && sectorV != null) {
    const nutraV17 = core.getDX(ifcKV, ircK, ffmiV17(ffmi, s), fmiV17(fmi, s)).n;
    if (String(nutraV17).trim() !== String(nutraHoy).trim()) c.nutraCambia++;
  }

  if (pabu != null && Number.isFinite(pabu) && pabu < 1.618) c.icaSignoMal++;
}

const pc = (n) => `${n} (${((n / c.usables) * 100).toFixed(1)} %)`;
console.log(`\n── VALIDACION contra lo sellado (si esto no cuadra, lo de abajo no vale) ──`);
console.log(`  dominio 1 reproducido: ${c.validaDom1} bien, ${c.validaDom1_no} mal`);
console.log(`  riesgo integrado reproducido: ${c.validaScore} bien, ${c.validaScore_no} mal`);
console.log(
  c.validaSector + c.validaSector_no === 0
    ? `  numero de estado: NO SE ENCONTRO en ningun snapshot (efrPhenotype.stateNumber). Revisar el script, no concluir que no se sella.`
    : `  numero de estado reproducido: ${c.validaSector} bien, ${c.validaSector_no} mal`,
);
console.log(`  lista de nutraceuticos reproducida: ${c.validaNutra} bien, ${c.validaNutra_no} mal`);
console.log(`\n── CUANTO CAMBIA (sobre ${c.usables} consultas vigentes con informe) ──`);
console.log(`  IFC cambia de categoria:        ${pc(c.ifcCambia)}`);
console.log(`  sin sexo (v17 no clasifica):   ${pc(c.ifcSinSexo)}`);
console.log(`  SECTOR de la Diana cambia:     ${pc(c.sectorCambia)}`);
console.log(`  ANILLO de la Diana cambia:     ${pc(c.anilloCambia)}`);
console.log(`  NUMERO de estado cambia:       ${pc(c.estadoCambia)}`);
console.log(`  dominio 1 cambia:              ${pc(c.dom1Cambia)}`);
console.log(`  dominio 2 cambia:              ${pc(c.dom2Cambia)}`);
console.log(`  dominio 3 cambia:              ${pc(c.dom3Cambia)}  (escalon IAE>3 retirado: ${c.iaeEscalon})`);
console.log(`  categoria de FMI del dominio 4: ${pc(c.fmiCatCambia)}  <- COTA SUPERIOR del dominio 4`);
console.log(`     de esas, con distorsion hoy: ${c.fmiCatCambia_conDistorsion} (podrian perderla) · sin ella: ${c.fmiCatCambia_sinDistorsion} (podrian ganarla)`);
console.log(`  lista de NUTRACEUTICOS sugeridos cambia: ${pc(c.nutraCambia)}`);
console.log(`  riesgo integrado cambia:       ${pc(c.scoreCambia)}`);
console.log(`  NIVEL de riesgo cambia:        ${pc(c.nivelCambia)}`);
console.log(`  R1 entra / sale:               ${c.r1Entra} / ${c.r1Sale}`);
console.log(`  R2 entra / sale:               ${c.r2Entra} / ${c.r2Sale}`);
console.log(`  R4 sale:                       ${c.r4Sale}`);
console.log(`\n── EL IEHH Y EL ISCM-BIS, YA RECALCULADOS (v17 §5, no una cota) ──`);
console.log(`  IEHH recalculable (vienen los 7 crudos): ${pc(c.iehhRecalculable)} · sin crudos: ${c.sinCrudosParaIehh}`);
console.log(`  IEHH cambia de ZONA:            ${c.iehhCambiaZona}`);
console.log(`  IEHH en zona de DEFICIT (< -1): ${c.iehhEntraEnDeficit}  <- suma 1 al dominio 1 y antes no sumaba`);
console.log(`  IEHH que SALE del deficit:      ${c.iehhSaleDeDeficit}`);
console.log(`  ISCM-BIS recalculable:          ${pc(c.iscmRecalculable)}`);
console.log(`  ISCM-BIS cambia de banda de percentil: ${c.iscmCambiaBanda}`);
console.log(`  (el IEHH por debajo de -1 ya es el REAL, no la cota del 11 de noviembre): ${pc(c.iehhFueraAbajo)}`);
console.log(`  adiposidad central (cintura OMS o ICT>=0,5): ${pc(c.conAdiposidad)}`);
console.log(`  sin cintura NI ICT:            ${pc(c.sinCinturaNiIct)}`);
console.log(`  ICA-BIS guardado con el signo EQUIVOCADO (PABU < phi): ${pc(c.icaSignoMal)}`);
if (ejemplos.length) console.log(`\n── ejemplos del cambio de estado ──\n${ejemplos.join("\n")}`);
