// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DOS DATOS PARA EL SMOKE DE SANTIAGO  ·  SOLO LECTURA  ·  2026-11-05
//
//   a) ¿Hay peticiones de eliminacion pendientes? Pidio una y no la encuentra, y hay dos explicaciones
//      posibles: que la seccion de /admin no aparezca (solo se pinta cuando hay algo) o que la peticion no
//      se haya registrado. Esto distingue las dos, que es lo unico que no se puede adivinar.
//   b) El id completo de la evaluacion que empieza por ed83ff97 (el caso de prueba de Gildardo), para
//      poder abrirla por enlace y verificar sus cifras.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO: ids, fechas, estados y la edad, que es la que hay que cotejar.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/DOS_DATOS_PARA_EL_SMOKE_2026-11-05.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "dos datos para el smoke (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// ── a · LAS PETICIONES DE ELIMINACION ────────────────────────────────────────────────────────────
console.log("\n── a · PETICIONES DE ELIMINAR UN PERFIL ──");
const { data: peticiones, error: ePet } = await db
  .from("patients")
  .select("id, eliminacion_pedida_at, eliminacion_motivo, deleted_at")
  .not("eliminacion_pedida_at", "is", null)
  .order("eliminacion_pedida_at", { ascending: false })
  .limit(20);
if (ePet) {
  console.log("  no se pudo leer: " + ePet.message);
} else if ((peticiones ?? []).length === 0) {
  console.log("  NO HAY NINGUNA. La peticion no quedo registrada: el acto no llego a la base.");
} else {
  for (const fila of peticiones) {
    const estado = fila.deleted_at ? "ya eliminado" : "PENDIENTE";
    console.log(
      "  paciente " +
        String(fila.id).slice(0, 8) +
        "  pedida " +
        String(fila.eliminacion_pedida_at).slice(0, 10) +
        "  " +
        estado,
    );
  }
  const pendientes = peticiones.filter((f) => !f.deleted_at);
  console.log("\n  PENDIENTES: " + pendientes.length);
  console.log("  Si hay pendientes, la bandeja esta en /admin y la seccion se pinta sola.");
}

// ── b · LA EVALUACION ed83ff97 ───────────────────────────────────────────────────────────────────
console.log("\n── b · LA EVALUACION QUE EMPIEZA POR ed83ff97 ──");
const { data: evs, error: eEv } = await db
  .from("evaluaciones_vigentes")
  .select("id, dia, engine_version, measurement_id, diagnosis_id, importada")
  .limit(2000);
if (eEv) {
  console.log(`  no se pudo leer la vista: ${eEv.message}`);
} else {
  const halladas = (evs ?? []).filter((e) => String(e.id).startsWith("ed83ff97"));
  if (halladas.length === 0) {
    console.log("  no aparece en las vigentes; puede estar reemplazada o retirada.");
    const { data: todas } = await db.from("evaluations").select("id, created_at").limit(2000);
    const sueltas = (todas ?? []).filter((e) => String(e.id).startsWith("ed83ff97"));
    for (const e of sueltas) {
      console.log(`  (en evaluations) ${e.id}   creada ${String(e.created_at).slice(0, 10)}`);
    }
  }
  for (const e of halladas) {
    console.log(`  ${e.id}`);
    console.log(`  https://atlas.cnvsystem.com/ani-bis-e/${e.id}`);
    console.log(
      `  dia ${e.dia ?? "(sin fecha)"} · motor ${e.engine_version ?? "(sin diagnostico)"} · medicion ${e.measurement_id ? "si" : "no"}`,
    );
    // LAS DOS CIFRAS QUE HAY QUE COTEJAR, del snapshot sellado. Se imprimen para no tener que abrirla.
    const { data: diag } = await db
      .from("diagnoses")
      .select("engine_output, created_at")
      .eq("evaluation_id", e.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const out = diag?.engine_output ?? null;
    const eb = out?.indices?.EB_BIS ?? out?.EB_BIS ?? null;
    const iae = out?.indices?.IAE ?? out?.IAE ?? null;
    console.log(`  EB-BIS sellada: ${eb ?? "(no esta en el snapshot)"} · IAE: ${iae ?? "(no esta)"}`);
  }
}
