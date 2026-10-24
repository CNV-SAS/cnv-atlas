// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS DATOS DE LA EDAD BIOELECTRICA, PARA LA DIRECCION CIENTIFICA  ·  SOLO LECTURA  ·  2026-10-22
//
// ═══ POR QUE EXISTE ═══
//
// Gildardo ve que la EB-BIS "no esta normal y no esta dando algo coherente" y pidio los datos crudos. Su
// herramienta ofrecio escribir la consulta si le mandabamos el esquema. No hace falta ese rodeo: la
// consulta se escribe de este lado, que es donde se conoce el esquema, y el se queda con el archivo.
//
// ═══ NO DEJA NADA EN EL REPOSITORIO ═══
//
// Los dos archivos salen a `docs/entregas/dudas/`, que esta ENTERO en .gitignore (`docs/entregas/dudas/**`
// y `docs/entregas/**/*.csv`, las dos reglas lo cubren). El primero lleva NOMBRE Y DOCUMENTO, asi que no
// puede entrar a git ni subirse a ninguna parte que no sea el correo o el drive de CNV.
//
// ═══ UN ARCHIVO POR DEFECTO, Y EL IDENTIFICADO HAY QUE PEDIRLO ═══
//
//   1. `eb-bis-cohorte.csv`  (SIEMPRE): SEUDONIMIZADO, TODA la cohorte real (sin pacientes ni
//      profesionales de prueba, sin evaluaciones reemplazadas ni retiradas). Es el que responde la
//      pregunta de la formula, y al no llevar nombre ni documento se puede compartir con mucho menos
//      riesgo.
//
//   2. `eb-bis-de-gildardo.csv` (SOLO con `--identificado`): IDENTIFICADO, solo sus pacientes. Se pidio
//      una vez, se entrego, y Gildardo dijo despues que NO hace falta (2026-10-24: "No hace falta el
//      archivo identificado con nombres y documentos"). Queda detras de una bandera y NO sale por
//      defecto, porque un archivo con nombre y cedula que se genera sin que nadie lo pida es un archivo
//      que alguien va a encontrar sin saber que trae. El enlace entre los dos, si hiciera falta, es la
//      columna `evaluacion` (el id), que no dice nada por si sola.
//
// ═══ DE DONDE SALE CADA COLUMNA ═══
//
//   · Re, Ri, Rinf, C, AF        -> `bis_raw_values` (lo que midio el equipo, o lo DERIVADO: va marcado)
//   · peso, talla, MLG, ACT,     -> `bis_raw_values` TAMBIEN, y por eso son los de LA MEDICION y no los
//     masa seca sin grasa           de la ficha de hoy: `patient_profiles` no guarda peso ni talla, asi
//                                   que no hay un segundo sitio del que pudieran venir. El valor vigente
//                                   vive aqui incluso si se corrigio a mano (la 0090 invirtio eso: el
//                                   crudo original queda en `bis_value_corrections`).
//   · fuerza_prensil             -> `evaluation_bis_intake.grip_strength_kg`. NO viene del equipo: la
//                                   mide el profesional con dinamometro y es opcional, asi que la mayoria
//                                   de las filas la tienen vacia (el conteo se imprime al final).
//   · IFC, PABU, EB, IAE, IRC    -> `indicator_values` (lo que se sello ese dia, no un recalculo)
//   · ICEC (LE8)                 -> `reports.snapshot -> dfi.le8Total`. NO existe como indicador: es el
//                                   unico insumo de la EB-BIS que no esta en `indicator_values`, y sin el
//                                   la formula no se puede auditar.
//   · sexo, nacimiento, edad     -> `patient_profiles` + la fecha de la medicion
//   · edad_que_uso_el_motor      -> DESPEJADA de EB - IAE. Es la que de verdad entro al calculo, y puede
//                                   NO coincidir con la de arriba (ver `aviso_edad`).
//
// COMO SE CORRE (lee la nube, no escribe nada en ella):
//   node --env-file=.env.production.local scripts/datos-eb-bis-para-gildardo.mjs
//   node --env-file=.env.production.local scripts/datos-eb-bis-para-gildardo.mjs --identificado
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Corre:  node --env-file=.env.production.local scripts/datos-eb-bis-para-gildardo.mjs");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// PostgREST pagina de mil en mil y NO avisa: sin esto, una tabla de 4.000 filas devuelve 1.000 y el
// archivo sale corto sin un solo error. Y se lee `error` SIEMPRE: un fallo viene en el campo, no lanzando.
async function todo(tabla, select, filtro) {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    let q = sb.from(tabla).select(select).range(desde, desde + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// LOS NOMBRES DE COLUMNA DEL BIODY MANAGER, no los simbolos del motor: `bis_raw_values.variable_name`
// guarda el encabezado EXACTO del export (espacios finales y Ω incluidos), tal como lo declara
// `clinical-engine/edge/biody-columns.ts`. Pedir "Re" devolvia vacio en silencio, que es la familia de
// defecto que ya nos costo un freno: una columna que no existe no da error, da una celda en blanco.
const CRUDOS = {
  Re: "Extracellular resistance ",
  Ri: "Intracellular resistance Ω",
  Rinf: "Infinite resistance ",
  C: "Membrane capacitance nF",
  AF: "Ángulo de fase a 50 kHz °",
  R50: "Resistencia a 50khz Ohm",
  Xc50: "Reactancia à 50khz Ohm",
  Fo: "Characteristic frequency kHz",
  // LA EDAD QUE TRAIA EL EQUIPO, que NO es la que usa el motor (esa sale de la fecha de nacimiento del
  // perfil). Va como cotejo: si las dos difieren, una de las dos esta mal.
  edad_del_equipo: "Edad",
};
// LA COMPOSICION QUE PIDIO GILDARDO EL 24-OCT. Misma tabla, mismos encabezados del export: son columnas
// del equipo, no calculos nuestros.
//
// LA MASA SECA SIN GRASA LA GUARDA EL EQUIPO (403 filas medidas en la nube), asi que va la del equipo y
// NO se calcula como MLG - ACT. El la ofrecio calcularla por si no la teniamos; si la calculamos nosotros
// seria una cifra nuestra pasando por una del aparato, y las dos no tienen por que coincidir al decimal.
const COMPOSICION = {
  peso_kg: "Peso kg",
  talla_cm: "Altura cm",
  MLG_kg: "Masa sin grasa measurementDetails.VALEURCALCULEEEXPORT kg",
  ACT_L: "Agua total measurementDetails.VALEURCALCULEEEXPORT L",
  masa_seca_sin_grasa_kg: "Masa seca sin grasa measurementDetails.VALEURCALCULEEEXPORT kg",
};

// Y SE CONSULTAN NORMALIZADAS, que es un filo con nombre y apellido: `clinical-engine/edge/biody-columns.ts`
// declara los encabezados TAL CUAL vienen del Excel, pero lo que se PERSISTE en
// `bis_raw_values.variable_name` paso por `normalizeHeader` (modules/bis/services/header-map.ts): recorta,
// colapsa espacios repetidos y TRADUCE los tokens de BiodyLife. Consultar con el encabezado crudo devuelve
// CELDAS VACIAS sin un solo error: paso en la primera corrida de este script, con Re y Rinf en blanco
// mientras Ri y C (que no llevan espacio final) si llegaban.
//
// Al principio bastaba un `.trim()` porque los insumos electricos no traen tokens. Las columnas de
// composicion SI los traen ("...measurementDetails.VALEURCALCULEEEXPORT kg" se guarda como "...valor kg"),
// asi que el `.trim()` habria devuelto las cinco columnas nuevas vacias. Esta es una COPIA de la funcion
// del repo, no una aproximacion: el script es .mjs y no puede importar el TypeScript.
const TOKENS = [
  [/measurementDetails\.VALEURCALCULEEEXPORT/g, "valor"],
  [/measurementDetails\.REFERENCEESTIMEEEXPORT/g, "referencia"],
  [/measurementDetails\.ECARTTHEORIQUEEXPORT/g, "desviacion"],
];
function normaliza(raw) {
  let s = (raw ?? "").trim();
  for (const [re, rep] of TOKENS) s = s.replace(re, rep);
  return s.replace(/\s+/g, " ").trim();
}

const PEDIDAS = { ...CRUDOS, ...COMPOSICION };
const CABECERAS = Object.values(PEDIDAS).map(normaliza);
const porCabecera = new Map(Object.entries(PEDIDAS).map(([k, v]) => [normaliza(v), k]));
const INDICADORES = ["IFC", "PABU", "EB", "IAE", "IRC", "AF", "FMI", "FFMI", "ISCM", "IEHH"];

console.log("Leyendo la nube...");
const defs = await todo("indicator_definitions", "id, code");
const codigoDe = new Map(defs.map((d) => [d.id, d.code]));
const idsIndicadores = defs.filter((d) => INDICADORES.includes(d.code)).map((d) => d.id);

const evs = await todo(
  "evaluations",
  "id, patient_id, professional_id, type, status, created_at, superseded_at, retirada_at, bis_measurements(id, measurement_date)",
);
const pacientes = await todo("patients", "id, document_type, document_number, is_test, cuenta_como_de_prueba, deleted_at");
const perfiles = await todo("patient_profiles", "patient_id, first_name, last_name, sex, birth_date");
const profs = await todo("professional_profiles", "id, profile_id, is_test, profession");
const usuarios = await todo("profiles", "id, full_name");
const valores = await todo("indicator_values", "evaluation_id, indicator_definition_id, value, engine_version, rules_version", (q) =>
  q.in("indicator_definition_id", idsIndicadores),
);
const reportes = await todo("reports", "evaluation_id, snapshot");
// La fuerza prensil no es del equipo: la captura el profesional con dinamometro, en la entrada BIS, y es
// opcional. Una celda vacia aqui significa "no se midio", no "falta el dato".
const intakes = await todo("evaluation_bis_intake", "evaluation_id, grip_strength_kg");
const prensilDe = new Map(intakes.filter((i) => i.grip_strength_kg != null).map((i) => [i.evaluation_id, Number(i.grip_strength_kg)]));

const P = new Map(pacientes.map((p) => [p.id, p]));
const F = new Map(perfiles.map((p) => [p.patient_id, p]));
const PR = new Map(profs.map((p) => [p.id, p]));
const U = new Map(usuarios.map((p) => [p.id, p.full_name]));

const porEval = new Map();
for (const v of valores) {
  if (!porEval.has(v.evaluation_id)) porEval.set(v.evaluation_id, { motor: v.engine_version, reglas: v.rules_version });
  porEval.get(v.evaluation_id)[codigoDe.get(v.indicator_definition_id)] = v.value == null ? null : Number(v.value);
}
// El ICEC solo vive aqui. Se toma el snapshot del reporte de la evaluacion.
const icecDe = new Map();
for (const r of reportes) {
  const t = r.snapshot?.dfi?.le8Total;
  if (t != null) icecDe.set(r.evaluation_id, Number(t));
}

// Los crudos, por medicion
const medIds = evs.flatMap((e) => (e.bis_measurements ?? []).map((m) => m.id));
const crudos = medIds.length
  ? await todo("bis_raw_values", "measurement_id, variable_name, value, origin", (q) => q.in("variable_name", CABECERAS))
  : [];
const crudoDe = new Map();
for (const c of crudos) {
  const simbolo = porCabecera.get(c.variable_name);
  if (!simbolo) continue;
  if (!crudoDe.has(c.measurement_id)) crudoDe.set(c.measurement_id, {});
  crudoDe.get(c.measurement_id)[simbolo] = { v: Number(c.value), origen: c.origin };
}

function edadEn(nacimiento, fecha) {
  if (!nacimiento || !fecha) return null;
  const n = new Date(nacimiento), f = new Date(fecha);
  let a = f.getUTCFullYear() - n.getUTCFullYear();
  const m = f.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && f.getUTCDate() < n.getUTCDate())) a -= 1;
  return a;
}

