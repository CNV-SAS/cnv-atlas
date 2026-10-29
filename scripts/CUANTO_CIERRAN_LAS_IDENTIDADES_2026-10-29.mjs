// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS ONCE IDENTIDADES IMPOSIBLES, MEDIDAS SOBRE LA COHORTE REAL  ·  SOLO LECTURA  ·  2026-10-29
//
// ═══ POR QUE SE MIDE ANTES DE CONSTRUIR, Y NO DESPUES ═══
//
// Las identidades son SUYAS y definitivas (v12: *"las identidades de la lista «imposible» sí son
// definitivas"*), asi que no hay nada que elegir en ELLAS. Pero TRES de las once son SUMAS que tienen que
// cuadrar:
//
//   · Rc = (Re + R∞)/2
//   · masa grasa + masa sin grasa = peso
//   · agua extracelular + intracelular = agua total
//
// Y una suma que "tiene que cuadrar" necesita una TOLERANCIA, porque el equipo exporta con uno o dos
// decimales y una suma de valores redondeados no da exacto nunca. Esa tolerancia es un umbral que decide
// sobre un dato clinico, asi que no se puede elegir a ojo: es exactamente el defecto del `SANITY` que dejo
// sin diagnostico a una paciente real con una capacitancia de 16,22 nF, cuyo rango nadie supo de donde
// salia.
//
// ASI QUE SE MIDE LA DISTRIBUCION DEL RESIDUO en las mediciones reales, y la tolerancia se pone fuera del
// maximo observado: asi solo atrapa lo IMPOSIBLE (una unidad cambiada, un cero de mas) y nunca a una
// persona que midio bien. Es la regla de Santiago del 2026-10-02 aplicada antes de escribir el numero, no
// despues de que frene a alguien.
//
// ═══ Y SE MIDE CUANTAS EVALUACIONES EXISTENTES VIOLARIAN CADA IDENTIDAD ═══
//
// Porque el panel FRENA. Si resulta que decenas de consultas ya emitidas violan una identidad, el panel
// no llega como una red que casi nunca salta: llega como un freno retroactivo sobre historias cerradas, y
// eso es una decision de Santiago, no una consecuencia tecnica que yo pueda dar por buena.
//
// NO IMPRIME DATOS DE PACIENTE: conteos, residuos y los ids cortos de lo que viola.
//
// COMO SE CORRE:
//   node --env-file=.env.production.local scripts/CUANTO_CIERRAN_LAS_IDENTIDADES_2026-10-29.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";
import { todasLasFilas } from "./lib/todas-las-filas.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "mide las once identidades imposibles sobre la cohorte real (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// Los `variable_name` tal como los guarda `normalizeHeader`. Se piden TODOS los que entran en las once.
const PEDIDAS = {
  peso: "Peso kg",
  Re: "Extracellular resistance",
  Ri: "Intracellular resistance Ω",
  Rinf: "Infinite resistance",
  C: "Membrane capacitance nF",
  Fo: "Characteristic frequency kHz",
  Rc: "Rcc circle center resistance",
  Xc: "Xcc reactance of center of circle",
  Z5: "Z5 Ohm",
  Z200: "Z200 Ohm",
};
// LOS NOMBRES REALES, Y POR QUE NO SON LOS DEL ENCABEZADO DEL EXPORT.
//
// `bis_raw_values.variable_name` guarda el encabezado PASADO POR `normalizeHeader`, que TRADUCE los
// sufijos del Biody: `measurementDetails.VALEURCALCULEEEXPORT` -> `valor`, `REFERENCEESTIMEEEXPORT` ->
// `referencia`, `ECARTTHEORIQUEEXPORT` -> `desviacion`. La primera version de este script uso los
// encabezados de `BIODY_COLUMNS` y las CINCO identidades de composicion salieron todas en cero: no es
// que nadie las violara, es que no se estaban evaluando. Es la tercera vez que esta traduccion muerde.
//
// Un script .mjs no puede importar `normalizeHeader` (vive en TypeScript, detras del alias `@/`), asi
// que los nombres van escritos, pero NO a ciegas: se verifican contra la base y el script LANZA si
// alguno no existe. Un nombre mal escrito tiene que fallar en voz alta, no devolver cero.
const PREFIJOS = {
  FM: "Masa grasa bruta valor kg",
  FM_pct: "Masa grasa bruta valor %",
  FFM: "Masa sin grasa valor kg",
  TBW: "Agua total valor L",
  ECW: "Extracellular water valor L",
  ICW: "Intracellular water (ICW) valor L",
  SMM: "Masa muscular esquelética valor kg",
  MCA: "Masa celular activa valor kg",
};
const NOMBRES = [...Object.values(PEDIDAS), ...Object.values(PREFIJOS)];

const crudos = await todasLasFilas(
  db,
  "bis_raw_values",
  "measurement_id, variable_name, value",
  (q) => q.in("variable_name", NOMBRES),
  { orden: "measurement_id,variable_name" },
);

// CADA NOMBRE TIENE QUE EXISTIR EN LA BASE. Sin esto, un nombre mal escrito da cero filas y el script
// informa "ninguna medicion viola esta identidad", que es la peor salida posible: tranquiliza con nada.
const nombresVistos = new Set(crudos.map((c) => c.variable_name));
const faltan = NOMBRES.filter((n) => !nombresVistos.has(n));
if (faltan.length > 0) {
  console.error("Estos variable_name no existen en bis_raw_values (nombre mal escrito):");
  for (const f of faltan) console.error("  " + JSON.stringify(f));
  process.exit(1);
}

const porMedicion = new Map();
for (const c of crudos) {
  const n = Number(c.value);
  if (!Number.isFinite(n)) continue;
  const ya = porMedicion.get(c.measurement_id) ?? new Map();
  ya.set(c.variable_name, n);
  porMedicion.set(c.measurement_id, ya);
}

// ── EL UNIVERSO: mediciones de consultas VIGENTES de pacientes REALES ───────────────────────────────
const mediciones = await todasLasFilas(
  db,
  "bis_measurements",
  "id, evaluation_id, no_es_del_paciente_at",
);
const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, superseded_at, retirada_at",
);
const porEvaluacion = new Map(evaluaciones.map((e) => [e.id, e]));
const pacientes = await todasLasFilas(db, "patients", "id, cuenta_como_de_prueba");
const dePrueba = new Map(pacientes.map((p) => [p.id, Boolean(p.cuenta_como_de_prueba)]));

