// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE LE QUEDO A UNA CONSULTA DE SEGUIMIENTO  ·  SOLO LECTURA  ·  2026-11-15
//
// COMO SE CORRE (acepta el id completo o el prefijo de 8):
//
//   node --env-file=.env.production.local scripts/repasar-el-seguimiento.mjs <id> [mas ids...]
//
// PARA QUE: Santiago pidio revisar como quedo la consulta de seguimiento del smoke (*"Módulo S, tarjeta
// de respuesta, informe de dos hojas"*) y decir si algo no cuadra. Las tres piezas que mira son las que
// de verdad se pueden mirar desde fuera, y cada una tiene un modo propio de fallar en silencio:
//
//   1. EL MODULO S: sus siete respuestas estan GUARDADAS y VISIBLES. Viven en su propia version de la
//      encuesta, y los lectores que enumeran POR VERSION no las ven: ese fue el defecto del 8 de
//      noviembre (el paciente las contesta, la base las tiene, y ninguna pantalla las muestra). Aqui se
//      cuentan contra las siete, y se dice cuales FALTAN y cuales NO SE PRESENTARON (que no es lo mismo:
//      el S1 y el S2 pueden no aplicar, su §2.3 y la decision 34).
//   2. LA COMPARABILIDAD CON LA ANTERIOR: el MAYOR del motor de los dos sellos. Si difieren, la tarjeta
//      de respuesta sale SOLO con el Modulo S y sin delta, la serie descarta el punto y el informe no
//      lleva trayectoria. Eso es correcto (`sonComparables`), pero deja un seguimiento que se ve a medias
//      y hay que saber por que antes de leerlo como un defecto.
//   3. EL INFORME: cuantos hay, en que estado, y si trae trayectoria sellada.
//
// NO IMPRIME NINGUN DATO DE PACIENTE: ni nombre, ni documento, ni el VALOR de ninguna respuesta. Solo
// cuentas, claves de pregunta (`field_key`, que son del instrumento y no de la persona), versiones del
// motor y fechas.
//
// Y TODA CONSULTA LEE SU `error` Y LO IMPRIME. Es la leccion del 12 de noviembre: un script de
// diagnostico que calla un error de base da una respuesta en firme sobre algo que no pudo mirar, y eso es
// peor que no tener el script. Tambien: `id` es `uuid`, asi que un prefijo va por RANGO y nunca por LIKE
// (LIKE no existe para uuid y la base responde `operator does not exist: uuid ~~ unknown`).
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const PREFIJO = /^[0-9a-f]{8}$/i;
const COMPLETO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las siete preguntas PROPIAS de la CNV-S. La lista vive en `modules/followups/modulo-s.ts`. */
const CLAVES_DEL_MODULO_S = [
  "cnvs_s1",
  "cnvs_s2",
  "cnvs_s3",
  "cnvs_s4",
  "cnvs_s5",
  "cnvs_s6",
  "cnvs_gi_filtro",
];

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !LLAVE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}
const sb = createClient(URL_SB, LLAVE, { auth: { persistSession: false } });

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Uso: node --env-file=.env.production.local scripts/repasar-el-seguimiento.mjs <id> [...]");
  process.exit(1);
}

// El host, nunca la llave: hace falta saber contra que base corrio, y nada mas.
console.log(`base: ${new URL(URL_SB).host}`);

/** Lee un resultado de PostgREST diciendo en voz alta si fallo. `null` = no se pudo mirar. */
function leer(etiqueta, { data, error }) {
  if (error) {
    console.log(`  ! ${etiqueta}: la base respondio con error -> ${error.message}`);
    return null;
  }
  return data;
}

/** El MAYOR del motor, con las dos grafias que conviven en produccion (`1.0.0`, `anibise-1.4.0`). */
const mayorDelMotor = (v) => {
  const m = /(\d+)\.\d+\.\d+/.exec(String(v ?? ""));
  return m ? m[1] : null;
};