const filas = [];
for (const e of evs) {
  const ind = porEval.get(e.id);
  if (!ind || ind.EB == null) continue; // sin EB-BIS no hay nada que auditar
  const pac = P.get(e.patient_id);
  const perf = F.get(e.patient_id);
  const prof = PR.get(e.professional_id);
  if (!pac || pac.deleted_at) continue;
  // Los filtros que pidio Gildardo: sin pruebas, sin reemplazadas. Se agregan las RETIRADAS (consultas
  // que no ocurrieron) y los profesionales de prueba, que son la misma clase de ruido.
  if (pac.is_test || pac.cuenta_como_de_prueba || prof?.is_test) continue;
  if (e.superseded_at || e.retirada_at) continue;

  const med = (e.bis_measurements ?? [])[0];
  const raw = med ? (crudoDe.get(med.id) ?? {}) : {};
  const fecha = med?.measurement_date ?? null;
  const edad = edadEn(perf?.birth_date, fecha);
  const edadMotor = ind.IAE != null ? Number((ind.EB - ind.IAE).toFixed(1)) : null;

  // AVISO DE EDAD: la edad que entro al motor contra la que se deriva del nacimiento de HOY. No cuadran
  // cuando la fecha se corrigio DESPUES de sellar el diagnostico, o cuando era ilegible y
  // `parseFloat(edad)||0` la convirtio en CERO (que es lo que hace `computeIAE`).
  let aviso = "";
  if (edadMotor == null) aviso = "sin_IAE";
  else if (edadMotor === 0 && edad != null && edad > 0) aviso = "el_motor_uso_edad_0";
  else if (edad != null && Math.abs(edadMotor - edad) > 1) aviso = `desfase_de_edad_${(edadMotor - edad).toFixed(0)}_anos`;

  filas.push({
    evaluacion: e.id,
    profesional: U.get(prof?.profile_id) ?? "",
    profesion: prof?.profession ?? "",
    tipo: e.type,
    documento: pac.document_type + " " + pac.document_number,
    nombre: ((perf?.first_name ?? "") + " " + (perf?.last_name ?? "")).trim(),
    sexo: perf?.sex ?? "",
    nacimiento: perf?.birth_date ?? "",
    fecha_medicion: fecha ? fecha.slice(0, 10) : "",
    edad_a_la_medicion: edad ?? "",
    edad_que_uso_el_motor: edadMotor ?? "",
    aviso_edad: aviso,
    Re: raw.Re?.v ?? "",
    Ri: raw.Ri?.v ?? "",
    Rinf: raw.Rinf?.v ?? "",
    C: raw.C?.v ?? "",
    AF: raw.AF?.v ?? ind.AF ?? "",
    R50: raw.R50?.v ?? "",
    Xc50: raw.Xc50?.v ?? "",
    Fo: raw.Fo?.v ?? "",
    edad_del_equipo: raw.edad_del_equipo?.v ?? "",
    origen_crudos: [...new Set(Object.keys(CRUDOS).map((k) => raw[k]?.origen).filter(Boolean))].join("|"),
    peso_kg: raw.peso_kg?.v ?? "",
    talla_cm: raw.talla_cm?.v ?? "",
    MLG_kg: raw.MLG_kg?.v ?? "",
    ACT_L: raw.ACT_L?.v ?? "",
    masa_seca_sin_grasa_kg: raw.masa_seca_sin_grasa_kg?.v ?? "",
    origen_composicion: [...new Set(Object.keys(COMPOSICION).map((k) => raw[k]?.origen).filter(Boolean))].join("|"),
    fuerza_prensil_kgf: prensilDe.get(e.id) ?? "",
    IFC: ind.IFC ?? "",
    PABU: ind.PABU ?? "",
    ICEC_LE8: icecDe.get(e.id) ?? "",
    EB_BIS: ind.EB ?? "",
    IAE: ind.IAE ?? "",
    IRC: ind.IRC ?? "",
    FMI: ind.FMI ?? "",
    FFMI: ind.FFMI ?? "",
    ISCM: ind.ISCM ?? "",
    IEHH: ind.IEHH ?? "",
    version_motor: ind.motor ?? "",
    version_reglas: ind.reglas ?? "",
  });
}

