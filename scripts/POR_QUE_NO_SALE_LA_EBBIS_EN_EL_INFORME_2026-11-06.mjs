// ══════════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE NO SALE LA EB-BIS EN EL INFORME, Y SI EL EJEMPLO DE SEGUIMIENTO ES UNA SOLA PERSONA
// SOLO LECTURA  ·  2026-11-06
//
// DOS PREGUNTAS DE SANTIAGO, las dos con respuesta en el dato:
//
//   b) "Ya no aparece la EBBIS, por que? no la ibamos a poner?"  El bloque se gatea por
//      `snapshot.ebBis.estado === "ok"`, y un snapshot sellado ANTES de la v7 no trae ese campo: lleva la
//      EB-BIS v5 en `indicators.eb`, que es justo la cifra que su decision de agosto no queria mostrar.
//      Aqui se cuenta cuantos reportes sellados traen la v7 y cuantos no, y desde cuando.
//
//   f) El ejemplo de seguimiento marca +18 kg de peso y +25,5 kg de masa grasa en dos meses. Eso no es
//      fisiologicamente posible, asi que o son dos personas distintas o hay un dato mal. Se compara la
//      serie de ese paciente midiendo la huella de cada toma.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO DE PACIENTE: ids de 8 caracteres y cifras.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/POR_QUE_NO_SALE_LA_EBBIS_EN_EL_INFORME_2026-11-06.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "por que no sale la EB-BIS (SOLO LECTURA)");

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

const fecha = (iso) => (iso ? String(iso).slice(0, 10) : "—");
const num = (v) => (typeof v === "number" ? v : v == null ? null : Number(v));

// ── b · CUANTOS DIAGNOSTICOS SELLADOS TRAEN LA EB-BIS v7 ─────────────────────────────────────────
console.log("\n══ b · LA EB-BIS EN LOS DIAGNOSTICOS SELLADOS ══");
const diags = await todas("reports", "id, evaluation_id, created_at, snapshot, type", (q) => q.eq("type", "paciente"));

let conV7 = 0;
let v7NoOk = 0;
let sinCampo = 0;
const porMes = new Map();
const estadosVistos = new Map();
let primeraConV7 = null;
for (const d of diags) {
  const eb = d.snapshot?.ebBis;
  const mes = String(d.created_at).slice(0, 7);
  if (!porMes.has(mes)) porMes.set(mes, { total: 0, ok: 0 });
  porMes.get(mes).total += 1;
  if (eb === undefined || eb === null) {
    sinCampo += 1;
    continue;
  }
  estadosVistos.set(eb.estado, (estadosVistos.get(eb.estado) ?? 0) + 1);
  if (eb.estado === "ok") {
    conV7 += 1;
    porMes.get(mes).ok += 1;
    if (!primeraConV7 || d.created_at < primeraConV7) primeraConV7 = d.created_at;
  } else {
    v7NoOk += 1;
  }
}
console.log(`  reportes del paciente sellados: ${diags.length}`);
console.log(`  con ebBis.estado = "ok" (la cifra SALE en el informe): ${conV7}`);
console.log(`  con el campo ebBis pero en otro estado (NO sale): ${v7NoOk} · ${[...estadosVistos].map(([k, n]) => `${k}=${n}`).join(" · ")}`);
console.log(`  SIN el campo ebBis (sellados antes de la v7 o sin ella; NO sale): ${sinCampo}`);
console.log(`  primer sellado con la v7: ${fecha(primeraConV7)}`);
console.log("  por mes de sellado (total / con la cifra):");
for (const mes of [...porMes.keys()].sort()) {
  const m = porMes.get(mes);
  console.log(`    ${mes}: ${m.total} / ${m.ok}`);
}

// ── Y DE LOS REPORTES EMITIDOS, CUANTOS LA LLEVAN ────────────────────────────────────────────────
const reportes = await todas("reports", "id, evaluation_id, created_at");
const diagPorEval = new Map(diags.map((d) => [d.evaluation_id, d]));
let repConCifra = 0;
for (const r of reportes) {
  const d = diagPorEval.get(r.evaluation_id);
  if (d?.snapshot?.ebBis?.estado === "ok") repConCifra += 1;
}
console.log(`\n  reportes emitidos: ${reportes.length} · de ellos con la edad biologica visible: ${repConCifra}`);