/** Filtra por id completo (`eq`) o por prefijo de 8 (RANGO de uuid, que usa el indice). */
function porId(q, arg) {
  if (COMPLETO.test(arg)) return q.eq("id", arg);
  return q
    .gte("id", `${arg}-0000-0000-0000-000000000000`)
    .lte("id", `${arg}-ffff-ffff-ffff-ffffffffffff`);
}

for (const arg of args) {
  console.log(`\n══ ${arg} ══`);
  if (!COMPLETO.test(arg) && !PREFIJO.test(arg)) {
    console.log("  ! no parece un id ni un prefijo de 8 caracteres hexadecimales. Se salta.");
    continue;
  }

  const evs = leer(
    "consulta",
    await porId(
      sb
        .from("evaluations")
        .select("id, patient_id, type, status, created_at, survey_instrument_id, superseded_at, retirada_at"),
      arg,
    ),
  );
  if (evs == null) continue;
  if (evs.length === 0) {
    console.log("  NO EXISTE ninguna consulta con ese id en esta base.");
    continue;
  }
  if (evs.length > 1) console.log(`  ! el prefijo casa con ${evs.length} consultas; se revisan todas.`);

  for (const ev of evs) {
    console.log(`\n  consulta ${ev.id}`);
    console.log(
      `    tipo ${ev.type} · estado ${ev.status} · creada ${String(ev.created_at).slice(0, 10)}` +
        `${ev.superseded_at ? " · REEMPLAZADA" : ""}${ev.retirada_at ? " · RETIRADA" : ""}`,
    );

    // ── 1 · EL INSTRUMENTO QUE SE LE APLICO ──
    const esCnvs = Boolean(ev.survey_instrument_id);
    if (!esCnvs) {
      console.log("    instrumento: NINGUNO sellado -> se le aplico la LINEA BASE, no la CNV-S.");
    } else {
      const inst = leer(
        "instrumento",
        await sb
          .from("survey_instruments")
          .select("codigo, nombre")
          .eq("id", ev.survey_instrument_id)
          .limit(1),
      );
      console.log(`    instrumento sellado: ${inst?.[0]?.codigo ?? "(no se pudo leer)"}`);
    }

    // ── 2 · EL MODULO S: GUARDADO Y VISIBLE ──
    const resp = leer(
      "respuestas",
      await sb
        .from("survey_responses")
        .select("id, created_at, survey_version_id")
        .eq("evaluation_id", ev.id)
        .order("created_at", { ascending: false }),
    );
    if (resp == null) continue;
    if (resp.length === 0) {
      console.log("    encuesta: SIN NINGUNA fila de respuesta.");
    } else {
      if (resp.length > 1) {
        console.log(`    ! ${resp.length} filas de respuesta. Tiene que haber UNA: dos escrituras`);
        console.log("      simultaneas crearon cada una la suya, y la pantalla muestra solo una mitad.");
      }
      const vigente = resp[0];
      // SOLO SI SE LE APLICO LA CNV-S. En la linea base el Modulo S no existe, y decir "0 de 7" seria
      // inventar un hueco: es la misma distincion entre IMPOSIBLE y PENDIENTE que cuida el cierre.
      const filas = !esCnvs ? [] : leer(
        "respuestas del Modulo S",
        await sb
          .from("survey_answers")
          .select("answer_value, survey_questions!inner(field_key)")
          .eq("response_id", vigente.id)
          .in("survey_questions.field_key", CLAVES_DEL_MODULO_S),
      );
      if (!esCnvs) {
        console.log("    Modulo S: no aplica (linea base).");
      } else if (filas != null) {
        // CON VALOR, no solo con fila: una fila vacia es "sin responder" y contarla como respondida es
        // justo el error que el gate de completitud existe para no cometer.
        const conValor = new Set(
          filas
            .filter((f) => String(f.answer_value ?? "").trim() !== "" && String(f.answer_value).trim() !== "[]")
            .map((f) => f.survey_questions?.field_key)
            .filter(Boolean),
        );
        const sinValor = CLAVES_DEL_MODULO_S.filter((k) => !conValor.has(k));
        console.log(`    Modulo S: ${conValor.size} de 7 con respuesta -> ${[...conValor].join(", ") || "(ninguna)"}`);
        if (sinValor.length > 0) {
          console.log(`      sin respuesta: ${sinValor.join(", ")}`);
          console.log("      OJO: el S1 y el S2 pueden no haberse PRESENTADO (su §2.3 y la decision 34),");
          console.log("      y entonces estar vacios es lo correcto, no un hueco.");
        }
      }
    }

    // ── 3 · LA COMPARABILIDAD CON LA ANTERIOR ──
    const dgs = leer(
      "diagnosticos de esta consulta",
      await sb
        .from("diagnoses")
        .select("id, engine_version, created_at")
        .eq("evaluation_id", ev.id)
        .order("created_at", { ascending: false }),
    );
    const motorDeHoy = dgs?.[0]?.engine_version ?? null;
    console.log(`    motor de ESTA consulta: ${motorDeHoy ?? "(sin diagnostico)"}`);

    const previas = leer(
      "consultas anteriores del paciente",
      await sb
        .from("evaluations")
        .select("id, created_at")
        .eq("patient_id", ev.patient_id)
        .is("superseded_at", null)
        .is("retirada_at", null)
        .in("status", ["draft", "in_progress", "completed"])
        .neq("id", ev.id)
        .lt("created_at", ev.created_at)
        .order("created_at", { ascending: false })
        .limit(5),
    );
    if (previas != null && previas.length > 0) {
      const dgPrev = leer(
        "diagnosticos de la anterior",
        await sb
          .from("diagnoses")
          .select("evaluation_id, engine_version, created_at")
          .in(
            "evaluation_id",
            previas.map((p) => p.id),
          )
          .order("created_at", { ascending: false }),
      );
      const motorDe = new Map();
      for (const d of dgPrev ?? []) if (!motorDe.has(d.evaluation_id)) motorDe.set(d.evaluation_id, d.engine_version);
      const anterior = previas[0];
      const motorAnterior = motorDe.get(anterior.id) ?? null;
      console.log(
        `    anterior ${anterior.id.slice(0, 8)} del ${String(anterior.created_at).slice(0, 10)} · motor ${motorAnterior ?? "(sin diagnostico)"}`,
      );
      const ma = mayorDelMotor(motorDeHoy);
      const mb = mayorDelMotor(motorAnterior);
      if (ma != null && mb != null && ma === mb) {
        console.log("    comparables (mismo MAYOR): la tarjeta de respuesta y el informe SI restan.");
      } else if (ma == null || mb == null) {
        console.log("    NO SE PUEDE DECIR: a una de las dos le falta el diagnostico que sella la version.");
        console.log("      Sin version no se resta (es la puerta de `sonComparables`): callar es lo correcto.");
      } else {
        console.log(`    NO COMPARABLES: MAYOR ${mb} contra ${ma}.`);
        console.log("      CONSECUENCIA, y es correcta: la tarjeta de respuesta sale solo con el Modulo S y");
        console.log("      sin delta, la serie descarta el punto y el informe no lleva trayectoria. Un");
        console.log("      seguimiento asi se VE a medias sin estar mal. Se arregla recalculando el");
        console.log("      historico, no tocando la tarjeta.");
      }
    } else {
      console.log("    sin ninguna consulta anterior vigente que haya ocurrido: no hay con que comparar.");
    }

    // ── 4 · EL INFORME ──
    const reps = leer(
      "informes",
      await sb
        .from("reports")
        .select("id, type, status, created_at, trajectory")
        .eq("evaluation_id", ev.id)
        .order("created_at", { ascending: false }),
    );
    if (reps != null) {
      if (reps.length === 0) console.log("    informe: NINGUNO.");
      for (const r of reps) {
        console.log(
          `    informe ${r.type} · ${r.status} · ${String(r.created_at).slice(0, 10)}` +
            ` · trayectoria ${r.trajectory == null ? "NO sellada" : "sellada"}`,
        );
      }
      if (reps.length > 1) {
        console.log("      (varios informes = reemisiones; el VIGENTE es el mas reciente)");
      }
    }
  }
}

console.log("\nFin. Nada se escribio.");
