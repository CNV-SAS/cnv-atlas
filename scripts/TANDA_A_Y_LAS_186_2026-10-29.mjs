// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA TANDA (a) DEL RECALCULO, Y LAS 186 SIN MEDICION  ·  SOLO LECTURA  ·  2026-10-29
//
// ═══ DE DONDE SALE (Santiago, 2026-10-29) ═══
//
// (1) *"Primero 5 evaluaciones reales, de pacientes distintos, que incluyan un hombre, una mujer, un
// mayor de 60 y una con encuesta incompleta. Dime cuales son."*
//
// (2) *"Las 186 sin medicion: dame la lista por profesional (cuantas tiene cada uno y desde cuando), sin
// nombres de pacientes. Santiago les recuerda montar el BIS."*
//
// Los dos salen del MISMO barrido porque leen lo mismo (evaluaciones vigentes con su paciente y su
// medicion), y partirlo en dos scripts seria dos definiciones de "vigente" que pueden divergir.
//
// NO IMPRIME DATOS DE PACIENTE: ids cortos, sexo, edad y conteos. Los nombres que SI salen son de
// PROFESIONALES, que es lo que la lista (2) necesita para que Santiago sepa a quien escribirle.
//
// ═══ LAS CIFRAS SE MUEVEN ENTRE CORRIDAS, Y ESO ES CORRECTO ═══
//
// El 28 de octubre este mismo universo daba 186 sin medicion y 354 entrando al recalculo; el 29 da 180 y
// 361. La razon esta medida: SIETE mediciones se montaron entre las dos corridas (seis de ellas la madrugada
// del 29). La base esta viva y la gente trabaja en ella.
//
// POR ESO EL REPORTE PREVIO AL RECALCULO DICE "si al correr no coinciden, se detiene": no es desconfianza
// del script, es que una cifra de ayer no autoriza una escritura de hoy. Se vuelve a correr antes de cada
// tanda.
//
// Y una consecuencia practica de la (2): cada evaluacion que un profesional cierra montando su BIS sale de
// esa lista sola, asi que la lista es un recordatorio que se achica, no un pendiente que alguien tenga que
// marcar.
//
// COMO SE CORRE:
//   node --env-file=.env.production.local scripts/TANDA_A_Y_LAS_186_2026-10-29.mjs
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
anunciarBase(url, "elige la tanda (a) y lista las 186 sin medicion (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

const EDAD_MINIMA = 18;

function edadCumplida(nacimiento, hasta) {
  if (typeof nacimiento !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(nacimiento)) return null;
  const n = new Date(`${nacimiento}T00:00:00Z`);
  const h = new Date(hasta);
  if (Number.isNaN(n.getTime()) || Number.isNaN(h.getTime())) return null;
  let edad = h.getUTCFullYear() - n.getUTCFullYear();
  const mes = h.getUTCMonth() - n.getUTCMonth();
  if (mes < 0 || (mes === 0 && h.getUTCDate() < n.getUTCDate())) edad -= 1;
  return edad < 0 || edad > 130 ? null : edad;
}

// ── EL UNIVERSO: el MISMO que el reporte previo, para que las cifras no puedan discrepar ───────────
const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, professional_id, type, created_at, superseded_at, retirada_at, " +
    "patients!inner(id, cuenta_como_de_prueba, patient_profiles!inner(birth_date, sex)), " +
    "bis_measurements(id, measurement_date)",
);
const reales = evaluaciones.filter(
  (e) =>
    e.superseded_at == null &&
    e.retirada_at == null &&
    e.patients?.cuenta_como_de_prueba !== true,
);

// ── (2) LAS 186 SIN MEDICION, POR PROFESIONAL ─────────────────────────────────────────────────────
const perfiles = await todasLasFilas(
  db,
  "professional_profiles",
  // HINT OBLIGATORIO: `professional_profiles` tiene TRES relaciones hacia `profiles`, y sin desambiguar
  // PostgREST falla en runtime sin que nada lo vea venir.
  "id, is_test, profiles!profile_id(full_name)",
);
const nombreDe = new Map(perfiles.map((p) => [p.id, p.profiles?.full_name ?? p.id.slice(0, 8)]));