const csv = (filas, columnas) => {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columnas.join(","), ...filas.map((f) => columnas.map((c) => esc(f[c])).join(","))].join("\r\n") + "\r\n";
};

const SALIDA = "docs/entregas/dudas";
mkdirSync(SALIDA, { recursive: true });

// La composicion va junta y despues de los crudos electricos, no intercalada: son columnas del mismo
// aparato pero responden otra pregunta, y Gildardo las va a leer en bloque.
const COLS_COMPOSICION = ["peso_kg", "talla_cm", "MLG_kg", "ACT_L", "masa_seca_sin_grasa_kg",
  "origen_composicion", "fuerza_prensil_kgf"];

// ── 1 · IDENTIFICADO, solo los de Gildardo · SOLO SI SE PIDE ──────────────────────────────────────
// Gildardo dijo que no lo necesita, asi que no sale por defecto. Ver la cabecera del archivo.
const deGildardo = filas.filter((f) => /gildardo/i.test(f.profesional));
const quierenIdentificado = process.argv.includes("--identificado");
if (quierenIdentificado) {
  const COLS_ID = [
    "evaluacion", "tipo", "documento", "nombre", "sexo", "nacimiento", "fecha_medicion", "edad_a_la_medicion",
    "edad_que_uso_el_motor", "edad_del_equipo", "aviso_edad", "Re", "Ri", "Rinf", "C", "AF", "R50", "Xc50",
    "Fo", "origen_crudos", ...COLS_COMPOSICION, "IFC", "PABU", "ICEC_LE8", "EB_BIS", "IAE", "IRC", "FMI",
    "FFMI", "ISCM", "IEHH", "version_motor", "version_reglas",
  ];
  writeFileSync(`${SALIDA}/eb-bis-de-gildardo.csv`, csv(deGildardo, COLS_ID), "utf8");
}

