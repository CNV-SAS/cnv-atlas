// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS TRES PREGUNTAS DE LA SIMULACION DE LAS 17:51  ·  SOLO LECTURA  ·  2026-11-07
//
// Santiago corrio la simulacion contra la nube y salieron tres cosas que no se pueden contestar desde el
// codigo. Esto las mide contra los datos de verdad.
//
//   (a) LA R1 ESTA EN 247 DE 497. Su tabla por celda del dominio 1, que es lo que convierte la cifra en
//       una pregunta contestable para Gildardo: de sus nueve celdas, cuales activan la ruta y cuantas
//       consultas caen en cada una.
//   (b) UN MENOR EN LA COHORTE DE INVESTIGACION (13 años al medirse, motor 1.0.0). Cuantos son, con que
//       consentimiento entraron y cuantos tienen la edad sin saberse.
//       Y LAS 140 SIN DIAGNOSTICO: en que estado estan, si traen medicion y si traen encuesta.
//   (c) LA TARJETA DE RESPUESTA A LA INTERVENCION que vio Santiago (riesgo 15 -> 95, C 2,960 -> 1,560 nF,
//       PABU 1,202 -> 2,625, contra la consulta del 13 jul 2026): de que paciente es, si es de prueba, y
//       con que versiones del motor estan sellados los dos extremos.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO: conteos, cifras del modelo e identificadores de OCHO
// caracteres. Los nombres de las profesionales SI salen, porque son con quien se coordina.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/LO_QUE_PREGUNTO_LA_SIMULACION_2026-11-07.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "lo que pregunto la simulacion del 2026-11-07 (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

const ocho = (id) => String(id ?? "").slice(0, 8);

/**
 * TODAS las filas de una consulta, paginando.
 *
 * PostgREST devuelve mil filas y no lo dice (leccion del 2026-11-03), y paginar SIN `order` no define
 * que trae cada pagina: las dos cosas juntas dan cifras creibles y falsas.
 */
