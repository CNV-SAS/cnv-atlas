// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL LECTOR DEL TRATAMIENTO SE PASA DEL TIEMPO  ·  SOLO LECTURA  ·  2026-11-04
//
// ═══ EL CASO (Sentry, 2026-11-03 20:54 UTC, 13 eventos, Unhandled, ESCALATING) ═══
//
//   treatment-reader: treatments: canceling statement due to statement timeout
//   GET /ani-bis-e/[id]?etapa=tratamiento
//
// Y en los breadcrumbs de ese mismo evento, 70 ms ANTES, un 400 sobre la misma tabla:
//
//   GET /rest/v1/treatments?select=protocol_snapshot,diagnoses!inner(evaluation_id)
//       &diagnoses.evaluation_id=eq.<id>&protocol_snapshot=not.is.null&limit=1
//
// Ese 400 es el MISMO timeout: PostgREST devuelve 400 cuando Postgres cancela por tiempo. O sea que no
// son dos defectos, es UNO que se asoma dos veces, y el segundo NADIE LO LEE (`reports-repository` tira
// el error y deja `conPlan: false`, asi que la tarjeta nunca ofrece el plan y no se queja).
//
// ═══ LA HIPOTESIS QUE SE MIDE ═══
//
// Las dos consultas filtran `treatments` POR UNA COLUMNA DE LA TABLA EMBEBIDA
// (`.eq("diagnoses.evaluation_id", ...)`). PostgREST mete ese filtro DENTRO del lateral, asi que el
// filtro no acota el barrido de `treatments`: se recorren TODAS sus filas, y cada una paga su policy
// (`treatments_select`, que a su vez hace diagnoses -> evaluations -> is_patient_professional) mas el
// lateral a `diagnoses` con la suya.
//
// LA ALTERNATIVA es la de dos pasos: los ids de diagnostico de ESA evaluacion (indice por
// `evaluation_id`, una a tres filas) y despues `treatments` con `.in("diagnosis_id", ids)`, que usa el
// indice y evalua la RLS solo sobre las filas que de verdad importan.
//
// ═══ QUE IMPRIME, Y QUE NO ═══
//
// La medicion es DIFERENCIAL en lo que se puede medir desde aqui: con `service_role` (sin RLS) las dos
// formas, sobre las MISMAS evaluaciones. Si la forma de dos pasos ya gana SIN RLS, con RLS gana por mucho
// mas, porque la RLS multiplica por filas recorridas. La prueba del lado `authenticated` esta en Sentry.
//
// NO IMPRIME NI UN DATO DE PACIENTE: cuenta filas y mide milisegundos.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/CUANTO_TARDA_EL_TRATAMIENTO_POR_EVALUACION_2026-11-04.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "mide el lector del tratamiento por evaluacion (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

const COLUMNAS =
  "id, status, reopened_at, reopen_reason, kcal_objetivo, proteina_g, restricciones, objetivo_texto, intercambio_porciones, tiempos, tiempos_activos, menu_semanal, nutraceutical_decision, nutraceutical_decision_reason, nutraceutical_decision_note, nutraceutical_decision_at, sin_prescripcion_motivo, sin_prescripcion_at, protocol_suggested, adj_geb, adj_pal, adj_kcal_obj, adj_prot_gkg, adj_fat_pct, adj_deficit";

async function cronometrar(fn) {
  const t0 = performance.now();
  const r = await fn();
  return { ms: Math.round(performance.now() - t0), r };
}

// ── 0. El tamaño de lo que se recorre ────────────────────────────────────────────────────────────
const { count: nTrat } = await db.from("treatments").select("id", { count: "exact", head: true });
const { count: nDiag } = await db.from("diagnoses").select("id", { count: "exact", head: true });
console.log(`\nFilas: treatments ${nTrat} · diagnoses ${nDiag}`);
console.log(
  "Con el filtro dentro del lateral, el barrido es sobre las " +
    nTrat +
    " de treatments, no sobre la que se busca.\n",
);

// ── 1. Las evaluaciones de prueba: las que SI tienen tratamiento ─────────────────────────────────
const { data: conTrat } = await db
  .from("treatments")
  .select("diagnosis_id, diagnoses!inner(evaluation_id)")
  .limit(12);
const ids = [...new Set((conTrat ?? []).map((t) => t.diagnoses?.evaluation_id).filter(Boolean))];
if (ids.length === 0) {
  console.error("No hay tratamientos con diagnostico; no hay nada que medir.");
  process.exit(1);
}

// ── 2. Las dos formas, sobre las mismas evaluaciones ─────────────────────────────────────────────
console.log("por evaluacion   embebida(ms)  dos pasos(ms)  invertida(ms)   mismo resultado");
let sumaEmbed = 0;
let sumaDos = 0;
let sumaInv = 0;
let discrepanInv = 0;
let discrepan = 0;
for (const evaluationId of ids) {
  const a = await cronometrar(() =>
    db
      .from("treatments")
      .select(`${COLUMNAS}, diagnoses!inner(evaluation_id)`)
      .eq("diagnoses.evaluation_id", evaluationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  const b = await cronometrar(async () => {
    const { data: diags } = await db
      .from("diagnoses")
      .select("id")
      .eq("evaluation_id", evaluationId);
    const idsDiag = (diags ?? []).map((d) => d.id);
    if (idsDiag.length === 0) return { data: null, error: null };
    return db
      .from("treatments")
      .select(COLUMNAS)
      .in("diagnosis_id", idsDiag)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  });
  const c = await cronometrar(() =>
    db
      .from('diagnoses')
      .select('id, treatments!inner(created_at, ' + COLUMNAS + ')')
      .eq('evaluation_id', evaluationId),
  );
  const planos = (c.r.data ?? []).flatMap((d) => d.treatments ?? []);
  planos.sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  const elegido = planos[0] ?? null;
  sumaInv += c.ms;
  const mismoInv = (a.r.data?.id ?? null) === (elegido?.id ?? null);
  if (!mismoInv) discrepanInv++;
  sumaEmbed += a.ms;
  sumaDos += b.ms;
  const mismo = (a.r.data?.id ?? null) === (b.r.data?.id ?? null);
  if (!mismo) discrepan++;
  console.log(
    `${evaluationId.slice(0, 8)}        ${String(a.ms).padStart(8)}      ${String(b.ms).padStart(8)}   ${String(c.ms).padStart(8)}        ${mismo && mismoInv ? "si" : "NO"}`,
  );
}

console.log(
  `\nMedia sobre ${ids.length} evaluaciones: embebida ${Math.round(sumaEmbed / ids.length)} ms · dos pasos ${Math.round(sumaDos / ids.length)} ms · invertida ${Math.round(sumaInv / ids.length)} ms`,
);
console.log(
  discrepan === 0 && discrepanInv === 0
    ? "Las dos formas devuelven EL MISMO tratamiento en todas. La de dos pasos no cambia la semantica."
    : `OJO: ${discrepan} de dos pasos y ${discrepanInv} invertidas discrepan. El cambio NO es inerte y hay que mirarlo antes de tocar nada.`,
);