// ── 2 · SEUDONIMIZADO, toda la cohorte ────────────────────────────────────────────────────────────
// Sin nombre ni documento, y el profesional como letra: el archivo responde la pregunta de la formula y
// NO identifica a nadie, asi que se puede compartir con mucho menos riesgo.
const letraDe = new Map();
const cohorte = filas.map((f) => {
  if (!letraDe.has(f.profesional)) letraDe.set(f.profesional, String.fromCharCode(65 + letraDe.size));
  return { ...f, profesional: letraDe.get(f.profesional), documento: "", nombre: "", nacimiento: "" };
});
const COLS_SEUDO = ["evaluacion", "profesional", "profesion", "tipo", "sexo", "fecha_medicion", "edad_a_la_medicion",
  "edad_que_uso_el_motor", "edad_del_equipo", "aviso_edad", "Re", "Ri", "Rinf", "C", "AF", "R50", "Xc50",
  "Fo", "origen_crudos", ...COLS_COMPOSICION, "IFC", "PABU", "ICEC_LE8", "EB_BIS", "IAE", "IRC", "FMI",
  "FFMI", "ISCM", "IEHH", "version_motor", "version_reglas"];
writeFileSync(`${SALIDA}/eb-bis-cohorte.csv`, csv(cohorte, COLS_SEUDO), "utf8");

