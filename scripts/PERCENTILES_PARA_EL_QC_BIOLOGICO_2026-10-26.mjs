// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS PERCENTILES 0,5 Y 99,5 DE LA COHORTE, PARA QUE GILDARDO FIRME LOS LIMITES DEL QC BIOLOGICO
// SOLO LECTURA  ·  2026-10-26
//
// ═══ DE DONDE SALE ═══
//
// v12, seccion 2: *"PENDIENTE DE VALIDACION - los numeros de QC_BIO_LIMITES no estan aprobados. Los puse
// anchos a proposito... Deben reemplazarse por los percentiles extremos de la cohorte real. Santiago: saca
// del observatorio el percentil 0,5 y el 99,5 de cada variable y me los traes; yo los firmo."*
//
// ═══ LA COHORTE LIMPIA, Y POR QUE ESAS TRES EXCLUSIONES ═══
//
//   · SIN PACIENTES DE PRUEBA (`cuenta_como_de_prueba`, 0202/0203): sus mediciones son del mismo archivo
//     repetido veintiseis veces, asi que un percentil sobre ellas describe ese archivo, no la poblacion.
//   · SIN REEMPLAZADAS NI RETIRADAS (`superseded_at`, `retirada_at`): una medicion corregida cuenta UNA
//     vez, no dos, y una consulta que no ocurrio no aporta un cuerpo.
//   · SIN HUELLA REPETIDA (0230): son la MISMA toma fisica en dos historias. Contarla dos veces le da
//     doble peso a un cuerpo en el extremo, que es justo donde viven estos percentiles.
//
// ═══ EL LIMITE QUE ESTO TIENE, Y HAY QUE DECIRLO AL ENTREGARLO ═══
//
// Un percentil 0,5 sobre N mediciones es, literalmente, el valor por debajo del cual cae el 0,5 % de
// ellas. Con N cerca de 400, eso son DOS mediciones por cola: el corte lo decide practicamente un solo
// paciente. Por eso la tabla trae ademas el MINIMO, el MAXIMO y N, y los percentiles 1 y 99, que con esta
// N son mas estables. La eleccion es suya; lo que no se puede es entregar un numero sin decir sobre
// cuantas mediciones se calculo.
//
// Y LA REGLA DE SANTIAGO (2026-10-02) sigue en pie: un rango que RECHAZA una medicion decide sobre un
// paciente. Si un percentil deja fuera a alguien que midio de verdad, el que esta mal es el rango.
//
// NO IMPRIME DATOS DE PACIENTE: solo estadisticos por variable.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/PERCENTILES_PARA_EL_QC_BIOLOGICO_2026-10-26.mjs
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
anunciarBase(url, "calcula los percentiles del QC biologico (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// ── LAS CATORCE VARIABLES DE `QC_BIO_LIMITES`, con el encabezado con el que viven en `bis_raw_values` ──
//
// Los nombres salen de `BIODY_COLUMNS` (el contrato del export) pasados por `normalizeHeader`, que es como
// quedan guardados. La fuerza prensil NO viene del equipo: la mide el profesional y vive en
// `evaluation_bis_intake.grip_strength_kg`.
const DEL_EQUIPO = [
  { clave: "talla", unidad: "cm", header: "Altura cm", limiteV12: [100, 230] },
  { clave: "peso", unidad: "kg", header: "Peso kg", limiteV12: [25, 300] },
  {
    clave: "IMC",
    unidad: "kg/m²",
    header: "Body Mass Index (BMI) measurementDetails.VALEURCALCULEEEXPORT kg/m²",
    limiteV12: [10, 80],
  },
  { clave: "cintura", unidad: "cm", header: "Waist Size cm", limiteV12: [40, 220] },
  { clave: "cadera", unidad: "cm", header: "Hips Size cm", limiteV12: [50, 220] },
  { clave: "Re", unidad: "Ω", header: "Extracellular resistance", limiteV12: [200, 1500] },
  { clave: "Ri", unidad: "Ω", header: "Intracellular resistance Ω", limiteV12: [300, 5000] },
  { clave: "Rinf", unidad: "Ω", header: "Infinite resistance", limiteV12: [100, 1200] },
  { clave: "C", unidad: "nF", header: "Membrane capacitance nF", limiteV12: [0.3, 10] },
  { clave: "Fo", unidad: "kHz", header: "Characteristic frequency kHz", limiteV12: [10, 150] },
  { clave: "AF", unidad: "°", header: "Ángulo de fase a 50 kHz °", limiteV12: [2, 12] },
  {
    clave: "grasa %",
    unidad: "%",
    header: "Masa grasa bruta measurementDetails.VALEURCALCULEEEXPORT %",
    limiteV12: [2, 70],
  },
  {
    clave: "hidratación MLG %",
    unidad: "%",
    header: "Hidratación sin grasa measurementDetails.VALEURCALCULEEEXPORT %",
    limiteV12: [60, 85],
  },
];

// ═══ EL ENCABEZADO TAL COMO LO GUARDA LA BASE, Y NO BASTA RECORTARLO ═══
//
// `normalizeHeader` TRADUCE los tokens internos de BiodyLife antes de guardar:
// `measurementDetails.VALEURCALCULEEEXPORT` -> `valor`, `...REFERENCEESTIMEEEXPORT` -> `referencia`,
// `...ECARTTHEORIQUEEXPORT` -> `desviacion`. Con solo `.trim()`, IMC, grasa % e hidratacion salieron con
// CERO valores y la tabla los mostraba vacios como si el dato no existiera. Ya es la tercera vez que este
// `.trim()` de menos cuesta un dato (ver la memoria del repositorio).
const normalizar = (h) =>
  h
    .replace(/measurementDetails\.VALEURCALCULEEEXPORT/g, "valor")
    .replace(/measurementDetails\.REFERENCEESTIMEEEXPORT/g, "referencia")
    .replace(/measurementDetails\.ECARTTHEORIQUEEXPORT/g, "desviacion")
    .replace(/\s+/g, " ")
    .trim();

// ── LA COHORTE ──────────────────────────────────────────────────────────────────────────────────────
const pacientes = await todasLasFilas(db, "patients", "id, cuenta_como_de_prueba, deleted_at", (q) =>
  q.is("deleted_at", null),
);
const reales = new Set(pacientes.filter((p) => !p.cuenta_como_de_prueba).map((p) => p.id));

const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, status, superseded_at, retirada_at",
);
const NO_ES_CONSULTA = new Set(["awaiting_survey", "abandoned"]);
const vigentes = new Map(
  evaluaciones
    .filter(
      (e) =>
        reales.has(e.patient_id) &&
        !e.superseded_at &&
        !e.retirada_at &&
        !NO_ES_CONSULTA.has(e.status),
    )
    .map((e) => [e.id, e]),
);

