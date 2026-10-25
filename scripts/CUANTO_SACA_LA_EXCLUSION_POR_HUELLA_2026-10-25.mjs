// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CUANTO SACA DE LA COHORTE LA EXCLUSION POR HUELLA REPETIDA  ·  SOLO LECTURA  ·  2026-10-25
//
// ═══ DE DONDE SALE ═══
//
// Gildardo, 2026-10-25: *"Las evaluaciones con huella repetida salen de
// evaluaciones_para_investigacion hasta que se corrijan, con la misma funcion de la huella. Es calidad de
// dato."*
//
// ═══ PARA QUE SE MIDE ANTES DE CONSTRUIRLO ═══
//
// Porque cambiar una VISTA de investigacion cambia la cohorte, y hay que poder decir EN CUANTO antes de
// aplicarlo, no despues. Si manana el informe dice 310 donde decia 316, la diferencia tiene que estar
// explicada de antemano y con nombre: tantas evaluaciones, tantos grupos, tantos pacientes.
//
// ═══ LA HUELLA, Y POR QUE NO SE LE QUITA LA EXCEPCION DE LA CADENA DE CORRECCION ═══
//
// La huella son las CUATRO lecturas electricas del equipo (Re, Ri, Rinf, C), igual que el freno de la
// 0225. Aqui se compara SOLO entre evaluaciones VIGENTES, y eso hace que las dos excepciones del freno no
// hagan falta: la copia de una cadena de correccion deja la vieja `superseded_at`, y la medicion marcada
// como de otro paciente se queda colgada de la reemplazada. Las dos salen del universo antes de comparar.
//
// NO IMPRIME DATOS DE PACIENTE: conteos y los ids cortos de las evaluaciones de cada grupo.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/CUANTO_SACA_LA_EXCLUSION_POR_HUELLA_2026-10-25.mjs
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
anunciarBase(url, "mide la exclusion por huella repetida (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// Los cuatro nombres, tal como quedan en `bis_raw_values` (encabezado normalizado de BIODY_COLUMNS). Son
// los MISMOS que `VARIABLES_DE_LA_HUELLA`; el candado del repositorio es el que impide que divergan.
const VARIABLES = [
  "Extracellular resistance",
  "Intracellular resistance Ω",
  "Infinite resistance",
  "Membrane capacitance nF",
];

const pacientes = await todasLasFilas(db, "patients", "id, cuenta_como_de_prueba", (q) =>
  q.is("deleted_at", null),
);
const reales = new Set(pacientes.filter((p) => !p.cuenta_como_de_prueba).map((p) => p.id));

const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, status, superseded_at, retirada_at",
);
const NO_ES_CONSULTA = new Set(["awaiting_survey", "abandoned"]);
const vigentes = new Map(
  evaluaciones
    .filter(
      (e) =>
        reales.has(e.patient_id) &&
        !e.superseded_at &&
        !e.retirada_at &&
        !NO_ES_CONSULTA.has(e.status),
    )
    .map((e) => [e.id, e]),
);

const mediciones = await todasLasFilas(db, "bis_measurements", "id, evaluation_id, no_es_del_paciente_at");
const crudos = await todasLasFilas(db, "bis_raw_values", "measurement_id, variable_name, value", (q) =>
  q.in("variable_name", VARIABLES),
);

// La huella, con el mismo criterio que la funcion de TypeScript: NUMERICA (no texto, para que 2.04 y
// 2.040 sean el mismo valor), las cuatro obligatorias, y null si falta alguna.
const porMedicion = new Map();
for (const c of crudos) {
  const n = Number(c.value);
  if (!Number.isFinite(n)) continue;
  const ya = porMedicion.get(c.measurement_id) ?? new Map();
  ya.set(c.variable_name, n);
  porMedicion.set(c.measurement_id, ya);
}
function huellaDe(measurementId) {
  const m = porMedicion.get(measurementId);
  if (!m) return null;
  const partes = [];
  for (const v of VARIABLES) {
    const n = m.get(v);
    if (n === undefined) return null;
    partes.push(String(n));
  }
  return partes.join("|");
}

// ── LOS GRUPOS, SOLO ENTRE VIGENTES ─────────────────────────────────────────────────────────────────
const porHuella = new Map();
for (const med of mediciones) {
  const ev = vigentes.get(med.evaluation_id);
  if (!ev) continue;
  const h = huellaDe(med.id);
  if (h === null) continue;
  const ya = porHuella.get(h) ?? [];
  ya.push({ measurementId: med.id, ev, marcada: med.no_es_del_paciente_at !== null });
  porHuella.set(h, ya);
}

