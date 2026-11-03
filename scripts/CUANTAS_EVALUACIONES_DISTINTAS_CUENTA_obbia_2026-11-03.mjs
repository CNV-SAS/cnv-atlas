// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CIFRAS DE /obbia CONTRA EVALUACIONES DISTINTAS  ·  SOLO LECTURA  ·  2026-11-03
//
// ═══ LA ALERTA DE SANTIAGO ═══
//
// Hace unos dias: 542 vigentes, 162 importadas, 225 con diagnostico, 328 autorizadas de 320 pacientes.
// Hoy: 927 vigentes, 273 importadas, 481 con diagnostico, 584 autorizadas de 346 pacientes. Y en medio
// solo paso una cosa: Santiago reemitio los diagnosticos pendientes en tandas de 50.
//
// SU HIPOTESIS, Y ES LA CORRECTA POR CONSTRUCCION: `evaluaciones_vigentes` hace
// `LEFT JOIN diagnoses d ON d.evaluation_id = e.id`, y reemitir INSERTA una fila de `diagnoses` sin
// marcar la anterior (es el mecanismo deliberado de `reemitirDiagnostico`: lo sellado no se toca). Asi
// que una evaluacion reemitida da DOS filas en la vista, y todo `count(*)` encima de ella la cuenta dos
// veces. Lo mismo con `bis_measurements`, que tampoco tiene unico por evaluacion.
//
// ESTE SCRIPT NO DISCUTE LA HIPOTESIS: LA MIDE. Imprime, para cada cifra del panel, lo que cuenta hoy y
// lo que contaria por evaluacion DISTINTA, mas el reparto de cuantos diagnosticos y cuantas mediciones
// tiene cada evaluacion. Si las dos columnas coinciden, la hipotesis es falsa y hay que buscar en otra
// parte.
//
// Y CONTESTA LA SEGUNDA PREGUNTA: si el recalculo creo evaluaciones nuevas. Se mide cruzando los actos
// `diagnosis.reemitted` del audit con las evaluaciones creadas en esa misma ventana.
//
// NO IMPRIME NI UN DATO DE PACIENTE: conteos y cuentas por version del motor.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/CUANTAS_EVALUACIONES_DISTINTAS_CUENTA_obbia_2026-11-03.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";
import { todasLasFilas } from "./lib/todas-las-filas.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "mide /obbia por evaluacion distinta (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

const n = (x) => String(x).padStart(6);

// ── 1. LAS DOS VISTAS, FILA POR FILA ────────────────────────────────────────────────────────────
//
// Las vistas estan revocadas a `anon` y `authenticated` (0224, a proposito), pero NO a `service_role`,
// que es con el que corre este script. Se leen las vistas mismas y no una reconstruccion: lo que se
// quiere medir es lo que la PANTALLA ve, y una segunda definicion mediria otra cosa.
const COLS = "id, patient_id, diagnosis_id, measurement_id, importada, engine_version";

const vigentes = await todasLasFilas(db, "evaluaciones_vigentes", COLS, (q) =>
  q.is("es_consulta_hecha", true),
);
const cohorte = await todasLasFilas(db, "evaluaciones_para_investigacion", COLS, (q) =>
  q.is("es_consulta_hecha", true),
);

const distintas = (filas) => new Set(filas.map((f) => f.id)).size;
const distintasSi = (filas, pred) => new Set(filas.filter(pred).map((f) => f.id)).size;

console.log("  ═══ LO QUE EL PANEL CUENTA HOY, Y LO QUE HAY ═══\n");
console.log("                                           filas   evaluaciones");
console.log(`  Consultas vigentes                      ${n(vigentes.length)}   ${n(distintas(vigentes))}`);
console.log(
  `  Autorizadas para investigacion          ${n(cohorte.length)}   ${n(distintas(cohorte))}`,
);
console.log(
  `  Pacientes distintos autorizados         ${n(new Set(cohorte.map((f) => f.patient_id)).size)}   ${n(new Set(cohorte.map((f) => f.patient_id)).size)}`,
);
console.log(
  `  Con diagnostico sellado                 ${n(cohorte.filter((f) => f.diagnosis_id).length)}   ${n(distintasSi(cohorte, (f) => f.diagnosis_id))}`,
);
console.log(
  `  Importadas del HTML y autorizadas       ${n(cohorte.filter((f) => f.importada).length)}   ${n(distintasSi(cohorte, (f) => f.importada))}`,
);
console.log(
  `  Importadas vigentes (total)             ${n(vigentes.filter((f) => f.importada).length)}   ${n(distintasSi(vigentes, (f) => f.importada))}`,
);

// ── 2. DE DONDE SALE LA MULTIPLICACION: CUANTOS DIAGNOSTICOS Y CUANTAS TOMAS POR EVALUACION ─────
const diagPorEval = new Map();
const medPorEval = new Map();
for (const f of vigentes) {
  if (f.diagnosis_id) {
    const s = diagPorEval.get(f.id) ?? new Set();
    s.add(f.diagnosis_id);
    diagPorEval.set(f.id, s);
  }
  if (f.measurement_id) {
    const s = medPorEval.get(f.id) ?? new Set();
    s.add(f.measurement_id);
    medPorEval.set(f.id, s);
  }
}
const reparto = (mapa, nombre) => {
  const hist = new Map();
  for (const s of mapa.values()) hist.set(s.size, (hist.get(s.size) ?? 0) + 1);
  console.log(`\n  ${nombre}:`);
  for (const k of [...hist.keys()].sort((a, b) => a - b)) {
    console.log(`    ${k} -> ${hist.get(k)} evaluaciones`);
  }
};
reparto(diagPorEval, "DIAGNOSTICOS por evaluacion vigente");
reparto(medPorEval, "MEDICIONES por evaluacion vigente");

// ── 3. LA COHORTE POR VERSION DEL MOTOR, CONTADA DE LAS DOS FORMAS ──────────────────────────────
//
// Es la cifra que mas enseña: contada por filas, la MISMA evaluacion reemitida aparece en la v5 y en la
// v7 a la vez, asi que el panel dice que la cohorte mezcla versiones cuando lo que hay es una sola
// evaluacion con dos sellos. Por evaluacion, cada una cuenta UNA vez, con su diagnostico vigente.
const ultimoPorEval = new Map();
{
  // El diagnostico VIGENTE de una evaluacion es el de `created_at` mas reciente, que es la regla que ya
  // usan `results-reader` y `reports-repository`. Aqui hace falta el `created_at`, que la vista no trae.
  //
  // SE TRAE LA TABLA COMPLETA Y SE FILTRA EN MEMORIA, sin un `.in()` con los mil ids: un `.in()` largo
  // da "URI too long", PostgREST devuelve el error en el campo `error` y una suma encima sale en cero sin
  // que nada lo delate (defecto ya vivido el 2026-10-28).
  const filas = await todasLasFilas(
    db,
    "diagnoses",
    "id, evaluation_id, engine_version, created_at",
    undefined,
    { orden: "evaluation_id,created_at" },
  );
  // Ordenadas por (evaluacion, created_at) ascendente: la ultima que se ve de cada evaluacion es la
  // vigente.
  for (const d of filas) ultimoPorEval.set(d.evaluation_id, d.engine_version);
}
const porVersionFilas = new Map();
const porVersionEval = new Map();
for (const f of cohorte) {
  const v = f.engine_version ?? "sin diagnostico";
  porVersionFilas.set(v, (porVersionFilas.get(v) ?? 0) + 1);
}
for (const id of new Set(cohorte.map((f) => f.id))) {
  const v = ultimoPorEval.get(id) ?? "sin diagnostico";
  porVersionEval.set(v, (porVersionEval.get(v) ?? 0) + 1);
}
console.log("\n  ═══ LA COHORTE AUTORIZADA POR VERSION DEL MOTOR ═══\n");
console.log("                                           filas   evaluaciones (sello vigente)");
for (const v of new Set([...porVersionFilas.keys(), ...porVersionEval.keys()])) {
  console.log(`  ${v.padEnd(38)}${n(porVersionFilas.get(v) ?? 0)}   ${n(porVersionEval.get(v) ?? 0)}`);
}

// ── 4. ¿EL RECALCULO CREO EVALUACIONES NUEVAS? ──────────────────────────────────────────────────
//
// Se mide, no se supone: se toma la ventana de los actos `diagnosis.reemitted` del audit y se cuentan
// las evaluaciones CREADAS dentro de esa misma ventana. Una reemision no inserta en `evaluations`
// (`reemitirDiagnostico` solo escribe `diagnoses` + `reports` + audit), asi que lo esperado es cero o,
// si en esos dias hubo consultas de verdad, exactamente las que un profesional atendio.
const { data: actos, error: eActos } = await db
  .from("clinical_audit_log")
  .select("created_at")
  .eq("event", "diagnosis.reemitted")
  .order("created_at", { ascending: true });
if (eActos) throw new Error(`audit: ${eActos.message}`);

console.log("\n  ═══ EL RECALCULO ═══\n");
if (actos.length === 0) {
  console.log("  No hay ningun acto `diagnosis.reemitted` en el audit.");
} else {
  const desde = actos[0].created_at;
  const hasta = actos[actos.length - 1].created_at;
  console.log(`  Reemisiones registradas: ${actos.length}`);
  console.log(`  Ventana: ${desde} -> ${hasta}`);
  const { count: evalsEnLaVentana, error: eEv } = await db
    .from("evaluations")
    .select("id", { count: "exact", head: true })
    .gte("created_at", desde)
    .lte("created_at", hasta);
  if (eEv) throw new Error(`evaluations: ${eEv.message}`);
  console.log(`  Evaluaciones CREADAS en esa ventana: ${evalsEnLaVentana}`);
  const { count: reportesEnLaVentana, error: eRep } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", desde)
    .lte("created_at", hasta);
  if (eRep) throw new Error(`reports: ${eRep.message}`);
  console.log(`  Informes creados en esa ventana: ${reportesEnLaVentana} (uno por reemision)`);
}

console.log("");
