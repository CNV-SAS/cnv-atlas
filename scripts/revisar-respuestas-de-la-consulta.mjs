// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE LE QUEDO A UNA CONSULTA DESPUES DE UN GUARDADO QUE FALLO  ·  SOLO LECTURA  ·  2026-11-11
//
// COMO SE CORRE:
//
//   node --env-file=.env.production.local scripts/revisar-respuestas-de-la-consulta.mjs <id-de-consulta> [mas ids...]
//
// NACE DEL DEFECTO DEL 10 DE NOVIEMBRE: un guardado de avance murio con
// `duplicate key ... survey_answers_response_question_unique` y la transaccion rechazo el lote COMPLETO.
// Si eso paso en el ultimo guardado antes de enviar, a la consulta le pueden faltar respuestas, y el
// diagnostico se pudo generar sobre menos datos de los que el paciente dio.
//
// QUE MIRA, y las tres cosas importan por separado:
//
//   1. CUANTAS FILAS DE RESPUESTA tiene la consulta. Tiene que ser UNA. Dos significa que dos escrituras
//      simultaneas crearon cada una la suya, y entonces la pantalla muestra solo la mitad de lo
//      contestado SIN NINGUN ERROR;
//   2. CUANTAS RESPUESTAS tiene cada fila, y cuantas preguntas trae el instrumento sellado;
//   3. CUALES DE LOS CAMPOS DEL DIAGNOSTICO faltan. Es lo unico que cambia un veredicto: si falta alguno,
//      el diagnostico salio (o saldra) incompleto.
//
// NO IMPRIME NINGUN DATO DE PACIENTE: ni nombre, ni documento, ni el valor de ninguna respuesta. Solo
// cuentas y claves de pregunta (`field_key`), que son del instrumento y no de la persona.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const ids = process.argv.slice(2).filter((a) => /^[0-9a-f-]{8,}$/i.test(a));
if (ids.length === 0) {
  console.log("uso: node --env-file=.env.production.local scripts/revisar-respuestas-de-la-consulta.mjs <id> [id...]");
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const vacio = (v) => v == null || String(v).trim() === "" || String(v).trim() === "[]";

for (const prefijo of ids) {
  // Se acepta el prefijo corto que imprime Sentry.
  const { data: evs } = await sb
    .from("evaluations")
    .select("id, status, created_at, survey_instrument_id, retirada_at, superseded_at")
    .like("id", `${prefijo.slice(0, 8)}%`);
  const ev = (evs ?? [])[0];
  if (!ev) {
    console.log(`\n${prefijo}: NO EXISTE ninguna consulta con ese id`);
    continue;
  }
  console.log(`\n═══ ${ev.id} ═══`);
  console.log(
    `  estado: ${ev.status} · creada ${ev.created_at.slice(0, 16)} · instrumento ${ev.survey_instrument_id ? "CNV-S" : "linea base"}` +
      (ev.retirada_at ? " · RETIRADA" : "") +
      (ev.superseded_at ? " · REEMPLAZADA" : ""),
  );

  const { data: resp } = await sb
    .from("survey_responses")
    .select("id, survey_version_id, created_at, captured_by")
    .eq("evaluation_id", ev.id)
    .order("created_at", { ascending: false });
  console.log(`  filas de respuesta: ${(resp ?? []).length}${(resp ?? []).length > 1 ? "  ← DOS O MAS: media encuesta esta en la otra fila" : ""}`);
  if (!resp || resp.length === 0) {
    console.log("  (sin fila de respuestas: la encuesta nunca se guardo)");
    continue;
  }

  for (const r of resp) {
    const { data: ans } = await sb.from("survey_answers").select("question_id, answer_value").eq("response_id", r.id);
    const conValor = (ans ?? []).filter((a) => !vacio(a.answer_value));
    console.log(
      `    fila ${r.id.slice(0, 8)} (${r.created_at.slice(0, 16)}, ${r.captured_by ? "la cerro el profesional" : "del paciente"}): ` +
        `${(ans ?? []).length} respuestas, ${conValor.length} con valor`,
    );
    // Los campos del diagnostico de la version sellada en ESA fila.
    const { data: dx } = await sb
      .from("survey_questions")
      .select("id, field_key")
      .eq("survey_version_id", r.survey_version_id)
      .eq("used_in_diagnosis", true);
    const porQ = new Map((ans ?? []).map((a) => [a.question_id, a.answer_value]));
    const faltan = (dx ?? []).filter((q) => vacio(porQ.get(q.id)));
    console.log(
      `      campos del diagnostico: ${(dx ?? []).length} · SIN RESPONDER ${faltan.length}` +
        (faltan.length ? `: ${faltan.map((q) => q.field_key).join(", ")}` : ""),
    );
  }

  const { count: nDx } = await sb
    .from("diagnoses")
    .select("*", { count: "exact", head: true })
    .eq("evaluation_id", ev.id);
  console.log(`  diagnosticos generados: ${nDx}${nDx > 0 ? "  ← si faltan campos, el diagnostico salio con menos datos" : ""}`);
}