// ── f · EL EJEMPLO DE SEGUIMIENTO: UNA PERSONA O DOS? ────────────────────────────────────────────
console.log("\n══ f · EL EJEMPLO DE SEGUIMIENTO (+18 kg de peso, +25,5 kg de grasa en dos meses) ══");
const medidas = await todas(
  "bis_measurements",
  "id, evaluation_id, measurement_date, created_at, no_es_del_paciente_at",
  (q) => q,
  "id",
);
const evals = await todas("evaluations", "id, patient_id, type, created_at");
const evalPorId = new Map(evals.map((e) => [e.id, e]));

// LOS NOMBRES DE VARIABLE SON LOS DEL ENCABEZADO NORMALIZADO, no un alias nuestro: es lo que guarda
// `bis_raw_values` (`normalizeHeader` traduce el token de BiodyLife a "valor"). Escribirlos de otra
// forma no da error: devuelve cero filas, y la comparacion saldria vacia sin avisar.
const VAR = {
  peso: "Peso kg",
  talla: "Altura cm",
  fm: "Masa grasa bruta valor kg",
  ffm: "Masa sin grasa valor kg",
};
const crudos = await todas(
  "bis_raw_values",
  "measurement_id, variable_name, value",
  (q) => q.in("variable_name", Object.values(VAR)),
  "id",
);
const porMedicion = new Map();
for (const c of crudos) {
  if (!porMedicion.has(c.measurement_id)) porMedicion.set(c.measurement_id, {});
  porMedicion.get(c.measurement_id)[c.variable_name] = num(c.value);
}
console.log(`  filas de crudo leidas para esas cuatro variables: ${crudos.length}`);

/** Peso, masa grasa, masa sin grasa y talla de una medicion. */
function piezas(m) {
  const v = porMedicion.get(m.id) ?? {};
  return {
    peso: v[VAR.peso] ?? null,
    fm: v[VAR.fm] ?? null,
    ffm: v[VAR.ffm] ?? null,
    talla: v[VAR.talla] ?? null,
  };
}

// EL CASO QUE VIO SANTIAGO: dos tomas, una del 13 de julio y otra del 14 de septiembre, del mismo
// paciente, con 98,4 kg y 43,5 kg de grasa en la segunda.
const candidatas = medidas.filter((m) => {
  const f = fecha(m.measurement_date);
  return f === "2026-07-13" || f === "2026-09-14";
});
console.log(`  mediciones con fecha 13-jul o 14-sep: ${candidatas.length}`);

const porPaciente = new Map();
for (const m of candidatas) {
  const e = evalPorId.get(m.evaluation_id);
  if (!e) continue;
  if (!porPaciente.has(e.patient_id)) porPaciente.set(e.patient_id, []);
  porPaciente.get(e.patient_id).push({ m, e });
}
for (const [pid, lista] of porPaciente) {
  if (lista.length < 2) continue;
  console.log(`\n  paciente ${pid.slice(0, 8)} · ${lista.length} tomas en esas dos fechas:`);
  for (const { m, e } of lista.sort((a, b) => String(a.m.measurement_date).localeCompare(String(b.m.measurement_date)))) {
    const p = piezas(m);
    console.log(
      `    ${fecha(m.measurement_date)} · consulta ${e.id.slice(0, 8)} (${e.type}) · medicion ${m.id.slice(0, 8)} · ` +
        `peso ${p.peso} · FM ${p.fm} · FFM ${p.ffm} · talla ${p.talla}` +
        (m.no_es_del_paciente_at ? " · DESLIGADA" : ""),
    );
  }
  const ordenadas = lista.sort((a, b) => String(a.m.measurement_date).localeCompare(String(b.m.measurement_date)));
  const a = piezas(ordenadas[0].m);
  const b = piezas(ordenadas.at(-1).m);
  if (a.peso !== null && b.peso !== null) {
    console.log(`    → delta peso ${(b.peso - a.peso).toFixed(1)} kg · delta FM ${a.fm !== null && b.fm !== null ? (b.fm - a.fm).toFixed(1) : "?"} kg · delta FFM ${a.ffm !== null && b.ffm !== null ? (b.ffm - a.ffm).toFixed(1) : "?"} kg`);
  }
  // LA TALLA ES LA HUELLA MAS BARATA DE "ES OTRA PERSONA": no cambia en dos meses en un adulto.
  if (a.talla !== null && b.talla !== null && Math.abs(a.talla - b.talla) > 1) {
    console.log(`    ⚠ LA TALLA CAMBIA ${(b.talla - a.talla).toFixed(1)} cm: no es la misma persona, o un dato esta mal.`);
  }
}