const cohorte = mediciones.filter((m) => {
  if (m.no_es_del_paciente_at) return false;
  const e = porEvaluacion.get(m.evaluation_id);
  if (!e || e.superseded_at || e.retirada_at) return false;
  return dePrueba.get(e.patient_id) === false;
});

console.log(`COHORTE: ${cohorte.length} mediciones de consultas vigentes de pacientes reales\n`);

// CERO Y VACIO SON "SIN DATO", que es su primera regla de diseño y no se deshace: un parametro sin
// capturar llega como 0, y tratarlo como valor pondria en rojo toda consulta sin espectroscopia.
const v = (m, nombre) => {
  const n = m.get(nombre);
  return n === undefined || n === 0 ? null : n;
};

/** Percentiles de un arreglo de numeros, para elegir la tolerancia por el lado de lo imposible. */
function resumen(xs) {
  if (xs.length === 0) return "sin datos";
  const o = [...xs].sort((a, b) => a - b);
  const p = (q) => o[Math.min(o.length - 1, Math.floor(q * (o.length - 1)))];
  const f = (x) => x.toFixed(4);
  return `n=${o.length}  min=${f(o[0])}  p50=${f(p(0.5))}  p99=${f(p(0.99))}  max=${f(o[o.length - 1])}`;
}

const residuoRc = [];
const residuoPeso = [];
const residuoAgua = [];
const violan = {
  "1 · Re no es mayor que R∞": [],
  "2 · reactancia del centro positiva": [],
  "3 · Rc no es (Re+R∞)/2": [],
  "4 · la impedancia sube con la frecuencia": [],
  "5 · algún parámetro de Cole es negativo": [],
  "6a · masa grasa ≥ peso": [],
  "6b · masa sin grasa > peso": [],
  "7 · grasa + sin grasa no suma el peso": [],
  "8 · agua total ≥ masa sin grasa": [],
  "9 · AEC + AIC no suma el agua total": [],
  "10 · músculo o masa celular activa ≥ masa sin grasa": [],
  "12 · (nuestra) masa grasa o % de grasa ≤ 0": [],
};

