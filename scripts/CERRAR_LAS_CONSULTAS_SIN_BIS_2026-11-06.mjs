// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CONSULTAS SIN BIS, UNA POR UNA: QUE SE PUEDE CERRAR Y COMO  ·  SOLO LECTURA  ·  2026-11-06
//
// POR QUE: el barrido del 5 de noviembre dijo CUANTAS consultas no tienen medicion y de quien son. Esto
// responde lo siguiente, que es lo que hace falta para actuar:
//
//   1. GILDARDO · de sus consultas sin medicion, cuales son de pacientes que YA cuentan como de prueba y
//      cuales no. Las de prueba sin marcar hay que marcarlas, porque hoy ensucian las cifras y entran a
//      investigacion.
//   2. MARIA CAMILA · sus 26 no son tomas que falten: fue una actividad que se mostro solo en el Biody
//      Manager y nunca se subio. Para cerrarlas con `retirarEvaluacion` hace falta que NINGUNA tenga
//      diagnostico (el writer lo prohibe, y el trigger de la 0212 tambien). Eso se comprueba aqui.
//   3. VALENTINA · cuales fueron sus dos fallos REALES de importacion, con el detalle completo del error.
//   4. LOS ARCHIVOS EQUIVOCADOS · los intentos fallidos agrupados por CAUSA, con el texto exacto del
//      error, para poder escribir un mensaje que diga que archivo exportar en cada caso.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO DE PACIENTE: los pacientes salen con los 8 primeros caracteres
// de su id. Los nombres de los PROFESIONALES si salen, porque son con quienes Santiago va a hablar.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/CERRAR_LAS_CONSULTAS_SIN_BIS_2026-11-06.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "como cerrar las consultas sin BIS (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

