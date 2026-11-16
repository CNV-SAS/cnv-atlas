// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS QUE QUEDARON SIN REEMITIR, Y POR QUE  ·  SOLO LECTURA  ·  2026-11-16
//
//   node --env-file=.env.production.local scripts/las-que-no-se-reemitieron.mjs
//
// PARA QUE: despues de ejecutar el recalculo, tres cifras hablan del mismo conjunto y no coinciden, y
// Santiago pidio cuadrarlas (*"que esas 64 sean solo las que no se pueden recalcular, y por que 64 y no
// 71"*):
//
//   · la PANTALLA de recalibracion dice "0 entran · 37 no se pueden reemitir · 34 de prueba · total 71";
//   · la SIMULACION dice "476 en 4.x y 64 PENDIENTES";
//   · y el conteo crudo de diagnosticos vigentes por mayor del motor da otra cosa todavia.
//
// No se contradicen: cuentan UNIVERSOS distintos, y la diferencia es exactamente lo que este script
// imprime. Las tres son correctas; lo que faltaba era el puente.
//
// NO IMPRIME NINGUN DATO DE PACIENTE: solo cuentas y motivos.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !LLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const sb = createClient(URL_SB, LLAVE, { auth: { persistSession: false } });
console.log(`base: ${new URL(URL_SB).host}`);

/** Lee una tabla entera por paginas. Sin esto PostgREST devuelve mil filas y no lo dice. */
async function todas(tabla, cols, afinar, orden = "id") {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    let q = sb.from(tabla).select(cols);
    if (afinar) q = afinar(q);
    const { data, error } = await q.order(orden).range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** El MAYOR del motor. Tolera las dos grafias de produccion (`1.0.0`, `anibise-1.4.0`). */
const mayor = (v) => {
  const m = /(\d+)\.\d+\.\d+/.exec(String(v ?? ""));
  return m ? Number(m[1]) : null;
};

/** La edad a una fecha, con la misma regla que `edadSiSePuede`: null si la fecha no se puede leer. */
function edadA(nacimiento, hasta) {
  if (!nacimiento) return null;
  const n = new Date(nacimiento);
  const h = new Date(hasta);
  if (Number.isNaN(n.getTime()) || Number.isNaN(h.getTime())) return null;
  let e = h.getUTCFullYear() - n.getUTCFullYear();
  const m = h.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && h.getUTCDate() < n.getUTCDate())) e--;
  return Number.isFinite(e) ? e : null;
}

// Los dos cortes son los del FROZEN de la EB-BIS v7, los mismos que usa `motivo-para-no-reemitir`.
const EDAD_MINIMA = 18;
const EDAD_MAXIMA = 100;

const dx = await todas("diagnoses", "id, evaluation_id, engine_version, created_at");
const evs = await todas(
  "evaluations",
  "id, patient_id, superseded_at, retirada_at, created_at",
);
const pacientes = await todas("patients", "id, cuenta_como_de_prueba, deleted_at");
const perfiles = await todas("patient_profiles", "patient_id, birth_date", undefined, "patient_id");
const mediciones = await todas("bis_measurements", "id, evaluation_id, measurement_date");
const informes = await todas("reports", "id, evaluation_id, type");

// EL DIAGNOSTICO VIGENTE de cada consulta es el MAS RECIENTE, que es el mecanismo de la casa.
const vigentePorEval = new Map();
for (const d of dx) {
  const prev = vigentePorEval.get(d.evaluation_id);
  if (!prev || d.created_at > prev.created_at) vigentePorEval.set(d.evaluation_id, d);
}

const evPorId = new Map(evs.map((e) => [e.id, e]));
const pacPorId = new Map(pacientes.map((p) => [p.id, p]));
const nacPorPaciente = new Map(perfiles.map((p) => [p.patient_id, p.birth_date]));
const tomaPorEval = new Map();
for (const m of mediciones) if (!tomaPorEval.has(m.evaluation_id)) tomaPorEval.set(m.evaluation_id, m.measurement_date);
const conInformeDePaciente = new Set(informes.filter((r) => r.type === "paciente").map((r) => r.evaluation_id));

const c = { total: 0, enLa17: 0, pendientes: 0 };
const pendientes = [];
for (const [evalId, d] of vigentePorEval) {
  c.total++;
  if ((mayor(d.engine_version) ?? 0) >= 4) {
    c.enLa17++;
    continue;
  }
  c.pendientes++;
  const ev = evPorId.get(evalId) ?? null;
  const pac = ev ? (pacPorId.get(ev.patient_id) ?? null) : null;
  const nacimiento = pac ? (nacPorPaciente.get(pac.id) ?? null) : null;
  const hasta = tomaPorEval.get(evalId) ?? d.created_at;
  const edad = edadA(nacimiento, hasta);
  pendientes.push({
    evalId,
    sellada: d.engine_version,
    dePrueba: pac?.cuenta_como_de_prueba === true,
    borrada: pac?.deleted_at != null,
    vigente: ev != null && ev.superseded_at == null && ev.retirada_at == null,
    conInforme: conInformeDePaciente.has(evalId),
    sinFecha: edad === null,
    fueraDeCalibracion: edad !== null && (edad < EDAD_MINIMA || edad > EDAD_MAXIMA),
  });
}

console.log(`\nconsultas con diagnostico sellado: ${c.total}`);
console.log(`  ya en la v17 (motor 4.x): ${c.enLa17}`);
console.log(`  PENDIENTES (1.x a 3.x)  : ${c.pendientes}`);