// ── Y EL BARRIDO GENERAL: SALTOS IMPOSIBLES ENTRE DOS TOMAS CONSECUTIVAS ─────────────────────────
console.log("\n══ f-bis · SALTOS DE PESO IMPOSIBLES ENTRE TOMAS CONSECUTIVAS DEL MISMO PACIENTE ══");
const serie = new Map();
for (const m of medidas) {
  if (m.no_es_del_paciente_at) continue;
  const e = evalPorId.get(m.evaluation_id);
  if (!e) continue;
  if (!serie.has(e.patient_id)) serie.set(e.patient_id, []);
  serie.get(e.patient_id).push(m);
}
let sospechosos = 0;
for (const [pid, lista] of serie) {
  if (lista.length < 2) continue;
  lista.sort((x, y) => String(x.measurement_date).localeCompare(String(y.measurement_date)));
  for (let i = 1; i < lista.length; i++) {
    const a = piezas(lista[i - 1]);
    const b = piezas(lista[i]);
    if (a.peso === null || b.peso === null) continue;
    const dias = (new Date(lista[i].measurement_date) - new Date(lista[i - 1].measurement_date)) / 86400000;
    const dPeso = b.peso - a.peso;
    // 1 kg por semana es un ritmo agresivo pero real; el doble ya no lo es.
    const limite = Math.max(5, (dias / 7) * 2);
    if (Math.abs(dPeso) > limite) {
      sospechosos += 1;
      console.log(
        `  paciente ${pid.slice(0, 8)} · ${fecha(lista[i - 1].measurement_date)} → ${fecha(lista[i].measurement_date)} ` +
          `(${Math.round(dias)} dias) · peso ${a.peso} → ${b.peso} (${dPeso > 0 ? "+" : ""}${dPeso.toFixed(1)} kg)` +
          (a.talla !== null && b.talla !== null ? ` · talla ${a.talla} → ${b.talla}` : ""),
      );
    }
  }
}
console.log(`  total de saltos por encima del limite: ${sospechosos}`);

// ── f-ter · LA MEDICION DEL ARCHIVO DE PRUEBA, COLGADA DE CUANTOS PACIENTES ──────────────────────
//
// Las tomas del 13 de julio salen todas con las MISMAS cifras (80,4 kg / 177 cm / 18,043 kg de grasa):
// es el XLSX de prueba que se importo muchas veces al construir el flujo. Importa saber a cuantos
// pacientes esta colgado, porque es lo que hace que una comparacion de seguimiento compare dos cuerpos
// distintos, y es la misma pregunta que la marca de prueba de la seccion 1 del otro informe.
console.log("\n══ f-ter · LA MEDICION DEL ARCHIVO DE PRUEBA (80,4 kg / 177 cm / 18,043 kg) ══");
let delFixture = 0;
const pacientesDelFixture = new Set();
const consultasDelFixture = new Set();
for (const m of medidas) {
  const p = piezas(m);
  if (p.peso === 80.4 && p.talla === 177 && p.fm !== null && Math.abs(p.fm - 18.043) < 0.001) {
    delFixture += 1;
    const e = evalPorId.get(m.evaluation_id);
    if (e) {
      pacientesDelFixture.add(e.patient_id);
      consultasDelFixture.add(e.id);
    }
  }
}
console.log(`  mediciones identicas a la del archivo de prueba: ${delFixture} de ${medidas.length}`);
console.log(`  pacientes distintos que la llevan: ${pacientesDelFixture.size}`);
console.log(`  consultas distintas que la llevan: ${consultasDelFixture.size}`);

console.log("\nFin. Nada se escribio.");
