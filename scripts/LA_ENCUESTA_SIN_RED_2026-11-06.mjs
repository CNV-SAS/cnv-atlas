// SOLO LECTURA · 2026-11-06 · ¿Se perdio la encuesta del "Failed to fetch"?
// Sentry: POST /encuesta/<token> a las 21:06:52 UTC desde un Android en Cali, con un POST anterior en 200.
// El fallo fue del GUARDADO DE AVANCE (`encuesta.guardar-sin-red`), no del envio final.
// NO IMPRIME NI UN NOMBRE: estado de la consulta y conteo de respuestas.
import { createClient } from "@supabase/supabase-js";
import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Faltan variables."); process.exit(1); }
anunciarBase(url, "la encuesta del fallo de red (SOLO LECTURA)");
const db = createClient(url, key, { auth: { persistSession: false } });

const TOKEN = "X8CVfbMG_8agIP7rIaVZuw9qyfa2hwFpKL9nvD0FilY";

const { data: ev, error: e1 } = await db
  .from("evaluations")
  .select("id, status, type, created_at, closed_at, patient_id")
  .eq("resume_token", TOKEN)
  .maybeSingle();
if (e1) throw new Error(`evaluations: ${e1.message}`);
if (!ev) {
  console.log("\nNingun `resume_token` con ese valor.");
  process.exit(0);
}
console.log(`\nConsulta ${ev.id.slice(0, 8)} · tipo ${ev.type} · estado ${ev.status}`);
console.log(`  creada ${ev.created_at} · cerrada ${ev.closed_at ?? "no"}`);

const { data: resp, error: e2 } = await db
  .from("survey_responses")
  .select("id, created_at, completed_at, survey_version_id")
  .eq("evaluation_id", ev.id);
if (e2) throw new Error(`survey_responses: ${e2.message}`);
console.log(`\nRespuestas de encuesta: ${resp?.length ?? 0}`);
for (const r of resp ?? []) {
  const { count } = await db
    .from("survey_answers")
    .select("id", { count: "exact", head: true })
    .eq("survey_response_id", r.id);
  console.log(`  creada ${r.created_at}`);
  console.log(`  completada: ${r.completed_at ?? "NO"}`);
  console.log(`  preguntas guardadas: ${count}`);
}

// CUANTAS PREGUNTAS TIENE LA ENCUESTA ACTIVA, para decir si quedo entera o a medias.
const { data: versiones } = await db
  .from("survey_versions").select("id, is_active, version_number").eq("is_active", true);
for (const v of versiones ?? []) {
  const { count } = await db
    .from("survey_questions").select("id", { count: "exact", head: true }).eq("survey_version_id", v.id);
  console.log(`\nEncuesta activa v${v.version_number}: ${count} preguntas`);
}
console.log("\nFin. Nada se escribio.");