const grupos = [...porHuella.entries()].filter(([, filas]) => {
  // DOS EVALUACIONES DISTINTAS, no dos mediciones de la misma: una evaluacion con dos tomas identicas es
  // otra cosa (y hoy no pasa), y contarla aqui inflaria el hallazgo.
  const evs = new Set(filas.map((f) => f.ev.id));
  return evs.size > 1;
});

// ── QUE PACIENTES VIENEN DE UNA CUENTA DE SMOKE TODAVIA SIN MARCAR ──────────────────────────────────
//
// Hace falta para cuadrar esta medicion con la del 24 de octubre, que dio 10 grupos y 4 cruzados. La
// diferencia no es un hallazgo nuevo: son los tres pacientes de smoke que Gildardo encontro contando como
// reales. Marcarlos devuelve esta cuenta a su lista. Sin esta columna, el 11 y el 5 se leen como que
// aparecieron grupos nuevos.
const perfiles = await todasLasFilas(
  db,
  "professional_profiles",
  "id, is_test, profiles!profile_id(full_name)",
);
const cuentasDeSmoke = new Set(
  perfiles
    .filter((p) => p.is_test || /prueba|demo|test/i.test(p.profiles?.full_name ?? ""))
    .map((p) => p.id),
);
const relaciones = await todasLasFilas(
  db,
  "patient_professional_relationships",
  "patient_id, professional_id, status",
  (q) => q.eq("status", "active"),
);
const pacienteDeSmoke = new Set(
  relaciones.filter((r) => cuentasDeSmoke.has(r.professional_id)).map((r) => r.patient_id),
);

console.log("LOS GRUPOS DE HUELLA REPETIDA ENTRE EVALUACIONES VIGENTES");
console.log(`  universo: ${vigentes.size} evaluaciones vigentes de pacientes reales`);
console.log(`  mediciones con huella completa: ${[...porMedicion.keys()].filter((id) => huellaDe(id) !== null).length}`);
console.log(`  grupos: ${grupos.length}`);

const evaluacionesFuera = new Set();
const pacientesTocados = new Set();
let mismoPaciente = 0;
let entrePacientes = 0;
for (const [, filas] of grupos) {
  const evs = [...new Set(filas.map((f) => f.ev.id))];
  const pacs = new Set(filas.map((f) => f.ev.patient_id));
  for (const id of evs) evaluacionesFuera.add(id);
  for (const p of pacs) pacientesTocados.add(p);
  if (pacs.size > 1) entrePacientes++;
  else mismoPaciente++;
  const smoke = [...pacs].filter((p) => pacienteDeSmoke.has(p)).length;
  console.log(
    `    grupo: ${evs.length} evaluaciones · ${pacs.size} paciente(s) ${pacs.size > 1 ? "DISTINTOS" : "        "} · ` +
      (smoke > 0 ? `${smoke} de cuenta de SMOKE · ` : "") +
      evs.map((id) => id.slice(0, 8)).join(" "),
  );
}
const gruposSinSmoke = grupos.filter(
  ([, filas]) => ![...new Set(filas.map((f) => f.ev.patient_id))].some((p) => pacienteDeSmoke.has(p)),
);
console.log(`\n  grupos que NO tocan ninguna cuenta de smoke: ${gruposSinSmoke.length}`);
console.log(`\n  grupos ENTRE PACIENTES DISTINTOS: ${entrePacientes}`);
console.log(`  grupos DENTRO del mismo paciente:  ${mismoPaciente}`);
console.log(`  evaluaciones que saldrian:          ${evaluacionesFuera.size}`);
console.log(`  pacientes afectados:                ${pacientesTocados.size}`);

// ── Y CUANTO DE ESO ESTABA EN LA COHORTE AUTORIZADA ─────────────────────────────────────────────────
const consentimientos = await todasLasFilas(db, "patient_consents", "patient_id, consent_type, revoked_at");
const autorizados = new Set(
  consentimientos
    .filter((c) => c.consent_type === "investigacion" && c.revoked_at === null)
    .map((c) => c.patient_id),
);
const enLaCohorte = [...evaluacionesFuera].filter((id) => autorizados.has(vigentes.get(id).patient_id));
console.log(`\n  DE ESAS, LAS QUE HOY ESTAN EN LA COHORTE AUTORIZADA: ${enLaCohorte.length}`);
console.log(`  la cohorte pasaria de ${[...vigentes.values()].filter((e) => autorizados.has(e.patient_id)).length} a ${[...vigentes.values()].filter((e) => autorizados.has(e.patient_id)).length - enLaCohorte.length}`);

console.log("\nListo. Nada se escribio.\n");