const mediciones = await todasLasFilas(db, "bis_measurements", "id, evaluation_id");
const delEquipo = mediciones.filter((m) => vigentes.has(m.evaluation_id));

// ── LA HUELLA, PARA EXCLUIR LAS REPETIDAS ───────────────────────────────────────────────────────────
const VARIABLES_HUELLA = [
  "Extracellular resistance",
  "Intracellular resistance Ω",
  "Infinite resistance",
  "Membrane capacitance nF",
];
const crudosHuella = await todasLasFilas(
  db,
  "bis_raw_values",
  "measurement_id, variable_name, value",
  (q) => q.in("variable_name", VARIABLES_HUELLA),
);
const porMedicionHuella = new Map();
for (const c of crudosHuella) {
  const n = Number(c.value);
  if (!Number.isFinite(n)) continue;
  const ya = porMedicionHuella.get(c.measurement_id) ?? new Map();
  ya.set(c.variable_name, n);
  porMedicionHuella.set(c.measurement_id, ya);
}
const huellaDe = (id) => {
  const m = porMedicionHuella.get(id);
  if (!m) return null;
  const partes = [];
  for (const v of VARIABLES_HUELLA) {
    const n = m.get(v);
    if (n === undefined) return null;
    partes.push(String(n));
  }
  return partes.join("|");
};
const porHuella = new Map();
for (const m of delEquipo) {
  const h = huellaDe(m.id);
  if (h === null) continue;
  const ya = porHuella.get(h) ?? [];
  ya.push(m);
  porHuella.set(h, ya);
}
const repetidas = new Set();
for (const [, grupo] of porHuella) {
  if (new Set(grupo.map((m) => m.evaluation_id)).size > 1) for (const m of grupo) repetidas.add(m.id);
}

const limpias = delEquipo.filter((m) => !repetidas.has(m.id));
console.log("LA COHORTE");
console.log(`  mediciones de consultas vigentes de pacientes reales: ${delEquipo.length}`);
console.log(`  menos las de huella repetida:                        -${delEquipo.length - limpias.length}`);
console.log(`  COHORTE LIMPIA:                                       ${limpias.length} mediciones`);

// ── LOS VALORES ─────────────────────────────────────────────────────────────────────────────────────
const idsLimpias = new Set(limpias.map((m) => m.id));
const headers = DEL_EQUIPO.map((v) => normalizar(v.header));
const crudos = await todasLasFilas(db, "bis_raw_values", "measurement_id, variable_name, value", (q) =>
  q.in("variable_name", headers),
);
const porVariable = new Map(headers.map((h) => [h, []]));
for (const c of crudos) {
  if (!idsLimpias.has(c.measurement_id)) continue;
  const n = Number(c.value);
  // CERO Y VACIO SON "SIN DATO", NO VALOR, y es la primera regla de diseño que v12 pide no deshacer: un
  // parametro sin capturar llega como 0, y contarlo arrastraria todos los percentiles bajos a cero.
  if (!Number.isFinite(n) || n === 0) continue;
  porVariable.get(c.variable_name)?.push(n);
}