// ── 3 · LO QUE HAY QUE SABER ANTES DE MIRAR LOS ARCHIVOS ──────────────────────────────────────────
const num = (xs) => xs.filter((x) => x !== "" && x != null && Number.isFinite(Number(x))).map(Number);
const est = (xs) => {
  const s = num(xs).sort((a, b) => a - b);
  if (!s.length) return "sin datos";
  const mu = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mu) ** 2, 0) / (s.length - 1 || 1));
  return `n=${s.length} media=${mu.toFixed(2)} sd=${sd.toFixed(2)} min=${s[0].toFixed(2)} max=${s[s.length - 1].toFixed(2)}`;
};

console.log(`\nESCRITOS (fuera de git, en ${SALIDA}/):`);
console.log(`  eb-bis-cohorte.csv       ${cohorte.length} filas   seudonimizado`);
if (quierenIdentificado) {
  console.log(`  eb-bis-de-gildardo.csv   ${deGildardo.length} filas   CON NOMBRE Y DOCUMENTO`);
  if (deGildardo.length < 30) {
    console.log(`\n  ⚠ ${deGildardo.length} filas es POCO para ver el patron de una formula. El archivo de la cohorte`);
    console.log(`    (${cohorte.length} filas) es el que responde la pregunta, y no lleva nombres.`);
  }
} else {
  console.log(`  (el identificado NO se genero: va solo con --identificado)`);
}