const sinMedicion = reales.filter((e) => (e.bis_measurements ?? []).length === 0);
console.log(`\n═══ (2) EVALUACIONES SIN MEDICION BIS: ${sinMedicion.length} ═══`);
console.log("    Son consultas abiertas donde nadie monto el BIS. Sin medicion no hay diagnostico.\n");

const porProfesional = new Map();
for (const e of sinMedicion) {
  const k = e.professional_id ?? "(sin profesional asignado)";
  if (!porProfesional.has(k)) porProfesional.set(k, []);
  porProfesional.get(k).push(e);
}
const filas = [...porProfesional.entries()]
  .map(([id, lista]) => {
    const fechas = lista.map((e) => String(e.created_at).slice(0, 10)).sort();
    return {
      quien: nombreDe.get(id) ?? id,
      cuantas: lista.length,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      // Cuantas son de SEGUIMIENTO: una inicial sin medicion puede ser una consulta que no llego a ser;
      // un seguimiento sin medicion es un control que se hizo y no se midio, que es mas raro.
      seguimientos: lista.filter((e) => e.type === "seguimiento").length,
    };
  })
  .sort((a, b) => b.cuantas - a.cuantas);

for (const f of filas) {
  console.log(
    `  ${String(f.cuantas).padStart(3)}  ${f.quien}` +
      `  ·  de ${f.desde} a ${f.hasta}` +
      `  ·  ${f.seguimientos} de seguimiento`,
  );
}
console.log(`\n  (control: ${filas.reduce((n, f) => n + f.cuantas, 0)} = ${sinMedicion.length})`);

// ── (1) LA TANDA (a): CINCO EVALUACIONES QUE CUBRAN SUS CUATRO CONDICIONES ─────────────────────────
//
// Se eligen de las que ENTRAN al recalculo (con medicion, con edad legible, mayores de 18 y sin huella
// repetida), y de PACIENTES DISTINTOS, que es lo que el pidio. La huella repetida se recalcula aqui con
// la misma definicion del freno: las cuatro lecturas (Re, Ri, Rinf, C) con los nombres que la base
// guarda, no los campos del motor.
const VARIABLES_DE_LA_HUELLA = [
  "Extracellular resistance",
  "Intracellular resistance Ω",
  "Infinite resistance",
  "Membrane capacitance nF",
];
const valores = await todasLasFilas(db, "bis_raw_values", "measurement_id, variable_name, value");
const ausentes = VARIABLES_DE_LA_HUELLA.filter((n) => !valores.some((v) => v.variable_name === n));
if (ausentes.length) {
  console.error(`\nFaltan variables de la huella: ${ausentes.join(", ")}. Se detiene.`);
  process.exit(1);
}
const porMedicion = new Map();
for (const v of valores) {
  if (!porMedicion.has(v.measurement_id)) porMedicion.set(v.measurement_id, new Map());
  const n = Number(v.value);
  if (Number.isFinite(n)) porMedicion.get(v.measurement_id).set(v.variable_name, n);
}
const repetidas = new Set();
{
  const porHuella = new Map();
  for (const e of reales) {
    for (const m of e.bis_measurements ?? []) {
      const vals = porMedicion.get(m.id);
      if (!vals || VARIABLES_DE_LA_HUELLA.some((k) => !vals.has(k))) continue;
      const h = VARIABLES_DE_LA_HUELLA.map((k) => String(vals.get(k))).join("|");
      if (!porHuella.has(h)) porHuella.set(h, new Set());
      porHuella.get(h).add(e.id);
    }
  }
  for (const ids of porHuella.values()) if (ids.size > 1) for (const id of ids) repetidas.add(id);
}

// Y la completitud de la encuesta, que es una de sus cuatro condiciones. Se deriva como el motor: una
// evaluacion esta completa si no le falta ningun `field_key` declarado. Aqui basta la señal que ya
// guarda el diagnostico (`dfi.complete` del snapshot del reporte), que es lo que la pantalla muestra.
const reportes = await todasLasFilas(db, "reports", "evaluation_id, snapshot, created_at");
const completaPorEvaluacion = new Map();
for (const r of reportes) {
  const completa = r.snapshot?.dfi?.complete;
  if (typeof completa === "boolean") completaPorEvaluacion.set(r.evaluation_id, completa);
}