// ── EL PUENTE ENTRE LAS TRES CIFRAS ────────────────────────────────────────────────────────────────
const enLaSimulacion = pendientes.filter((p) => p.vigente && p.conInforme);
const fueraDeLaSimulacion = pendientes.filter((p) => !(p.vigente && p.conInforme));

console.log(`\n── EL UNIVERSO DE LA SIMULACION: consulta VIGENTE y CON informe de paciente ──`);
console.log(`  pendientes que la simulacion cuenta : ${enLaSimulacion.length}`);
console.log(`  pendientes que NO cuenta            : ${fueraDeLaSimulacion.length}`);
for (const [etiqueta, filtro] of [
  ["no vigente (reemplazada o retirada)", (p) => !p.vigente],
  ["sin informe de paciente", (p) => p.vigente && !p.conInforme],
]) {
  const n = fueraDeLaSimulacion.filter(filtro).length;
  if (n > 0) console.log(`    ${etiqueta}: ${n}`);
}

console.log(`\n── EL UNIVERSO DE LA PANTALLA DE RECALIBRACION: todo diagnostico desfasado ──`);
const dePrueba = pendientes.filter((p) => p.dePrueba).length;
console.log(`  de pacientes de prueba (no entran al recalculo, a proposito): ${dePrueba}`);
console.log(`  de pacientes reales                                         : ${pendientes.length - dePrueba}`);

// ── LA HUELLA REPETIDA, que es el tercer motivo y el unico que hay que RESOLVER ───────────────────
//
// Las CUATRO lecturas que identifican la toma fisica, con el nombre que quedan en `bis_raw_values`
// (encabezado normalizado). Salen de `services/huella-de-la-medicion`; no entran fecha, peso ni talla.
const VARIABLES_DE_LA_HUELLA = [
  "Extracellular resistance",
  "Intracellular resistance Ω",
  "Infinite resistance",
  "Membrane capacitance nF",
];
const crudos = await todas(
  "bis_raw_values",
  "measurement_id, variable_name, value",
  (q) => q.in("variable_name", VARIABLES_DE_LA_HUELLA),
  "measurement_id",
);
const porMedicion = new Map();
for (const r of crudos) {
  const n = Number(r.value);
  if (!Number.isFinite(n)) continue;
  if (!porMedicion.has(r.measurement_id)) porMedicion.set(r.measurement_id, new Map());
  porMedicion.get(r.measurement_id).set(r.variable_name, n);
}
/** La huella, o null si le falta alguna de las cuatro: null NO significa "no hay duplicado". */
function huellaDe(medicionId) {
  const m = porMedicion.get(medicionId);
  if (!m) return null;
  const partes = [];
  for (const v of VARIABLES_DE_LA_HUELLA) {
    const n = m.get(v);
    if (n === undefined) return null;
    partes.push(String(n));
  }
  return partes.join("|");
}
// SOLO ENTRE CONSULTAS VIGENTES DE PACIENTES REALES, como el lector de la aplicacion: al corregir, la
// version vieja queda `superseded_at` y sale del universo antes de comparar.
const cuantasPorHuella = new Map();
const huellaPorEval = new Map();
for (const m of mediciones) {
  const ev = evPorId.get(m.evaluation_id);
  if (!ev || ev.superseded_at != null) continue;
  const pac = pacPorId.get(ev.patient_id);
  if (!pac || pac.deleted_at != null || pac.cuenta_como_de_prueba === true) continue;
  const h = huellaDe(m.id);
  if (!h) continue;
  huellaPorEval.set(m.evaluation_id, h);
  cuantasPorHuella.set(h, (cuantasPorHuella.get(h) ?? 0) + 1);
}

console.log(`\n── POR QUE NO SE PUDO REEMITIR CADA UNA DE LAS REALES ──`);
console.log(`  (el ORDEN es el del motivo: primero lo que hay que RESOLVER, despues la condicion del paciente)`);
const reales = pendientes.filter((p) => !p.dePrueba);
const motivos = new Map();
let sinMotivo = 0;
for (const p of reales) {
  const h = huellaPorEval.get(p.evalId);
  const m = h && (cuantasPorHuella.get(h) ?? 0) > 1
    ? "medición repetida en otra consulta vigente: hay que decidir de quién es"
    : p.sinFecha
      ? "sin fecha de nacimiento legible: se registra y se reemite por el flujo normal"
      : p.fueraDeCalibracion
        ? "fuera de la calibración de la EB-BIS v7 (menos de 18 o más de 100): no se resuelve"
        : "NINGUNO de los tres: entró al recálculo y no se reemitió";
  if (m.startsWith("NINGUNO")) sinMotivo++;
  motivos.set(m, (motivos.get(m) ?? 0) + 1);
}
for (const [m, n] of [...motivos.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${m}`);
}
if (sinMotivo > 0) {
  console.log(
    `\n  ⚠ ${sinMotivo} consultas reales quedaron desfasadas SIN un motivo que lo explique. La pantalla las\n` +
      `    ofrece y nadie las reemitió, o algo falló sin decirlo: hay que mirarlas antes de dar el\n` +
      `    recálculo por terminado.`,
  );
} else {
  console.log(`\n  Ninguna consulta real quedó desfasada sin motivo: el recálculo está completo.`);
}