async function todas(tabla, columnas, afinar = (q) => q, orden = "id") {
  const salida = [];
  const paso = 1000;
  for (let desde = 0; ; desde += paso) {
    const { data, error } = await afinar(db.from(tabla).select(columnas))
      .order(orden, { ascending: true })
      .range(desde, desde + paso - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    salida.push(...(data ?? []));
    if ((data ?? []).length < paso) break;
  }
  return salida;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// (a) LA R1, POR CELDA DE SU MATRIZ D1
// ══════════════════════════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("(a) LA R1 Y SU ROTULO, POR CELDA DEL DOMINIO 1");
console.log("═══════════════════════════════════════════════════════════════════");

// El diagnostico VIGENTE de cada evaluacion de la cohorte, que es el mismo criterio de la vista.
const cohorte = await todas(
  "evaluaciones_para_investigacion",
  "id, diagnosis_id, engine_version, measurement_date, patient_id, professional_id, status, measurement_id, huella_repetida",
);
console.log(`Evaluaciones en la cohorte de investigacion: ${cohorte.length}`);

const conDiagnostico = cohorte.filter((e) => e.diagnosis_id);
console.log(`Con diagnostico vigente: ${conDiagnostico.length}`);

// Los snapshots viven en `reports`, uno por diagnostico; se toma el mas reciente de cada evaluacion.
//
// SE TRAE TODO `reports` PAGINADO Y SE CRUZA EN MEMORIA, en vez de un `.in()` con quinientos ids: el
// `.in()` largo da "URI too long", PostgREST lo devuelve como error y la suma queda en cero sin que nada
// falle (leccion del 2026-10-22). Cruzar en memoria es lo unico que no depende del largo de la URL.
const todosLosInformes = await todas("reports", "id, evaluation_id, snapshot, created_at, type", (q) => q, "id");
for (const r of todosLosInformes) r.tipo = r.type;
const ultimoPorEval = new Map();
for (const r of todosLosInformes) {
  const previo = ultimoPorEval.get(r.evaluation_id);
  if (!previo || String(r.created_at) > String(previo.created_at)) ultimoPorEval.set(r.evaluation_id, r);
}

const porCelda = {};
let r1ConRotuloQueNoAplica = 0;
let lasTresSinR1 = 0;
let conSnapshot = 0;
for (const e of cohorte) {
  const snap = ultimoPorEval.get(e.id)?.snapshot;
  if (!snap) continue;
  conSnapshot += 1;
  const d1 = (snap?.dfi?.domains ?? []).find((d) => d.id === "d1");
  const tieneR1 = (snap?.dfi?.rutas ?? []).some((r) => String(r).startsWith("R1"));
  if (d1?.clasif) {
    const celda = `${d1.clasif} (sev ${d1.sev ?? "sin medir"})`;
    const c = (porCelda[celda] ??= { r1: 0, sinR1: 0 });
    if (tieneR1) c.r1 += 1;
    else c.sinR1 += 1;
  }
  const i = snap?.indicators ?? {};
  if (i.ifc == null || i.irc == null || i.iae == null) continue;
  const lasTres = i.ifc < 4.5 && i.ifc > 0 && i.irc >= 3.5 && i.iae >= 5;
  if (tieneR1 && !lasTres) r1ConRotuloQueNoAplica += 1;
  if (lasTres && !tieneR1) lasTresSinR1 += 1;
}

console.log(`Con informe sellado que leer: ${conSnapshot}`);
console.log("\nCelda del dominio 1 (IFC | IRC)            sev   con R1   sin R1   total");
const filas = Object.entries(porCelda).sort((a, b) => b[1].r1 + b[1].sinR1 - (a[1].r1 + a[1].sinR1));
let totR1 = 0;
let totSin = 0;
for (const [celda, c] of filas) {
  totR1 += c.r1;
  totSin += c.sinR1;
  console.log(
    `${celda.padEnd(42)} ${String(c.r1).padStart(6)} ${String(c.sinR1).padStart(8)} ${String(c.r1 + c.sinR1).padStart(7)}`,
  );
}
console.log(`${"TOTAL".padEnd(42)} ${String(totR1).padStart(6)} ${String(totSin).padStart(8)} ${String(totR1 + totSin).padStart(7)}`);
console.log(`\nR1 con el rotulo que no aplica (no cumplen las tres): ${r1ConRotuloQueNoAplica}`);
console.log(`Cumplen las tres y NO llevan R1: ${lasTresSinR1}`);

// ═══ Y LA MISMA TABLA SOBRE EL CONJUNTO DE LA SIMULACION, que es otro denominador ═══
//
// La simulacion recorre TODOS los informes de tipo "paciente", el mas reciente de cada consulta, sin
// filtrar por consentimiento ni por paciente de prueba. La cohorte de investigacion si filtra las dos
// cosas, asi que las dos cifras son correctas y no son la misma: la de la simulacion es la del MOTOR
// (cuantas veces la regla se activo) y la de la cohorte es la de la CIENCIA (sobre cuantas se puede
// publicar). La pregunta de Gildardo es sobre el motor, asi que la tabla que va al documento es esta.
console.log("\n--- la misma tabla sobre el conjunto de la simulacion (informes de paciente) ---");
const informesDePaciente = todosLosInformes.filter((r) => r.tipo === "paciente");
const ultimoPacientePorEval = new Map();
for (const r of informesDePaciente) {
  const previo = ultimoPacientePorEval.get(r.evaluation_id);
  if (!previo || String(r.created_at) > String(previo.created_at)) ultimoPacientePorEval.set(r.evaluation_id, r);
}
const porCelda2 = {};
let r1SinLasTres2 = 0;
let lasTresSinR12 = 0;
for (const r of ultimoPacientePorEval.values()) {
  const snap = r.snapshot;
  const d1 = (snap?.dfi?.domains ?? []).find((d) => d.id === "d1");
  const tieneR1 = (snap?.dfi?.rutas ?? []).some((x) => String(x).startsWith("R1"));
  if (d1?.clasif) {
    const celda = `${d1.clasif} (sev ${d1.sev ?? "sin medir"})`;
    const c = (porCelda2[celda] ??= { r1: 0, sinR1: 0 });
    if (tieneR1) c.r1 += 1;
    else c.sinR1 += 1;
  }
  const i = snap?.indicators ?? {};
  if (i.ifc == null || i.irc == null || i.iae == null) continue;
  const lasTres = i.ifc < 4.5 && i.ifc > 0 && i.irc >= 3.5 && i.iae >= 5;
  if (tieneR1 && !lasTres) r1SinLasTres2 += 1;
  if (lasTres && !tieneR1) lasTresSinR12 += 1;
}
console.log(`Consultas con informe de paciente: ${ultimoPacientePorEval.size}`);
console.log("\nCelda del dominio 1 (IFC | IRC)            sev   con R1   sin R1   total");
let t1 = 0;
let t2 = 0;
for (const [celda, c] of Object.entries(porCelda2).sort((a, b) => b[1].r1 + b[1].sinR1 - (a[1].r1 + a[1].sinR1))) {
  t1 += c.r1;
  t2 += c.sinR1;
  console.log(
    `${celda.padEnd(42)} ${String(c.r1).padStart(6)} ${String(c.sinR1).padStart(8)} ${String(c.r1 + c.sinR1).padStart(7)}`,
  );
}
console.log(`${"TOTAL".padEnd(42)} ${String(t1).padStart(6)} ${String(t2).padStart(8)} ${String(t1 + t2).padStart(7)}`);
console.log(`R1 con el rotulo que no aplica: ${r1SinLasTres2}`);
console.log(`Cumplen las tres y NO llevan R1: ${lasTresSinR12}`);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// (b) LOS MENORES EN LA COHORTE, Y LAS QUE NO TIENEN DIAGNOSTICO
// ══════════════════════════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("(b1) MENORES DE 18 AL MEDIRSE, DENTRO DE LA COHORTE");
console.log("═══════════════════════════════════════════════════════════════════");

const perfiles = await todas("patient_profiles", "patient_id, birth_date", (q) => q, "patient_id");
const nacimiento = new Map(perfiles.map((p) => [p.patient_id, p.birth_date]));

function edadAlMedirse(patientId, fecha) {
  const b = nacimiento.get(patientId);
  if (!b || !fecha) return null;
  const n = new Date(`${String(b).slice(0, 10)}T00:00:00Z`);
  const m = new Date(`${String(fecha).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(n.getTime()) || Number.isNaN(m.getTime())) return null;
  let a = m.getUTCFullYear() - n.getUTCFullYear();
  const antes =
    m.getUTCMonth() < n.getUTCMonth() ||
    (m.getUTCMonth() === n.getUTCMonth() && m.getUTCDate() < n.getUTCDate());
  if (antes) a -= 1;
  return a;
}

const menores = [];
const sinEdad = [];
const mayores100 = [];
for (const e of cohorte) {
  const a = edadAlMedirse(e.patient_id, e.measurement_date);
  if (a == null) sinEdad.push(e);
  else if (a < 18) menores.push({ ...e, edad: a });
  else if (a > 100) mayores100.push({ ...e, edad: a });
}
console.log(`Menores de 18 al medirse: ${menores.length}`);
for (const m of menores) {
  console.log(
    `  consulta ${ocho(m.id)} · ${m.edad} años · motor ${m.engine_version ?? "sin diagnóstico"} · estado ${m.status} · medicion ${m.measurement_date ? String(m.measurement_date).slice(0, 10) : "sin fecha"}`,
  );
}
// ═══ Y SE SEPARAN LAS DOS CAUSAS, porque son dos problemas distintos ═══
//
// "No se puede saber la edad" es o que falta la fecha de NACIMIENTO (un dato del paciente que hay que
// pedir) o que falta la de la MEDICION (la consulta todavia no tiene toma). Juntas dan una cifra grande
// que no le dice a nadie que hacer, y en esta base la segunda se lleva casi todas: son las consultas en
// curso de (b2).
const sinNacimiento = sinEdad.filter((e) => !nacimiento.get(e.patient_id));
const sinMedicion = sinEdad.filter((e) => nacimiento.get(e.patient_id) && !e.measurement_date);
console.log(`Sin poder calcular la edad: ${sinEdad.length}`);
console.log(`  · porque falta la fecha de NACIMIENTO: ${sinNacimiento.length}`);
console.log(
  `    (pacientes distintos: ${new Set(sinNacimiento.map((e) => e.patient_id)).size})`,
);
console.log(`  · porque la consulta no tiene MEDICION todavia: ${sinMedicion.length}`);
console.log(`Mayores de 100 al medirse (fuera de calibracion por arriba): ${mayores100.length}`);
for (const m of mayores100) console.log(`  consulta ${ocho(m.id)} · ${m.edad} años`);

// Y lo mismo contra la vista de vigentes, que es la que cuenta consultas (no la cohorte).
const vigentes = await todas(
  "evaluaciones_vigentes",
  "id, patient_id, measurement_date, engine_version, status",
);
let menoresVigentes = 0;
for (const e of vigentes) {
  const a = edadAlMedirse(e.patient_id, e.measurement_date);
  if (a != null && a < 18) menoresVigentes += 1;
}
console.log(`\nPara comparar: menores dentro de evaluaciones_vigentes: ${menoresVigentes} de ${vigentes.length}`);

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("(b2) LAS QUE NO TIENEN DIAGNOSTICO: QUE SON");
console.log("═══════════════════════════════════════════════════════════════════");

const sinDiagnostico = cohorte.filter((e) => !e.engine_version);
console.log(`Sin diagnostico en la cohorte: ${sinDiagnostico.length}`);

const porEstado = {};
for (const e of sinDiagnostico) porEstado[e.status ?? "sin estado"] = (porEstado[e.status ?? "sin estado"] ?? 0) + 1;
console.log("\nPor estado de la consulta:");
for (const [k, v] of Object.entries(porEstado).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${v}`);

const conMedicion = sinDiagnostico.filter((e) => e.measurement_id).length;
console.log(`\nCon medicion BIS: ${conMedicion} de ${sinDiagnostico.length}`);

// ¿Traen encuesta? `survey_responses` por evaluacion.
const respuestas = await todas("survey_responses", "evaluation_id", (q) => q, "evaluation_id");
const conEncuesta = new Set(respuestas.map((r) => r.evaluation_id));
console.log(
  `Con al menos una respuesta de encuesta: ${sinDiagnostico.filter((e) => conEncuesta.has(e.id)).length} de ${sinDiagnostico.length}`,
);

// Y el cruce que decide si "sin diagnostico" significa "solo encuesta" o "solo medicion".
const cuadrante = { "ni medicion ni encuesta": 0, "solo medicion": 0, "solo encuesta": 0, "las dos": 0 };
for (const e of sinDiagnostico) {
  const m = Boolean(e.measurement_id);
  const s = conEncuesta.has(e.id);
  cuadrante[m && s ? "las dos" : m ? "solo medicion" : s ? "solo encuesta" : "ni medicion ni encuesta"] += 1;
}
console.log("\nQue aportan:");
for (const [k, v] of Object.entries(cuadrante)) console.log(`  ${k.padEnd(26)} ${v}`);

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// (c) LA TARJETA DE RESPUESTA A LA INTERVENCION
// ══════════════════════════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("(c) DE QUE PACIENTE ES LA TARJETA QUE VIO SANTIAGO");
console.log("═══════════════════════════════════════════════════════════════════");

// Se busca por las cifras que el pego: riesgo 95 y PABU 2,625 en la consulta de ahora; riesgo 15 y
// PABU 1,202 en la del 13 jul 2026. Las dos tienen que ser del MISMO paciente.
const porPaciente = new Map();
for (const e of vigentes) {
  const r = ultimoPorEval.get(e.id);
  if (!r?.snapshot) continue;
  const s = r.snapshot;
  if (!porPaciente.has(e.patient_id)) porPaciente.set(e.patient_id, []);
  porPaciente.get(e.patient_id).push({
    evaluationId: e.id,
    fecha: e.measurement_date ? String(e.measurement_date).slice(0, 10) : null,
    riesgo: s?.dfi?.riesgo?.score ?? null,
    pabu: s?.indicators?.pabu ?? null,
    motor: s?.versions?.engine ?? null,
  });
}

let encontrados = 0;
for (const [pacienteId, puntos] of porPaciente) {
  const tiene = (valor, campo) =>
    puntos.some((p) => p[campo] != null && Math.abs(Number(p[campo]) - valor) < 0.051);
  if (!(tiene(95, "riesgo") && tiene(15, "riesgo"))) continue;
  if (!(tiene(2.625, "pabu") || tiene(1.202, "pabu"))) continue;
  encontrados += 1;
  console.log(`\nPaciente ${ocho(pacienteId)} (prueba: se comprueba abajo)`);
  for (const p of puntos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))) {
    console.log(
      `  consulta ${ocho(p.evaluationId)} · ${p.fecha ?? "sin fecha"} · riesgo ${p.riesgo ?? "-"} · PABU ${p.pabu ?? "-"} · motor ${p.motor ?? "sin sellar"}`,
    );
  }
}
if (encontrados === 0) {
  console.log("No se encontro en evaluaciones_vigentes: la tarjeta sale de un paciente DE PRUEBA,");
  console.log("que la vista excluye por `cuenta_como_de_prueba`. Se busca sin ese filtro:");

  const todasLasEval = await todas(
    "evaluations",
    "id, patient_id, superseded_at, retirada_at",
    (q) => q,
    "id",
  );
  const porPaciente2 = new Map();
  for (const e of todasLasEval) {
    const r = ultimoPorEval.get(e.id);
    if (!r?.snapshot) continue;
    const s = r.snapshot;
    if (!porPaciente2.has(e.patient_id)) porPaciente2.set(e.patient_id, []);
    porPaciente2.get(e.patient_id).push({
      evaluationId: e.id,
      riesgo: s?.dfi?.riesgo?.score ?? null,
      pabu: s?.indicators?.pabu ?? null,
      motor: s?.versions?.engine ?? null,
      superseded: e.superseded_at != null,
    });
  }
  const medicionesPorEval = new Map();
  for (const m of await todas("bis_measurements", "evaluation_id, measurement_date, created_at", (q) => q, "evaluation_id")) {
    const prev = medicionesPorEval.get(m.evaluation_id);
    if (!prev || String(m.created_at) > String(prev.created_at)) medicionesPorEval.set(m.evaluation_id, m);
  }
  const prueba = new Set(
    (await todas("patients", "id, cuenta_como_de_prueba", (q) => q, "id"))
      .filter((p) => p.cuenta_como_de_prueba)
      .map((p) => p.id),
  );
  for (const [pacienteId, puntos] of porPaciente2) {
    const tiene = (valor, campo) =>
      puntos.some((p) => p[campo] != null && Math.abs(Number(p[campo]) - valor) < 0.051);
    if (!(tiene(95, "riesgo") && tiene(15, "riesgo"))) continue;
    console.log(`\nPaciente ${ocho(pacienteId)} · de prueba: ${prueba.has(pacienteId) ? "SI" : "no"}`);
    for (const p of puntos) {
      const m = medicionesPorEval.get(p.evaluationId);
      console.log(
        `  consulta ${ocho(p.evaluationId)} · ${m?.measurement_date ? String(m.measurement_date).slice(0, 10) : "sin fecha"} · riesgo ${p.riesgo ?? "-"} · PABU ${p.pabu ?? "-"} · motor ${p.motor ?? "sin sellar"}${p.superseded ? " · REEMPLAZADA" : ""}`,
      );
    }
  }
}

console.log("\nListo. No se escribio nada.");