const candidatas = [];
for (const e of reales) {
  const medicion = (e.bis_measurements ?? [])[0];
  if (!medicion || repetidas.has(e.id)) continue;
  const edad = edadCumplida(e.patients?.patient_profiles?.birth_date, medicion.measurement_date ?? e.created_at);
  if (edad == null || edad < EDAD_MINIMA || edad > 100) continue;
  candidatas.push({
    id: e.id,
    paciente: e.patient_id,
    sexo: e.patients?.patient_profiles?.sex ?? "(sin sexo)",
    edad,
    tipo: e.type,
    quien: nombreDe.get(e.professional_id) ?? "(sin profesional)",
    fecha: String(medicion.measurement_date ?? e.created_at).slice(0, 10),
    encuestaCompleta: completaPorEvaluacion.get(e.id),
  });
}

console.log(`\n═══ (1) LA TANDA (a) ═══`);
console.log(`    candidatas (entran al recalculo): ${candidatas.length}\n`);

// LAS CUATRO CONDICIONES SE CUBREN UNA POR UNA Y SE DICE CUAL CUBRE CADA CUAL, para que la revision de
// Santiago sepa que esta mirando en cada caso. Y los pacientes son DISTINTOS: se descarta el que repita.
const elegidas = [];
const pacientesUsados = new Set();
const tomar = (condicion, filtro) => {
  const c = candidatas.find((x) => !pacientesUsados.has(x.paciente) && filtro(x));
  if (!c) {
    console.log(`  NO HAY candidata para: ${condicion}`);
    return;
  }
  pacientesUsados.add(c.paciente);
  elegidas.push({ ...c, condicion });
};

tomar("un HOMBRE", (x) => x.sexo === "M" || x.sexo === "Masculino");
tomar("una MUJER", (x) => x.sexo === "F" || x.sexo === "Femenino");
tomar("un MAYOR DE 60 (donde pesa el esperado curvo)", (x) => x.edad > 60);
// ═══ ESTA CONDICION NO SE PUEDE CUMPLIR, Y NO ES UN FALLO DE LA BUSQUEDA (verificado 2026-10-29) ═══
//
// Medido: los 434 reportes de la base tienen `dfi.complete = true`. NINGUNO incompleto, y ninguno sin el
// campo. Es la consecuencia del bloqueo de generacion (Gildardo, 2026-08-13 §1): un diagnostico nuevo no
// se sella con la encuesta a medias, se completa ANTES de generar.
//
// O SEA QUE EL CAMINO "la EB-BIS sale sola" EXISTE EN EL CODIGO Y NO TIENE NINGUN CASO REAL que revisar.
// Lo cubren los tests (`clinical-engine.test.ts`), y en pantalla solo se vera cuando llegue el primer
// paciente con la encuesta a medias. Se deja la condicion escrita para que, si algun dia aparece, la
// tanda la incluya sola.
tomar("una con ENCUESTA INCOMPLETA (la EB-BIS sale sola)", (x) => x.encuestaCompleta === false);
// La quinta no cubre una condicion suya: es un SEGUIMIENTO, para ver la banda de trayectoria, que es
// donde el mayor 2.0.0 se nota (dos versiones mayores no se comparan).
tomar("un SEGUIMIENTO (para ver la banda de trayectoria con el mayor nuevo)", (x) => x.tipo === "seguimiento");

for (const e of elegidas) {
  console.log(
    `  ${e.id}\n` +
      `      ${e.condicion}\n` +
      `      sexo ${e.sexo} · ${e.edad} años · ${e.tipo} · medida el ${e.fecha}` +
      ` · encuesta ${e.encuestaCompleta === false ? "INCOMPLETA" : e.encuestaCompleta === true ? "completa" : "(sin dato)"}\n` +
      `      profesional: ${e.quien} · paciente ${e.paciente.slice(0, 8)}`,
  );
}
console.log(`\n  elegidas: ${elegidas.length} de 5 · pacientes distintos: ${pacientesUsados.size}`);

console.log("\nListo. Nada se escribio.\n");