// CUANTAS CELDAS QUEDAN VACIAS POR COLUMNA NUEVA. Se imprime antes de las estadisticas porque decide si
// una columna sirve para analizar: una con 300 vacias no es un dato, es una anecdota.
console.log("\nLAS COLUMNAS NUEVAS, Y CUANTAS FILAS LAS TIENEN VACIAS:");
for (const c of COLS_COMPOSICION) {
  if (c === "origen_composicion") continue;
  const vacias = cohorte.filter((f) => f[c] === "" || f[c] == null).length;
  const marca = vacias === 0 ? "completa" : vacias > cohorte.length / 2 ? "⚠ MAS DE LA MITAD VACIA" : "";
  console.log(`  ${c.padEnd(24)} ${String(cohorte.length - vacias).padStart(4)} con dato · ${String(vacias).padStart(4)} vacias   ${marca}`);
}

console.log("\nLO QUE SE VE SIN ABRIR NADA:");
console.log("  EB-BIS           " + est(cohorte.map((f) => f.EB_BIS)));
console.log("  edad real        " + est(cohorte.map((f) => f.edad_a_la_medicion)));
console.log("  IAE              " + est(cohorte.map((f) => f.IAE)));
console.log("  ICEC (LE8)       " + est(cohorte.map((f) => f.ICEC_LE8)) + "   (la formula supone media 58,58 y sd 13,33)");
console.log("  PABU             " + est(cohorte.map((f) => f.PABU)) + "   (la formula supone media 1,8303 y sd 0,7741)");
console.log("  IFC              " + est(cohorte.map((f) => f.IFC)) + "   (la formula supone media 4,0146 y sd 2,2669)");
console.log("  IFC en hombres   " + est(cohorte.filter((f) => f.sexo === "M").map((f) => f.IFC)));
console.log("  IFC en mujeres   " + est(cohorte.filter((f) => f.sexo === "F").map((f) => f.IFC)));
console.log("  peso (kg)        " + est(cohorte.map((f) => f.peso_kg)));
console.log("  talla (cm)       " + est(cohorte.map((f) => f.talla_cm)));
console.log("  MLG (kg)         " + est(cohorte.map((f) => f.MLG_kg)));
console.log("  ACT (L)          " + est(cohorte.map((f) => f.ACT_L)));
console.log("  masa seca (kg)   " + est(cohorte.map((f) => f.masa_seca_sin_grasa_kg)) + "   (la del equipo, NO calculada como MLG - ACT)");
console.log("  prensil (Kgf)    " + est(cohorte.map((f) => f.fuerza_prensil_kgf)) + "   (opcional: la mide el profesional, no el equipo)");
const conAviso = cohorte.filter((f) => f.aviso_edad);
console.log(`\nFILAS CON AVISO DE EDAD: ${conAviso.length}  (su IAE no es confiable: la edad que entro al motor no es la de hoy)`);
for (const f of conAviso) console.log(`  ${f.evaluacion.slice(0, 8)} · ${f.aviso_edad} · edad hoy ${f.edad_a_la_medicion} · el motor uso ${f.edad_que_uso_el_motor}`);
