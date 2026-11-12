// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE LE QUEDO A UNA CONSULTA DESPUES DE UN GUARDADO QUE FALLO  ·  SOLO LECTURA  ·  2026-11-11
//
// COMO SE CORRE (acepta el id completo o el prefijo de 8 que imprime Sentry):
//
//   node --env-file=.env.production.local scripts/revisar-respuestas-de-la-consulta.mjs <id> [mas ids...]
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
//
// ── CORREGIDO EL 2026-11-12, Y LA CAUSA MERECE QUEDAR ESCRITA ──────────────────────────────────────
// La primera version buscaba la consulta con `.like("id", prefijo + "%")`. En Postgres `id` es `uuid`, y
// LIKE no existe para uuid: la base responde `operator does not exist: uuid ~~ unknown`. El script leia
// solo `data` y tiraba el `error`, asi que un fallo de la consulta se veia igual que una consulta que no
// existe, y DECIA "NO EXISTE" sobre dos pacientes reales que si estaban. Dos arreglos, y el segundo
// importa mas que el primero:
//   · el id completo va por `.eq`, y el prefijo de 8 por un RANGO de uuid (los uuid se comparan byte a
//     byte, asi que el prefijo es un intervalo y usa el indice de la llave primaria);
//   · TODA consulta de este script lee su `error` y lo imprime. Un script de diagnostico que calla un
//     error de base da una respuesta en firme sobre una pregunta que no pudo mirar, y eso es peor que
//     no tener el script.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const PREFIJO = /^[0-9a-f]{8}$/i;
const COMPLETO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const crudos = process.argv.slice(2);
const ids = crudos.filter((a) => COMPLETO.test(a) || PREFIJO.test(a));
const malos = crudos.filter((a) => !COMPLETO.test(a) && !PREFIJO.test(a));
if (malos.length > 0) console.log(`no se entienden como id (se esperaba el uuid completo o 8 hex): ${malos.join(", ")}`);
if (ids.length === 0) {
  console.log("uso: node --env-file=.env.production.local scripts/revisar-respuestas-de-la-consulta.mjs <id> [id...]");
  process.exit(1);
}

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !LLAVE) {
  console.log("faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY: se corre con --env-file=.env.production.local");
  process.exit(1);
}
// Se imprime el host, nunca la llave: sin esto no se sabe contra que base contesto el script.
console.log(`base: ${new URL(URL_SB).host}`);

const sb = createClient(URL_SB, LLAVE, { auth: { persistSession: false } });

const vacio = (v) => v == null || String(v).trim() === "" || String(v).trim() === "[]";

// Nada de este script se cree un resultado sin mirar el error primero.
function leer(etiqueta, { data, error, count }) {
  if (error) {
    console.log(`  ! ${etiqueta}: la base respondio con error -> ${error.message}`);
    return null;
  }
  return count != null && data == null ? count : data;
}

// Un prefijo de 8 hex es un INTERVALO de uuid, porque los uuid se ordenan byte a byte.
function porId(arg) {
  const q = sb.from("evaluations").select("id, status, created_at, survey_instrument_id, retirada_at, superseded_at");
  if (COMPLETO.test(arg)) return q.eq("id", arg);
  return q
    .gte("id", `${arg}-0000-0000-0000-000000000000`)
    .lte("id", `${arg}-ffff-ffff-ffff-ffffffffffff`);
}

for (const arg of ids) {
  console.log(`\n═══ ${arg} ═══`);
  const evs = leer("buscar la consulta", await porId(arg));
  if (evs == null) continue;
  if (evs.length === 0) {
    console.log("  no hay ninguna consulta con ese id en esta base");
    continue;
  }
  if (evs.length > 1) console.log(`  ojo: el prefijo coincide con ${evs.length} consultas; se miran todas`);

  for (const ev of evs) {
    console.log(`  ── ${ev.id}`);
    console.log(
      `     estado: ${ev.status} · creada ${ev.created_at.slice(0, 16)} · instrumento ${ev.survey_instrument_id ? "CNV-S" : "linea base"}` +
        (ev.retirada_at ? " · RETIRADA" : "") +
        (ev.superseded_at ? " · REEMPLAZADA" : ""),
    );

    const resp = leer(
      "filas de respuesta",
      await sb
        .from("survey_responses")
        .select("id, survey_version_id, created_at, captured_by")
        .eq("evaluation_id", ev.id)
        .order("created_at", { ascending: false }),
    );
    if (resp == null) continue;
    console.log(
      `     filas de respuesta: ${resp.length}${resp.length > 1 ? "  ← DOS O MAS: media encuesta esta en la otra fila" : ""}`,
    );
    if (resp.length === 0) {
      console.log("     (sin fila de respuestas: la encuesta nunca se guardo)");
    }

    for (const r of resp) {
      const ans = leer(
        `respuestas de la fila ${r.id.slice(0, 8)}`,
        await sb.from("survey_answers").select("question_id, answer_value").eq("response_id", r.id),
      );
      if (ans == null) continue;
      const conValor = ans.filter((a) => !vacio(a.answer_value));
      console.log(
        `       fila ${r.id.slice(0, 8)} (${r.created_at.slice(0, 16)}, ${r.captured_by ? "la cerro el profesional" : "del paciente"}): ` +
          `${ans.length} respuestas, ${conValor.length} con valor`,
      );
      // Los campos del diagnostico de la version sellada en ESA fila.
      const dx = leer(
        "campos del diagnostico del instrumento",
        await sb
          .from("survey_questions")
          .select("id, field_key")
          .eq("survey_version_id", r.survey_version_id)
          .eq("used_in_diagnosis", true),
      );
      if (dx == null) continue;
      const porQ = new Map(ans.map((a) => [a.question_id, a.answer_value]));
      const faltan = dx.filter((q) => vacio(porQ.get(q.id)));
      console.log(
        `         campos del diagnostico: ${dx.length} · SIN RESPONDER ${faltan.length}` +
          (faltan.length ? `: ${faltan.map((q) => q.field_key).join(", ")}` : ""),
      );
    }

    const conteo = await sb.from("diagnoses").select("*", { count: "exact", head: true }).eq("evaluation_id", ev.id);
    if (conteo.error) {
      console.log(`     ! diagnosticos generados: la base respondio con error -> ${conteo.error.message}`);
    } else {
      console.log(
        `     diagnosticos generados: ${conteo.count}${conteo.count > 0 ? "  ← si faltan campos, el diagnostico salio con menos datos" : ""}`,
      );
    }
  }
}
