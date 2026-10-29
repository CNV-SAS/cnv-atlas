// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CUATRO REEMITIDAS DE LA TANDA (a)  ·  SOLO LECTURA  ·  2026-10-29
//
// ═══ DE DONDE SALE (Santiago, 2026-10-29) ═══
//
// *"NO SE CORREN MAS TANDAS HASTA QUE ESTO ESTE ARREGLADO Y VERIFICADO EN LAS CUATRO."*
//
// El arreglo cambio la FORMA de buscar el tratamiento: antes se resolvia el diagnostico vigente y se
// buscaba el tratamiento de ESE diagnostico; ahora se sube del tratamiento a su diagnostico filtrando por
// la EVALUACION. Este script corre LAS DOS consultas contra la base real sobre las cuatro evaluaciones y
// compara: la vieja tiene que dar cero y la nueva tiene que encontrar el tratamiento.
//
// POR QUE LAS DOS Y NO SOLO LA NUEVA: una verificacion que solo corre el camino arreglado dice "funciona"
// sin demostrar que ESTE era el defecto. Correr las dos sobre la misma fila es lo que convierte la
// hipotesis en medicion.
//
// ═══ Y SE MIRA LO QUE LA PRIMERA TANDA DEJO A MEDIAS ═══
//
// Las cuatro se reemitieron ANTES de que el arreglo existiera, asi que sus filas nuevas de `reports`
// nacieron sin la banda de trayectoria copiada. Aqui se mide si eso dejo algo que reparar: si la
// evaluacion es inicial no hay banda que perder (la banda compara contra una EB anterior y no hay), y si
// es seguimiento con banda sellada, hay que reponerla. El script NO escribe: solo dice cuales.
//
// NO IMPRIME DATOS DE PACIENTE: ids cortos, tipo de consulta y conteos.
//
// COMO SE CORRE:
//   node --env-file=.env.production.local scripts/VERIFICAR_LAS_CUATRO_REEMITIDAS_2026-10-29.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "verifica las cuatro reemitidas de la tanda (a) (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// Las cuatro de la tanda (a), elegidas por el script del 29 y corridas por Santiago en /admin/recalibracion.
const LAS_CUATRO = [
  "0172b849-fed6-4e94-ba69-a255a530fea6",
  "00fb3e1d-08ef-4701-b76b-2bc28ca212f1",
  "02fedcfc-7470-47fc-8b87-98ac79f13cef",
  "1d6d5f51-19de-4429-89ca-803d6168dd51",
];

const corto = (id) => String(id).slice(0, 8);

let todasBien = true;
let aReponer = 0;

for (const evaluationId of LAS_CUATRO) {
  const { data: ev, error: eErr } = await db
    .from("evaluations")
    .select("id, type")
    .eq("id", evaluationId)
    .maybeSingle();
  if (eErr) throw new Error(`evaluations: ${eErr.message}`);
  if (!ev) {
    console.log(`${corto(evaluationId)}  NO EXISTE`);
    todasBien = false;
    continue;
  }

  // Todos los diagnosticos de la evaluacion, del mas nuevo al mas viejo. El vigente es la primera fila
  // (el mecanismo de la casa: lo vigente es la ultima fila escrita).
  const { data: dxs, error: dErr } = await db
    .from("diagnoses")
    .select("id, engine_version, created_at")
    .eq("evaluation_id", evaluationId)
    .order("created_at", { ascending: false });
  if (dErr) throw new Error(`diagnoses: ${dErr.message}`);
  const vigente = dxs?.[0] ?? null;

  // ── EL CAMINO VIEJO: el tratamiento del diagnostico VIGENTE ──────────────────────────────────────
  const { data: viejo, error: vErr } = await db
    .from("treatments")
    .select("id")
    .eq("diagnosis_id", vigente?.id ?? "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false })
    .limit(1);
  if (vErr) throw new Error(`treatments (viejo): ${vErr.message}`);

  // ── EL CAMINO NUEVO: el tratamiento de la EVALUACION ─────────────────────────────────────────────
  const { data: nuevo, error: nErr } = await db
    .from("treatments")
    .select("id, status, proxima_cita, diagnoses!inner(evaluation_id)")
    .eq("diagnoses.evaluation_id", evaluationId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (nErr) throw new Error(`treatments (nuevo): ${nErr.message}`);

  // ── LAS FILAS DE INFORME, para ver si la banda quedo sin copiar ──────────────────────────────────
  const { data: reps, error: rErr } = await db
    .from("reports")
    .select("id, status, trajectory, created_at")
    .eq("evaluation_id", evaluationId)
    .eq("type", "paciente")
    .order("created_at", { ascending: false });
  if (rErr) throw new Error(`reports: ${rErr.message}`);
  const vigenteInforme = reps?.[0] ?? null;
  const anteriores = (reps ?? []).slice(1);
  const bandaEnAlgunAnterior = anteriores.some((r) => r.trajectory != null);
  const bandaEnElVigente = vigenteInforme?.trajectory != null;

  const encontradoViejo = (viejo ?? []).length;
  const encontradoNuevo = (nuevo ?? []).length;
  const ok = encontradoViejo === 0 && encontradoNuevo === 1;
  if (!ok) todasBien = false;

  // La banda hay que reponerla solo si se perdio: habia una sellada en un informe anterior y el vigente
  // (la fila que nacio en la reemision) quedo sin ella.
  const hayQueReponer = bandaEnAlgunAnterior && !bandaEnElVigente;
  if (hayQueReponer) aReponer += 1;

  console.log(
    [
      corto(evaluationId),
      ev.type,
      `dx=${dxs?.length ?? 0} (vigente ${vigente?.engine_version ?? "?"})`,
      `camino viejo=${encontradoViejo}`,
      `camino nuevo=${encontradoNuevo}`,
      ok ? "ARREGLADO" : "REVISAR",
      `informes=${reps?.length ?? 0}`,
      `banda: anterior=${bandaEnAlgunAnterior ? "si" : "no"} vigente=${bandaEnElVigente ? "si" : "no"}`,
      hayQueReponer ? "REPONER BANDA" : "",
    ]
      .filter(Boolean)
      .join("  ·  "),
  );
}

console.log("");
console.log(
  todasBien
    ? "LAS CUATRO: el camino viejo da cero y el nuevo encuentra el tratamiento. El defecto era ese."
    : "ALGUNA NO CUADRA: no se corren mas tandas.",
);
console.log(
  aReponer === 0
    ? "BANDA DE TRAYECTORIA: ninguna quedo sin reponer (ningun informe anterior tenia banda sellada)."
    : `BANDA DE TRAYECTORIA: ${aReponer} informe(s) nuevo(s) quedaron sin la banda que su anterior tenia.`,
);
