// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUIEN ENTRA AL RECALCULO DE LA EB-BIS v7, Y QUIEN NO  ·  SOLO LECTURA  ·  2026-10-28
//
// ═══ DE DONDE SALE ═══
//
// Santiago, 2026-10-28: *"El recalculo: sus errores 3, 4 y 6 ya estan resueltos (computeAge), y los 1 y 2
// quedan excluidos por la huella. Recalcula las limpias por el flujo de correccion
// (recalibracion_ciencia) y deja las de huella para cuando Angela corrija. Antes de correrlo en
// produccion, dime cuantas entran, cuantas quedan fuera y por que (huella, sin fecha de nacimiento,
// menores de 18), y los 16 informes enviados que no se tocan."*
//
// ═══ POR QUE ESTE REPORTE EXISTE ANTES DEL RECALCULO Y NO DESPUES ═══
//
// Porque el recalculo ESCRIBE: crea una version nueva de cada diagnostico. Un recalculo que corre primero
// y se cuenta despues deja la pregunta "¿esto era lo que debia pasar?" sin forma de responderla, y en una
// base con pacientes reales no hay vuelta atras barata. Las cifras de aqui son el contrato: si al correr
// no coinciden, el recalculo se detiene.
//
// ═══ QUE NO HACE ═══
//
// NADA. No escribe, no crea versiones, no toca informes. Y no imprime datos de paciente: ids cortos,
// edades, conteos y motivos.
//
// COMO SE CORRE:
//   node --env-file=.env.production.local scripts/QUIEN_ENTRA_AL_RECALCULO_V7_2026-10-28.mjs
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
anunciarBase(url, "cuenta quien entra al recalculo de la EB-BIS v7 (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// La edad minima de su §4.1, que cambio con 7.1.0 (eran 16 en 7.0.0).
const EDAD_MINIMA = 18;
const EDAD_MAXIMA = 100;

/** Años cumplidos a una fecha. Misma lectura que el motor: exige YYYY-MM-DD exacto y trunca. */
function edadCumplida(nacimiento, hasta) {
  if (typeof nacimiento !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return null;
  const n = new Date(`${nacimiento}T00:00:00Z`);
  const h = new Date(hasta);
  if (Number.isNaN(n.getTime()) || Number.isNaN(h.getTime())) return null;
  let edad = h.getUTCFullYear() - n.getUTCFullYear();
  const mes = h.getUTCMonth() - n.getUTCMonth();
  if (mes < 0 || (mes === 0 && h.getUTCDate() < n.getUTCDate())) edad -= 1;
  if (edad < 0 || edad > 130) return null;
  return edad;
}

// ── LAS EVALUACIONES VIGENTES, con lo que el recalculo necesita mirar ──────────────────────────────
//
// VIGENTES: ni reemplazadas por una correccion (`superseded_at`) ni retiradas (`retirada_at`). Es el
// mismo universo que usa el aviso de medicion repetida, a proposito: recalcular una version ya
// reemplazada seria crear una version nueva de algo que ya no esta en pie.
const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, created_at, superseded_at, retirada_at, " +
    "patients!inner(id, cuenta_como_de_prueba, patient_profiles!inner(birth_date)), " +
    "bis_measurements(id, measurement_date)",
);

const vigentes = evaluaciones.filter((e) => e.superseded_at == null && e.retirada_at == null);
const dePrueba = vigentes.filter((e) => e.patients?.cuenta_como_de_prueba === true);
const reales = vigentes.filter((e) => e.patients?.cuenta_como_de_prueba !== true);

console.log(`\nEVALUACIONES EN TOTAL: ${evaluaciones.length}`);
console.log(`  vigentes (sin reemplazar ni retirar): ${vigentes.length}`);
console.log(`  de esas, de pacientes de prueba: ${dePrueba.length} (NO entran: no son operacion real)`);
console.log(`  reales: ${reales.length}`);

// ── MOTIVO POR MOTIVO, EN EL ORDEN EN QUE EL RECALCULO DECIDE ──────────────────────────────────────
//
// EL ORDEN IMPORTA Y SE DEJA ESCRITO: una evaluacion puede caer en DOS motivos a la vez (huella repetida
// Y sin fecha de nacimiento, que es el caso del par del 16 de septiembre de su anexo A). Contarla en los
// dos infla el total y las sumas dejan de cerrar; contarla por el PRIMERO que aplica hace que los grupos
// sean disjuntos y que "entran + no entran = reales" se pueda comprobar.
// ── LA HUELLA REPETIDA, con la MISMA definicion que el freno y el aviso ───────────────────────────
//
// SON CUATRO LECTURAS Y NO MAS: Re, Ri, Rinf y C (`CAMPOS_DE_LA_HUELLA`). No entran peso ni talla (al ser
// menos precisos no añaden certeza y un redondeo distinto volveria invisible un duplicado real), y no
// entra la fecha (en los grupos reales a veces coincidia y a veces no).
//
// LOS NOMBRES SON LOS QUE LA BASE GUARDA, no los campos del motor: `bis_raw_values.variable_name` lleva el
// ENCABEZADO del equipo pasado por `normalizeHeader`, asi que la fila de Re se llama "Extracellular
// resistance" y no "Re". Esto ya fallo dos veces por recortar el encabezado a mano, asi que los cuatro
// nombres se comprueban contra la base antes de contar: si alguno no aparece, el script se para en vez de
// decir que no hay huellas repetidas.
const VARIABLES_DE_LA_HUELLA = [
  "Extracellular resistance",
  "Intracellular resistance Ω",
  "Infinite resistance",
  "Membrane capacitance nF",
];

const valores = await todasLasFilas(db, "bis_raw_values", "measurement_id, variable_name, value");
const presentes = new Set(valores.map((v) => v.variable_name));
const ausentes = VARIABLES_DE_LA_HUELLA.filter((n) => !presentes.has(n));
if (ausentes.length) {
  console.error(`
No encontre estas variables de la huella en la base: ${ausentes.join(", ")}.`);
  console.error("Se detiene: sin ellas el conteo de huellas repetidas saldria en cero y pareceria limpio.");
  process.exit(1);
}

const repetidas = new Set();
{
  const porMedicion = new Map();
  for (const v of valores) {
    if (!porMedicion.has(v.measurement_id)) porMedicion.set(v.measurement_id, new Map());
    // NUMERICO, NO TEXTO: la base devuelve numeric como cadena y "2.04" y "2.040" son el mismo valor.
    const n = Number(v.value);
    if (Number.isFinite(n)) porMedicion.get(v.measurement_id).set(v.variable_name, n);
  }
  const porHuella = new Map();
  for (const e of vigentes) {
    for (const m of e.bis_measurements ?? []) {
      const vals = porMedicion.get(m.id);
      if (!vals) continue;
      // Sin las cuatro lecturas NO SE PUEDE COMPARAR, que no es lo mismo que no haber duplicado: se deja
      // pasar, igual que hace el freno.
      if (VARIABLES_DE_LA_HUELLA.some((k) => !vals.has(k))) continue;
      const h = VARIABLES_DE_LA_HUELLA.map((k) => String(vals.get(k))).join("|");
      if (!porHuella.has(h)) porHuella.set(h, new Set());
      porHuella.get(h).add(e.id);
    }
  }
  for (const ids of porHuella.values()) {
    if (ids.size > 1) for (const id of ids) repetidas.add(id);
  }
}

const motivos = new Map([
  ["huella repetida (sus errores 1 y 2: esperan la correccion de Angela)", []],
  ["sin medicion BIS (no hay nada que recalcular)", []],
  ["sin fecha de nacimiento legible (su error 3)", []],
  [`menor de ${EDAD_MINIMA} años (su error 7)`, []],
  [`mayor de ${EDAD_MAXIMA} años (fuera del rango de su §4.1)`, []],
]);
const entran = [];

for (const e of reales) {
  const medicion = (e.bis_measurements ?? [])[0];
  const nacimiento = e.patients?.patient_profiles?.birth_date ?? null;
  const fecha = medicion?.measurement_date ?? e.created_at;
  const edad = edadCumplida(nacimiento, fecha);

  if (repetidas.has(e.id)) {
    motivos.get("huella repetida (sus errores 1 y 2: esperan la correccion de Angela)").push(e);
  } else if (medicion == null) {
    motivos.get("sin medicion BIS (no hay nada que recalcular)").push(e);
  } else if (edad == null) {
    motivos.get("sin fecha de nacimiento legible (su error 3)").push(e);
  } else if (edad < EDAD_MINIMA) {
    motivos.get(`menor de ${EDAD_MINIMA} años (su error 7)`).push({ ...e, edad });
  } else if (edad > EDAD_MAXIMA) {
    motivos.get(`mayor de ${EDAD_MAXIMA} años (fuera del rango de su §4.1)`).push({ ...e, edad });
  } else {
    entran.push({ ...e, edad });
  }
}

console.log(`\n═══ ENTRAN AL RECALCULO: ${entran.length} ═══`);
console.log(`═══ QUEDAN FUERA: ${reales.length - entran.length} ═══\n`);
for (const [motivo, lista] of motivos) {
  console.log(`  ${lista.length}  ${motivo}`);
}

// CONTROL DE QUE LAS SUMAS CIERRAN. Sin esto, un motivo que se solape con otro pasa inadvertido y el
// reporte da una cifra creible que no cuadra con nada.
const fuera = [...motivos.values()].reduce((n, l) => n + l.length, 0);
if (entran.length + fuera !== reales.length) {
  console.error(
    `\nLAS SUMAS NO CIERRAN: ${entran.length} + ${fuera} != ${reales.length}. Hay un solapamiento entre motivos.`,
  );
  process.exit(1);
}
console.log(`\n  (control: ${entran.length} + ${fuera} = ${reales.length}, cierra)`);

// ── LOS INFORMES YA ENVIADOS, QUE NO SE TOCAN ─────────────────────────────────────────────────────
//
// Su §6, literal: *"Los informes ya entregados a pacientes no se modifican; los nuevos informes se emiten
// con la v7."* Asi que el recalculo puede crear una version nueva del DIAGNOSTICO y el informe que ya
// salio se queda como salio. Se cuentan aqui para que el numero sea parte del contrato: si al correr
// aparecen mas, alguien envio informes en medio y hay que mirarlo antes de seguir.
const reportes = await todasLasFilas(db, "reports", "id, evaluation_id, status, created_at");
const enviados = reportes.filter((r) => r.status === "sent");
const enviadosDeLasQueEntran = enviados.filter((r) => entran.some((e) => e.id === r.evaluation_id));
const enviadosDeLasQueNo = enviados.length - enviadosDeLasQueEntran.length;

console.log(`\n═══ INFORMES YA ENVIADOS: ${enviados.length} (NO se modifican, su §6) ═══`);
console.log(`  de evaluaciones que entran al recalculo: ${enviadosDeLasQueEntran.length}`);
console.log(`  de evaluaciones que NO entran: ${enviadosDeLasQueNo}`);
console.log(
  `\n  LO QUE ESO SIGNIFICA: esas ${enviadosDeLasQueEntran.length} evaluaciones tendran un diagnostico`,
);
console.log(
  "  recalculado con la v7 mientras el paciente tiene en su correo un informe con la cifra de la v5.",
);
console.log("  Es lo que su §6 ordena. Si alguna hay que reemitir, es una decision aparte y suya.");

// ── Y LO QUE DE VERDAD SE RECALCULA: las que YA TIENEN un diagnostico ─────────────────────────────
//
// RECALCULAR ES CREAR UNA VERSION NUEVA DE UN DIAGNOSTICO QUE EXISTE. Una evaluacion con medicion pero
// SIN diagnostico no se recalcula: no hay nada que versionar, y cuando su profesional entre a la pestaña
// de diagnostico se generara con la v7 sola. Separarlo importa porque, sin separarlo, "entran N" promete
// N versiones nuevas y el recalculo produciria menos sin que nadie supiera por que.
let diagnosticos = [];
for (let desde = 0; ; desde += 500) {
  const { data, error } = await db
    .from("diagnoses")
    .select("evaluation_id, engine_version")
    .order("id", { ascending: true })
    .range(desde, desde + 499);
  if (error) {
    console.error(`No se pudieron leer los diagnosticos: ${error.message}`);
    process.exit(1);
  }
  diagnosticos = diagnosticos.concat(data ?? []);
  if ((data ?? []).length < 500) break;
}
const conDiagnostico = new Map(diagnosticos.map((d) => [d.evaluation_id, d.engine_version]));
const aRecalcular = entran.filter((e) => conDiagnostico.has(e.id));
const sinDiagnostico = entran.filter((e) => !conDiagnostico.has(e.id));

console.log(`\n═══ DE LAS ${entran.length} QUE ENTRAN ═══`);
console.log(`  ${aRecalcular.length}  SE RECALCULAN (tienen diagnostico: se crea una version nueva)`);
console.log(`  ${sinDiagnostico.length}  no tienen diagnostico todavia: saldran con la v7 al generarse`);

// Y CON QUE VERSION ESTAN SELLADAS HOY, porque es lo que hace que la banda no reste dos escalas: todo lo
// que este en un MAYOR distinto de 2 queda marcado como no comparable hasta que se recalcule.
const porVersion = new Map();
for (const e of aRecalcular) {
  const v = conDiagnostico.get(e.id) ?? "(sin version)";
  porVersion.set(v, (porVersion.get(v) ?? 0) + 1);
}
console.log("\n  version del motor con la que estan selladas hoy:");
for (const [v, n] of [...porVersion].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${v}: ${n}`);
}

// ── Y LA DISTRIBUCION DE EDADES DE LAS QUE ENTRAN, para ver si el esperado curvo pesa ──────────────
const porDecada = new Map();
for (const e of entran) {
  const d = Math.floor(e.edad / 10) * 10;
  porDecada.set(d, (porDecada.get(d) ?? 0) + 1);
}
console.log("\nEDADES DE LAS QUE ENTRAN (el esperado curvo corrige sobre todo por encima de 70):");
for (const d of [...porDecada.keys()].sort((a, b) => a - b)) {
  // EL PRIMER TRAMO SE ROTULA 18-19 Y NO 10-19: la decada de los 10 asusta en un reporte donde los
  // menores de 18 estan excluidos, y leerlo como un error cuesta mas que escribir el rotulo bien.
  console.log(`  ${Math.max(d, EDAD_MINIMA)}-${d + 9}: ${porDecada.get(d)}`);
}

console.log("\nListo. Nada se escribio.\n");
