// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS PROFESIONALES QUE NO HAN MONTADO LA BIS  ·  SOLO LECTURA  ·  2026-11-05
//
// POR QUE: Santiago va a hablar con los profesionales que tienen consultas sin medicion, y antes quiere
// saber si el hueco es de ellos o NUESTRO. Son dos cosas distintas y se distinguen con datos:
//
//   · si la consulta esta abierta y nunca hubo intento de importar  → es del lado del profesional;
//   · si hubo intentos que FALLARON (parseo, validacion, freno de huella) → es nuestro, y el profesional
//     puede estar creyendo que la subio.
//
// Por eso cada profesional sale con cuatro cifras y no con una: consultas en total, con medicion, sin
// medicion, e intentos fallidos de importar. Y la fecha de la ultima consulta sin medicion, que es la que
// dice si el caso esta vivo o es de hace meses.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO DE PACIENTE: los pacientes salen con los 8 primeros caracteres
// de su id. Los nombres de los PROFESIONALES si salen, porque son con quienes Santiago va a hablar.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/PROFESIONALES_SIN_BIS_2026-11-05.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "profesionales sin BIS (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

/** Pagina con orden estable: sin ORDER BY cada pagina es arbitraria y el total da de mas y de menos. */
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

const fecha = (iso) => (iso ? String(iso).slice(0, 10) : "—");

// ── LOS DATOS ────────────────────────────────────────────────────────────────────────────────────
const evals = await todas(
  "evaluations",
  "id, patient_id, professional_id, status, type, created_at, superseded_at, retirada_at",
);
const mediciones = await todas("bis_measurements", "evaluation_id, measurement_date, no_es_del_paciente_at");
const logs = await todas("bis_import_logs", "evaluation_id, status, error_detail, created_at");
const perfiles = await todas("profiles", "id, full_name, email");
const profDeProfiles = await todas("professional_profiles", "id, profile_id");
const nombrePorProfile = new Map(perfiles.map((p) => [p.id, p.full_name || p.email]));
// evaluations.professional_id apunta a professional_profiles, no a profiles: hay que dar el salto.
const nombreDe = new Map(profDeProfiles.map((pp) => [pp.id, nombrePorProfile.get(pp.profile_id)]));

// Una medicion DESLIGADA (marcada "no es del paciente") no cuenta como medicion de esa consulta.
const conMedicion = new Set(mediciones.filter((m) => !m.no_es_del_paciente_at).map((m) => m.evaluation_id));
const fallosPorEval = new Map();
for (const l of logs) {
  if (l.status === "ok" || !l.evaluation_id) continue;
  if (!fallosPorEval.has(l.evaluation_id)) fallosPorEval.set(l.evaluation_id, []);
  fallosPorEval.get(l.evaluation_id).push(l);
}

// Las consultas VIVAS: sin reemplazo por correccion y sin retirar.
const vivas = evals.filter((e) => !e.superseded_at && !e.retirada_at);

console.log(`\nConsultas en total: ${evals.length} · vivas (sin reemplazo ni retiro): ${vivas.length}`);
console.log(`Mediciones BIS: ${mediciones.length} · de ellas desligadas: ${mediciones.filter((m) => m.no_es_del_paciente_at).length}`);
const fallosSinEval = logs.filter((l) => l.status !== "ok" && !l.evaluation_id).length;
console.log(`Intentos de importar registrados: ${logs.length} · fallidos: ${logs.filter((l) => l.status !== "ok").length} (${fallosSinEval} sin consulta asociada, no atribuibles)`);

// ── POR PROFESIONAL ──────────────────────────────────────────────────────────────────────────────
const porProf = new Map();
for (const e of vivas) {
  const k = e.professional_id ?? "(sin profesional)";
  if (!porProf.has(k)) porProf.set(k, { total: 0, con: 0, sin: [], fallos: 0, ultima: null });
  const f = porProf.get(k);
  f.total += 1;
  if (conMedicion.has(e.id)) f.con += 1;
  else f.sin.push(e);
  if (fallosPorEval.has(e.id)) f.fallos += fallosPorEval.get(e.id).length;
  if (!f.ultima || e.created_at > f.ultima) f.ultima = e.created_at;
}

const filas = [...porProf.entries()].sort((a, b) => b[1].sin.length - a[1].sin.length);
console.log("\n── POR PROFESIONAL (ordenado por consultas sin medicion) ──");
for (const [pid, f] of filas) {
  const nombre = nombreDe.get(pid) ?? (pid === "(sin profesional)" ? pid : pid.slice(0, 8));
  const ultimaSin = f.sin.map((e) => e.created_at).sort().at(-1);
  console.log(
    `  ${nombre}: ${f.total} consultas · con medicion ${f.con} · SIN medicion ${f.sin.length} · ` +
      `intentos fallidos ${f.fallos} · ultima consulta ${fecha(f.ultima)} · ultima sin medicion ${fecha(ultimaSin)}`,
  );
  // El detalle solo de las que no tienen medicion, para ver si estan abiertas o quedaron a medias.
  const porEstado = new Map();
  for (const e of f.sin) {
    const k = `${e.status}/${e.type}`;
    porEstado.set(k, (porEstado.get(k) ?? 0) + 1);
  }
  if (f.sin.length > 0) {
    console.log(`      estados de las que no tienen medicion: ${[...porEstado].map(([k, n]) => `${k}=${n}`).join(" · ")}`);
    const conIntento = f.sin.filter((e) => fallosPorEval.has(e.id));
    if (conIntento.length > 0) {
      console.log(`      ⚠ ${conIntento.length} de ellas SI tuvieron intento fallido de importar (el hueco es nuestro):`);
      for (const e of conIntento.slice(0, 6)) {
        const porque = fallosPorEval.get(e.id).map((l) => `${l.status}: ${(l.error_detail ?? "").slice(0, 90)}`);
        console.log(`        consulta ${e.id.slice(0, 8)} (${fecha(e.created_at)}) → ${porque.join(" | ")}`);
      }
    }
  }
}

// ── LAS CONSULTAS SIN MEDICION, VISTA GLOBAL POR ANTIGUEDAD ──────────────────────────────────────
console.log("\n── LAS CONSULTAS SIN MEDICION, POR MES DE APERTURA ──");
const sinTodas = vivas.filter((e) => !conMedicion.has(e.id));
const porMes = new Map();
for (const e of sinTodas) {
  const mes = String(e.created_at).slice(0, 7);
  porMes.set(mes, (porMes.get(mes) ?? 0) + 1);
}
for (const mes of [...porMes.keys()].sort()) console.log(`  ${mes}: ${porMes.get(mes)}`);
console.log(`  total sin medicion: ${sinTodas.length}`);

console.log("\nFin. Nada se escribio.");