/** Pagina con orden estable: sin ORDER BY cada pagina es arbitraria y el total da de mas y de menos. */
async function todas(tabla, columnas, afinar = (q) => q, orden = "id") {
  const filas = [];
  const paso = 1000;
  for (let desde = 0; ; desde += paso) {
    let q = db.from(tabla).select(columnas).order(orden, { ascending: true }).range(desde, desde + paso - 1);
    q = afinar(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if ((data ?? []).length < paso) return filas;
  }
}

const fecha = (iso) => (iso ? String(iso).slice(0, 10) : "—");

// ── LOS DATOS ────────────────────────────────────────────────────────────────────────────────────
const evals = await todas(
  "evaluations",
  "id, patient_id, professional_id, status, type, created_at, superseded_at, retirada_at, import_batch_id",
);
const pacientes = await todas("patients", "id, is_test, es_real_confirmado, cuenta_como_de_prueba");
const mediciones = await todas("bis_measurements", "evaluation_id, no_es_del_paciente_at");
const logs = await todas("bis_import_logs", "evaluation_id, status, error_detail, created_at");
const diags = await todas("diagnoses", "id, evaluation_id");
const respuestas = await todas("survey_responses", "id, evaluation_id");
const perfiles = await todas("profiles", "id, full_name, email");
const profDeProfiles = await todas("professional_profiles", "id, profile_id, is_test");

const nombrePorProfile = new Map(perfiles.map((p) => [p.id, p.full_name || p.email]));
const nombreDe = new Map(profDeProfiles.map((pp) => [pp.id, nombrePorProfile.get(pp.profile_id)]));
const pacientePorId = new Map(pacientes.map((p) => [p.id, p]));
const conMedicion = new Set(mediciones.filter((m) => !m.no_es_del_paciente_at).map((m) => m.evaluation_id));
const conDiagnostico = new Set(diags.map((d) => d.evaluation_id));
const conRespuestas = new Set(respuestas.map((r) => r.evaluation_id));

const vivas = evals.filter((e) => !e.superseded_at && !e.retirada_at);
const sinMedicion = vivas.filter((e) => !conMedicion.has(e.id));

/** Las consultas vivas sin medicion de un profesional, por su nombre. */
const deProfesional = (parte) =>
  sinMedicion.filter((e) => String(nombreDe.get(e.professional_id) ?? "").toLowerCase().includes(parte));

console.log(`\nConsultas vivas: ${vivas.length} · sin medicion: ${sinMedicion.length}`);

// ── 1 · GILDARDO: QUE ESTA MARCADO COMO DE PRUEBA Y QUE NO ───────────────────────────────────────
console.log("\n══ 1 · GILDARDO · sus consultas sin medicion, por la marca del PACIENTE ══");
const suyas = deProfesional("gildardo");
const cubos = new Map();
for (const e of suyas) {
  const p = pacientePorId.get(e.patient_id);
  const marca = !p
    ? "(paciente no encontrado)"
    : p.is_test
      ? "is_test explicito"
      : p.cuenta_como_de_prueba
        ? "cuenta_como_de_prueba (derivada)"
        : p.es_real_confirmado
          ? "REAL confirmado"
          : "SIN MARCA (ni prueba ni real)";
  // LA PROCEDENCIA DISTINGUE LO QUE LA MARCA NO (0162): `import_batch_id` dice si la consulta vino del
  // HTML en un lote o si nacio en Atlas. Una consulta importada de su historico es de un paciente REAL
  // aunque nadie la haya confirmado; una que nacio en Atlas y nunca se completo puede ser una prueba.
  const origen = e.import_batch_id ? "importada del HTML" : "nacio en Atlas";
  const k = `${marca} · ${origen} · ${e.status}/${e.type}`;
  if (!cubos.has(k)) cubos.set(k, []);
  cubos.get(k).push(e);
}
console.log(`  total sin medicion: ${suyas.length}`);
for (const k of [...cubos.keys()].sort()) {
  const grupo = cubos.get(k);
  const conEnc = grupo.filter((e) => conRespuestas.has(e.id)).length;
  const conDx = grupo.filter((e) => conDiagnostico.has(e.id)).length;
  console.log(
    `    ${k}: ${grupo.length} · con encuesta respondida ${conEnc} · con diagnostico ${conDx} · ` +
      `de ${fecha(grupo.map((e) => e.created_at).sort()[0])} a ${fecha(grupo.map((e) => e.created_at).sort().at(-1))}`,
  );
}
// Los pacientes DISTINTOS detras de las que no estan marcadas: marcar es por paciente, no por consulta.
const sinMarca = suyas.filter((e) => {
  const p = pacientePorId.get(e.patient_id);
  return p && !p.is_test && !p.cuenta_como_de_prueba && !p.es_real_confirmado;
});
const pacientesSinMarca = [...new Set(sinMarca.map((e) => e.patient_id))];
console.log(
  `  → ${sinMarca.length} consultas sin marca, de ${pacientesSinMarca.length} pacientes distintos: ` +
    pacientesSinMarca.map((id) => id.slice(0, 8)).join(", "),
);

// ── 2 · MARIA CAMILA: SE PUEDEN RETIRAR? ─────────────────────────────────────────────────────────
console.log("\n══ 2 · MARIA CAMILA · se pueden retirar sus consultas sin medicion? ══");
const camila = deProfesional("camila");
const conDx = camila.filter((e) => conDiagnostico.has(e.id));
console.log(`  sin medicion: ${camila.length}`);
console.log(`  con diagnostico emitido (NO se pueden retirar, el writer lo prohibe): ${conDx.length}`);
console.log(`  con encuesta respondida: ${camila.filter((e) => conRespuestas.has(e.id)).length}`);
const porEstadoC = new Map();
for (const e of camila) {
  const k = `${e.status}/${e.type}`;
  porEstadoC.set(k, (porEstadoC.get(k) ?? 0) + 1);
}
console.log(`  estados: ${[...porEstadoC].map(([k, n]) => `${k}=${n}`).join(" · ")}`);
console.log(
  `  procedencia: importadas del HTML ${camila.filter((e) => e.import_batch_id).length} · ` +
    `nacidas en Atlas ${camila.filter((e) => !e.import_batch_id).length}`,
);
const fechasC = camila.map((e) => e.created_at).sort();
console.log(`  de ${fecha(fechasC[0])} a ${fecha(fechasC.at(-1))}`);
console.log(`  pacientes distintos: ${new Set(camila.map((e) => e.patient_id)).size}`);
console.log(`  intentos fallidos de importar en ellas: ${logs.filter((l) => l.status !== "ok" && camila.some((e) => e.id === l.evaluation_id)).length}`);

// ── 3 · VALENTINA: SUS FALLOS REALES ─────────────────────────────────────────────────────────────
console.log("\n══ 3 · VALENTINA · sus intentos fallidos de importar, con el error completo ══");
const valentina = vivas.filter((e) => String(nombreDe.get(e.professional_id) ?? "").toLowerCase().includes("valentina"));
const idsVal = new Set(valentina.map((e) => e.id));
const fallosVal = logs.filter((l) => l.status !== "ok" && idsVal.has(l.evaluation_id));
console.log(`  consultas vivas: ${valentina.length} · intentos fallidos: ${fallosVal.length}`);
for (const l of fallosVal) {
  const e = valentina.find((x) => x.id === l.evaluation_id);
  console.log(`    ${fecha(l.created_at)} · consulta ${l.evaluation_id.slice(0, 8)} (${e?.status}) · ${l.status}`);
  console.log(`      ${String(l.error_detail ?? "(sin detalle)").slice(0, 400)}`);
  console.log(`      ¿quedo con medicion al final? ${conMedicion.has(l.evaluation_id) ? "SI" : "NO"}`);
}

// ── 4 · LOS ARCHIVOS EQUIVOCADOS, AGRUPADOS POR CAUSA ────────────────────────────────────────────
console.log("\n══ 4 · LOS INTENTOS FALLIDOS, POR CAUSA (para escribir el mensaje de cada caso) ══");
const fallos = logs.filter((l) => l.status !== "ok");
const porCausa = new Map();
for (const l of fallos) {
  // La causa es la PRIMERA linea del detalle, recortada: el resto suele traer la lista de columnas.
  const d = String(l.error_detail ?? "(sin detalle)").split("\n")[0].trim();
  const clave = `${l.status} · ${d.slice(0, 120)}`;
  if (!porCausa.has(clave)) porCausa.set(clave, []);
  porCausa.get(clave).push(l);
}
console.log(`  intentos fallidos en total: ${fallos.length} · causas distintas: ${porCausa.size}`);
for (const [clave, lista] of [...porCausa.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const fechas = lista.map((l) => l.created_at).sort();
  const profs = new Set(
    lista
      .map((l) => vivas.find((e) => e.id === l.evaluation_id))
      .map((e) => nombreDe.get(e?.professional_id) ?? "(sin consulta)"),
  );
  console.log(`\n  [${lista.length}] ${clave}`);
  console.log(`       de ${fecha(fechas[0])} a ${fecha(fechas.at(-1))} · profesionales: ${[...profs].join(", ")}`);
  const resueltos = lista.filter((l) => l.evaluation_id && conMedicion.has(l.evaluation_id)).length;
  console.log(`       de esas consultas, ${resueltos} acabaron CON medicion (el profesional reintento bien)`);
}

console.log("\nFin. Nada se escribio.");
