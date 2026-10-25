// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL GRUPO 3: CUAL DE LAS DOS SE IMPORTO PRIMERO  ·  SOLO LECTURA  ·  2026-10-25
//
// ═══ DE DONDE SALE ═══
//
// Gildardo, 2026-10-25: *"El Biody de Andres Diaz (paciente real de Angela, 24-sep) tambien esta en un
// seguimiento de 'Paciente Prueba Uno' (Profesional Demo). Dime cual se importo primero."*
//
// ═══ POR QUE LA PREGUNTA NO ES RETORICA ═══
//
// De cual se importo primero depende QUE PASO:
//
//   · Si primero el del paciente REAL: alguien reuso ese archivo para probar. Es un error de PROCESO en
//     el smoke, no un error clinico, y lo que hay que arreglar es el proceso (y marcar la copia).
//   · Si primero el de PRUEBA: el archivo entro al sistema por la cuenta de prueba y despues se le colgo
//     al paciente real, que es un incidente de datos de salud y se mira al contrario.
//
// Y la fecha de CREACION no es la de la MEDICION: la toma fisica ocurrio una vez, y las dos filas la
// llevan igual. Lo que distingue el orden es `created_at`, que es cuando cada una entro a Atlas.
//
// NO IMPRIME DATOS DE PACIENTE mas que los nombres que Gildardo ya nombro en su mensaje, y sin documento
// ni fecha de nacimiento.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/CUAL_SE_IMPORTO_PRIMERO_EL_GRUPO_3_2026-10-25.mjs
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
anunciarBase(url, "busca el grupo con el archivo real en una cuenta de prueba (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

const VARIABLES = [
  "Extracellular resistance",
  "Intracellular resistance Ω",
  "Infinite resistance",
  "Membrane capacitance nF",
];

const crudos = await todasLasFilas(db, "bis_raw_values", "measurement_id, variable_name, value", (q) =>
  q.in("variable_name", VARIABLES),
);
const porMedicion = new Map();
for (const c of crudos) {
  const n = Number(c.value);
  if (!Number.isFinite(n)) continue;
  const ya = porMedicion.get(c.measurement_id) ?? new Map();
  ya.set(c.variable_name, n);
  porMedicion.set(c.measurement_id, ya);
}
const huellaDe = (id) => {
  const m = porMedicion.get(id);
  if (!m) return null;
  const partes = [];
  for (const v of VARIABLES) {
    const n = m.get(v);
    if (n === undefined) return null;
    partes.push(String(n));
  }
  return partes.join("|");
};

const mediciones = await todasLasFilas(
  db,
  "bis_measurements",
  "id, evaluation_id, measurement_date, created_at, no_es_del_paciente_at, import_batch_id",
);
const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, professional_id, type, status, created_at, superseded_at, retirada_at, import_batch_id",
);
const porEvaluacion = new Map(evaluaciones.map((e) => [e.id, e]));
const pacientes = await todasLasFilas(db, "patients", "id, cuenta_como_de_prueba, is_test");
const fichas = await todasLasFilas(db, "patient_profiles", "patient_id, first_name, last_name");
const nombreDe = new Map(
  fichas.map((f) => [f.patient_id, `${f.first_name ?? ""} ${f.last_name ?? ""}`.trim() || "(sin nombre)"]),
);
const dePrueba = new Map(pacientes.map((p) => [p.id, Boolean(p.cuenta_como_de_prueba)]));
const perfiles = await todasLasFilas(
  db,
  "professional_profiles",
  "id, is_test, profiles!profile_id(full_name)",
);
const profesionalDe = new Map(perfiles.map((p) => [p.id, p.profiles?.full_name ?? p.id]));

// ── TODOS LOS GRUPOS, SIN FILTRAR POR VIGENCIA NI POR PRUEBA ────────────────────────────────────────
//
// A proposito: el que Gildardo busca MEZCLA un paciente real con uno de prueba, asi que cualquier filtro
// de "pacientes reales" lo esconderia. Es justo el grupo que la exclusion de la 0230 NO toca, porque solo
// una de las dos evaluaciones es vigente-y-real.
const porHuella = new Map();
for (const m of mediciones) {
  const h = huellaDe(m.id);
  if (h === null) continue;
  const ya = porHuella.get(h) ?? [];
  ya.push(m);
  porHuella.set(h, ya);
}

const grupos = [...porHuella.entries()]
  .map(([h, ms]) => ({ h, ms }))
  .filter((g) => new Set(g.ms.map((m) => m.evaluation_id)).size > 1);

console.log(`GRUPOS DE HUELLA REPETIDA EN TODA LA BASE (sin filtros): ${grupos.length}\n`);

let mixtos = 0;
for (const g of grupos) {
  const filas = g.ms
    .map((m) => ({ m, e: porEvaluacion.get(m.evaluation_id) }))
    .filter((x) => x.e)
    .sort((a, b) => String(a.m.created_at).localeCompare(String(b.m.created_at)));
  const hayPrueba = filas.some((x) => dePrueba.get(x.e.patient_id));
  const hayReal = filas.some((x) => !dePrueba.get(x.e.patient_id));
  if (!(hayPrueba && hayReal)) continue;
  mixtos++;
  console.log(`── GRUPO MIXTO (un paciente de prueba y uno real) ──`);
  for (const [i, x] of filas.entries()) {
    const prueba = dePrueba.get(x.e.patient_id) ? "DE PRUEBA" : "REAL     ";
    console.log(
      `  ${i + 1}. ${prueba}  ${nombreDe.get(x.e.patient_id)}\n` +
        `       profesional: ${profesionalDe.get(x.e.professional_id)}\n` +
        `       consulta ${x.e.type} · estado ${x.e.status}` +
        `${x.e.superseded_at ? " · REEMPLAZADA" : ""}${x.e.retirada_at ? " · RETIRADA" : ""}` +
        `${x.e.import_batch_id ? " · con lote del HTML" : ""}\n` +
        `       medicion creada en Atlas: ${x.m.created_at}\n` +
        `       fecha de la toma:         ${x.m.measurement_date}\n` +
        `       procedencia de la medicion: ${x.m.import_batch_id ? "lote " + String(x.m.import_batch_id).slice(0, 8) : "importado a mano"}` +
        `${x.m.no_es_del_paciente_at ? " · YA MARCADA como de otro paciente" : ""}\n` +
        `       evaluacion ${x.e.id}  ·  medicion ${x.m.id}`,
    );
  }
  const [primera] = filas;
  console.log(
    `  >> SE IMPORTO PRIMERO la del paciente ${dePrueba.get(primera.e.patient_id) ? "DE PRUEBA" : "REAL"}` +
      ` (${nombreDe.get(primera.e.patient_id)}), el ${String(primera.m.created_at).slice(0, 19)}\n`,
  );
}
console.log(`grupos mixtos (prueba + real): ${mixtos}`);
console.log("\nListo. Nada se escribio.\n");