// La fuerza prensil, que no viene del equipo.
const intakes = await todasLasFilas(
  db,
  "evaluation_bis_intake",
  "evaluation_id, grip_strength_kg",
);
const idsEvalLimpias = new Set(limpias.map((m) => m.evaluation_id));
const fuerza = intakes
  .filter((i) => idsEvalLimpias.has(i.evaluation_id))
  .map((i) => Number(i.grip_strength_kg))
  .filter((n) => Number.isFinite(n) && n > 0);

/** Percentil por interpolacion lineal (el metodo R-7, el de Excel y el de numpy por defecto). */
function percentil(ordenados, p) {
  if (ordenados.length === 0) return null;
  if (ordenados.length === 1) return ordenados[0];
  const i = (p / 100) * (ordenados.length - 1);
  const bajo = Math.floor(i);
  const alto = Math.ceil(i);
  if (bajo === alto) return ordenados[bajo];
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (i - bajo);
}

const fmt = (n) => (n == null ? "-" : Number(n.toFixed(2)).toString());

console.log("\nPERCENTILES DE LA COHORTE LIMPIA");
console.log(
  "| variable | n | min | p0,5 | p1 | p99 | p99,5 | max | límite de v12 | ¿el límite de v12 deja fuera a alguien? |",
);
console.log("|---|---|---|---|---|---|---|---|---|---|");

const filas = [
  ...DEL_EQUIPO.map((v) => ({ ...v, valores: porVariable.get(normalizar(v.header)) ?? [] })),
  { clave: "fuerza prensil", unidad: "kgf", limiteV12: [1, 90], valores: fuerza },
];

for (const v of filas) {
  const ord = [...v.valores].sort((a, b) => a - b);
  const [lo, hi] = v.limiteV12;
  const fueraDelLimite = ord.filter((x) => x < lo || x > hi).length;
  console.log(
    `| ${v.clave} (${v.unidad}) | ${ord.length} | ${fmt(ord[0])} | ${fmt(percentil(ord, 0.5))} | ` +
      `${fmt(percentil(ord, 1))} | ${fmt(percentil(ord, 99))} | ${fmt(percentil(ord, 99.5))} | ` +
      `${fmt(ord[ord.length - 1])} | ${lo}-${hi} | ${fueraDelLimite === 0 ? "no" : `SÍ: ${fueraDelLimite}`} |`,
  );
}

// ── LO QUE LOS NUMEROS DICEN, Y QUE HAY QUE DECIRLE CON ELLOS ───────────────────────────────────────
console.log("\nLOS CUATRO VALORES REALES QUE LOS LIMITES PROVISIONALES DE v12 RECHAZARIAN:");
for (const v of filas) {
  const [lo, hi] = v.limiteV12;
  const fuera = v.valores.filter((x) => x < lo || x > hi).sort((a, b) => a - b);
  if (fuera.length === 0) continue;
  console.log(`  ${v.clave}: ${fuera.map((x) => Number(x.toFixed(2))).join(", ")} ${v.unidad} (limite ${lo}-${hi})`);
}

console.log(
  "\nY LA ADVERTENCIA QUE VA CON LA TABLA, porque los percentiles son el INSUMO y no el LIMITE:\n" +
    "  Adoptar p0,5 y p99,5 como cortes DUROS rechaza, por construccion, cerca del 1 % de las mediciones\n" +
    "  reales (medio por cola). Para un filtro que existe para atrapar un error de digitacion, eso es al\n" +
    "  reves: sacaria de la cohorte a pacientes que midieron bien. La regla del repositorio lo dice desde\n" +
    "  el caso de la capacitancia de 16,22 nF: un cinturon sin fuente se pone tan ancho que solo atrape lo\n" +
    "  IMPOSIBLE (una unidad cambiada, un cero de mas), nunca lo improbable.\n" +
    "  Asi que la tabla trae el MINIMO y el MAXIMO observados al lado: la banda de percentiles sirve para\n" +
    "  decir 'mira esta medicion', y el corte que FRENA deberia caer fuera del minimo y del maximo reales.\n" +
    "  La decision es de Gildardo; lo que no se puede es entregarle el percentil sin esta linea.",
);

console.log("\nEL LIMITE DE ESTO, QUE HAY QUE DECIRLE AL ENTREGARLO:");
const n = (porVariable.get(normalizar(DEL_EQUIPO[5].header)) ?? []).length;
console.log(
  `  con n = ${n}, el percentil 0,5 lo deciden las ${Math.max(1, Math.round(n * 0.005))} mediciones mas bajas.\n` +
    `  Por eso van tambien el minimo, el maximo y los percentiles 1 y 99, que con esta n son mas estables.`,
);

console.log("\nListo. Nada se escribio.\n");