for (const med of cohorte) {
  const m = porMedicion.get(med.id);
  if (!m) continue;
  const g = (k) => v(m, PEDIDAS[k] ?? PREFIJOS[k]);
  const id = med.id.slice(0, 8);

  const Re = g("Re"), Ri = g("Ri"), Rinf = g("Rinf"), C = g("C"), Fo = g("Fo"), Rc = g("Rc");
  const Z5 = g("Z5"), Z200 = g("Z200");
  const peso = g("peso"), FM = g("FM"), FFM = g("FFM");
  const TBW = g("TBW"), ECW = g("ECW"), ICW = g("ICW"), SMM = g("SMM"), MCA = g("MCA");

  if (Re != null && Rinf != null) {
    if (Re <= Rinf) violan["1 · Re no es mayor que R∞"].push(id);
    if (Rc != null) residuoRc.push(Math.abs(Rc - (Re + Rinf) / 2));
  }
  // El signo de Xc SE MIDE con el valor crudo, no con `v`: aqui el cero no es "sin dato" sino un valor
  // informativo, pero tampoco es positivo, asi que no viola. Se usa el crudo solo para no perder el caso.
  const XcCrudo = m.get(PEDIDAS.Xc);
  if (XcCrudo !== undefined && XcCrudo > 0) violan["2 · reactancia del centro positiva"].push(id);
  if (Z5 != null && Z200 != null && Z200 > Z5) {
    violan["4 · la impedancia sube con la frecuencia"].push(id);
  }
  for (const [nombre, x] of [["Re", Re], ["Ri", Ri], ["Rinf", Rinf], ["C", C], ["Fo", Fo], ["Rc", Rc]]) {
    if (x != null && x < 0) {
      violan["5 · algún parámetro de Cole es negativo"].push(`${id}(${nombre})`);
      break;
    }
  }
  if (peso != null && FM != null) {
    if (FM >= peso) violan["6a · masa grasa ≥ peso"].push(id);
    if (FFM != null) residuoPeso.push(Math.abs(FM + FFM - peso));
  }
  if (peso != null && FFM != null && FFM > peso) violan["6b · masa sin grasa > peso"].push(id);
  if (FFM != null && TBW != null && TBW >= FFM) violan["8 · agua total ≥ masa sin grasa"].push(id);
  if (TBW != null && ECW != null && ICW != null) residuoAgua.push(Math.abs(ECW + ICW - TBW));
  if (FFM != null && ((SMM != null && SMM >= FFM) || (MCA != null && MCA >= FFM))) {
    violan["10 · músculo o masa celular activa ≥ masa sin grasa"].push(id);
  }
  // LA NUESTRA: una grasa negativa no es un rango ancho, es un valor que no puede existir. El cero NO
  // cuenta (es "sin dato" por su regla), asi que se mira el crudo y se exige que sea negativo.
  const FMcrudo = m.get(PREFIJOS.FM);
  const FMpCrudo = m.get(PREFIJOS.FM_pct);
  if ((FMcrudo !== undefined && FMcrudo < 0) || (FMpCrudo !== undefined && FMpCrudo < 0)) {
    violan["12 · (nuestra) masa grasa o % de grasa ≤ 0"].push(id);
  }
}

console.log("── LOS RESIDUOS DE LAS TRES SUMAS, para elegir la tolerancia fuera del maximo ──────────");
console.log(`  |Rc − (Re+R∞)/2|   (Ω)   ${resumen(residuoRc)}`);
console.log(`  |FM + FFM − peso|  (kg)  ${resumen(residuoPeso)}`);
console.log(`  |AEC + AIC − ACT|  (L)   ${resumen(residuoAgua)}`);
console.log("");

console.log("── CUANTAS MEDICIONES REALES VIOLARIAN CADA IDENTIDAD ──────────────────────────────────");
const todasLasQueViolan = new Set();
for (const [regla, ids] of Object.entries(violan)) {
  if (regla.startsWith("3 ") || regla.startsWith("7 ") || regla.startsWith("9 ")) continue;
  console.log(`  ${ids.length === 0 ? "   0" : String(ids.length).padStart(4)}  ${regla}`);
  for (const id of ids) todasLasQueViolan.add(id.slice(0, 8));
}
console.log("");
console.log(`  (las tres de suma no se cuentan todavia: su tolerancia se elige con los residuos de arriba)`);
console.log(`  MEDICIONES DISTINTAS QUE VIOLAN AL MENOS UNA: ${todasLasQueViolan.size} de ${cohorte.length}`);
for (const [regla, ids] of Object.entries(violan)) {
  if (ids.length > 0 && ids.length <= 12) console.log(`    ${regla}: ${ids.join(", ")}`);
}
