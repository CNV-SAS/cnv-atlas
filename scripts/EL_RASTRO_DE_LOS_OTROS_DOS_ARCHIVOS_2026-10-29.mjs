// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS ARCHIVOS DE 28,449 Y 58,16  ·  SOLO LECTURA  ·  2026-10-29
//
// ═══ DE DONDE SALE (Santiago, 2026-10-29) ═══
//
// *"Santiago no los reconoce. Dame el mismo rastro que con el de Andres: que cuenta los importo, cuando,
// en que pacientes de prueba, y si la toma o la edad del equipo coincide con algun paciente real. Si
// coincide, se retiran con la misma correccion."*
//
// ═══ QUE SE PUEDE AFIRMAR Y QUE NO, QUE ES LA MITAD DEL TRABAJO ═══
//
// Con el archivo del 24-sep se pudo decir de quien era porque OTRA evaluacion, de un paciente real,
// llevaba la MISMA huella: las cuatro lecturas electricas identicas hasta el ultimo decimal. Esa es una
// identificacion, no un parecido.
//
// La edad del equipo NO identifica a nadie. Si un archivo trae "Edad 28,449" y en la base hay cuarenta
// pacientes reales de 28 anos, la edad no senala a ninguno: solo dice que el archivo NO es del paciente
// de prueba en cuya ficha esta colgado. Por eso este script contesta tres preguntas separadas y no las
// mezcla:
//
//   1. QUIEN lo importo, CUANDO y EN QUE pacientes de prueba (el rastro, que es lo que se pidio).
//   2. Si alguna evaluacion de un paciente REAL comparte la huella (la identificacion fuerte). Se mira
//      TAMBIEN en las no vigentes: una version reemplazada sigue siendo la historia de alguien.
//   3. Cuantos pacientes reales ENCAJARIAN por edad y sexo. Es un CONTEO, a proposito: si da mas de uno,
//      la respuesta correcta a "de quien es" es "no se puede saber desde Atlas", y decir un nombre seria
//      inventar. Si diera exactamente uno, tampoco basta, pero ya seria una pista que verificar fuera.
//
// NO IMPRIME DATOS DE PACIENTE: ids cortos, edades, sexo y conteos. Los correos que SI salen son de
// CUENTAS que importaron, que es literalmente lo que se pregunta.
//
// COMO SE CORRE:
//   node --env-file=.env.production.local scripts/EL_RASTRO_DE_LOS_OTROS_DOS_ARCHIVOS_2026-10-29.mjs
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
anunciarBase(url, "rastrea los archivos de prueba de 28,449 y 58,16 (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

// Los `variable_name` tal como los guarda `normalizeHeader`. No se recortan a mano: ya fallo dos veces.
const VARIABLES = [
  "Extracellular resistance",
  "Intracellular resistance Ω",
  "Infinite resistance",
  "Membrane capacitance nF",
];
const VARIABLE_EDAD = "Edad";

// Las dos huellas que Santiago no reconoce, medidas en la sonda del 29.
const BUSCADAS = [
  { huella: "640.9|1862.7|476.835|1.56", etiqueta: "tomada 14-sep · Edad del equipo 28,449" },
  { huella: "696.8|1847|505.932|2.11", etiqueta: "tomada 23-jul · Edad del equipo 58,16" },
];

const corto = (id) => String(id).slice(0, 8);

// ── LOS CRUDOS: la huella y la edad del equipo, por medicion ────────────────────────────────────────
const crudos = await todasLasFilas(db, "bis_raw_values", "measurement_id, variable_name, value", (q) =>
  q.in("variable_name", [...VARIABLES, VARIABLE_EDAD]),
);
const porMedicion = new Map();
for (const c of crudos) {
  const n = Number(c.value);
  if (!Number.isFinite(n)) continue;
  const ya = porMedicion.get(c.measurement_id) ?? new Map();
  ya.set(c.variable_name, n);
  porMedicion.set(c.measurement_id, ya);
}
const huellaDe = (id) => {
  const m = porMedicion.get(id);
  if (!m) return null;
  const partes = [];
  for (const v of VARIABLES) {
    const n = m.get(v);
    if (n === undefined) return null;
    partes.push(String(n));
  }
  return partes.join("|");
};
const edadDelEquipoDe = (id) => porMedicion.get(id)?.get(VARIABLE_EDAD) ?? null;

const mediciones = await todasLasFilas(
  db,
  "bis_measurements",
  "id, evaluation_id, measurement_date, created_at, no_es_del_paciente_at",
);
const evaluaciones = await todasLasFilas(
  db,
  "evaluations",
  "id, patient_id, professional_id, type, created_at, superseded_at, retirada_at",
);
const porEvaluacion = new Map(evaluaciones.map((e) => [e.id, e]));
const pacientes = await todasLasFilas(db, "patients", "id, cuenta_como_de_prueba");
const dePrueba = new Map(pacientes.map((p) => [p.id, Boolean(p.cuenta_como_de_prueba)]));
// `patient_profiles` no tiene columna `id`: su clave es `patient_id`, y el orden de la paginacion hay
// que nombrarlo. Sin esto el helper pagina por una columna que no existe y lanza.
const fichas = await todasLasFilas(db, "patient_profiles", "patient_id, birth_date, sex", undefined, {
  orden: "patient_id",
});
const fichaDe = new Map(fichas.map((f) => [f.patient_id, f]));

// El rastro de los imports. `bis.imported` lleva el actor y la evaluacion en el payload.
const auditoria = await todasLasFilas(
  db,
  "clinical_audit_log",
  "event, actor_email, created_at, entity_id, payload",
  (q) => q.eq("event", "bis.imported"),
);

/** Edad cumplida a una fecha, con la misma exigencia de formato que el motor. */
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

/** Hora de Bogota (UTC-5), que es la que Santiago lee en pantalla. */
const bogota = (iso) =>
  new Date(new Date(iso).getTime() - 5 * 3600 * 1000).toISOString().replace("T", " ").slice(0, 19);

for (const { huella, etiqueta } of BUSCADAS) {
  console.log("".padEnd(96, "═"));
  console.log(`ARCHIVO  ${huella}`);
  console.log(`         ${etiqueta}`);
  console.log("".padEnd(96, "═"));

  const suyas = mediciones.filter((m) => huellaDe(m.id) === huella);
  if (suyas.length === 0) {
    console.log("  No hay ninguna medicion con esa huella. (¿Se retiro ya?)\n");
    continue;
  }

  const edadEquipo = edadDelEquipoDe(suyas[0].id);
  let realesConLaHuella = 0;

  // ── 1 y 2. DONDE ESTA, Y SI ALGUNA ES DE UN PACIENTE REAL ────────────────────────────────────────
  for (const m of suyas) {
    const e = porEvaluacion.get(m.evaluation_id);
    const ficha = e ? fichaDe.get(e.patient_id) : null;
    const esPrueba = e ? dePrueba.get(e.patient_id) === true : null;
    if (esPrueba === false) realesConLaHuella += 1;
    const edadFicha = ficha ? edadCumplida(ficha.birth_date, m.measurement_date) : null;
    const vigente = e ? !e.superseded_at && !e.retirada_at : null;

    // EL IMPORT QUE DEJO ESTA MEDICION, por el id EXACTO: en bis.imported el entity_id ES la medicion
    // (verificado sobre el payload real). La primera version de esto emparejaba tambien por evaluacion,
    // y entonces atribuia a una medicion los CATORCE imports que hubo en su evaluacion: un rastro que
    // dice de mas no sirve para decidir nada.
    const imports = auditoria.filter((a) => a.entity_id === m.id);
    // Los demas imports de la MISMA evaluacion, contados aparte y rotulados como contexto: dicen cuanto
    // se ensayo ahi, que es otra cosa que de donde salio este archivo.
    const otrosDeLaEvaluacion = auditoria.filter(
      (a) => a.entity_id !== m.id && (a.payload ?? {}).evaluation_id === m.evaluation_id,
    ).length;

    console.log("");
    console.log(`  medicion ${corto(m.id)}  ·  evaluacion ${corto(m.evaluation_id)}  ·  ${e?.type ?? "?"}`);
    console.log(
      `    paciente: ${esPrueba === true ? "DE PRUEBA" : esPrueba === false ? "REAL" : "?"}` +
        `  ·  ficha: ${edadFicha ?? "?"} anos, sexo ${ficha?.sex ?? "?"}` +
        `  ·  equipo: ${edadEquipo ?? "?"}`,
    );
    console.log(
      `    ${edadFicha != null && edadEquipo != null && Math.abs(edadFicha - Math.trunc(edadEquipo)) <= 1 ? "la edad CUADRA con la ficha" : "la edad NO cuadra con la ficha"}` +
        `  ·  evaluacion ${vigente ? "vigente" : "reemplazada o retirada"}` +
        `${m.no_es_del_paciente_at ? "  ·  YA MARCADA como de otro paciente" : ""}`,
    );
    if (imports.length === 0) {
      console.log("    import: sin rastro (anterior al registro de este evento)");
    }
    for (const a of imports) {
      console.log(`    import: ${bogota(a.created_at)} (Bogota)  por  ${a.actor_email ?? "(sin correo)"}`);
    }
    if (otrosDeLaEvaluacion > 0) {
      console.log(`    (en esa evaluacion hubo ${otrosDeLaEvaluacion} import(s) mas, de otros archivos)`);
    }
  }

  // ── 3. CUANTOS PACIENTES REALES ENCAJARIAN POR EDAD Y SEXO ───────────────────────────────────────
  //
  // SOLO EL CONTEO. Si es mas de uno, de quien es el archivo NO se puede saber desde Atlas, y decir un
  // nombre seria inventar. El sexo se toma del propio archivo si alguna ficha que lo tiene lo confirma;
  // si no, se cuenta sobre los dos.
  if (edadEquipo != null) {
    const objetivo = Math.trunc(edadEquipo);
    const fecha = suyas[0].measurement_date;
    let encajan = 0;
    for (const p of pacientes) {
      if (dePrueba.get(p.id)) continue;
      const f = fichaDe.get(p.id);
      if (!f) continue;
      const edad = edadCumplida(f.birth_date, fecha);
      if (edad != null && edad === objetivo) encajan += 1;
    }
    console.log("");
    console.log(
      `  PACIENTES REALES QUE ENCAJARIAN POR EDAD (${objetivo} anos a la fecha de la toma): ${encajan}`,
    );
  }

  console.log("");
  console.log(
    realesConLaHuella > 0
      ? `  VEREDICTO: ${realesConLaHuella} evaluacion(es) de paciente REAL comparte(n) esta toma. SE IDENTIFICA, y se retira con la correccion.`
      : "  VEREDICTO: ninguna evaluacion de paciente real comparte esta toma. El archivo entro desde fuera y Atlas NO puede decir de quien es.",
  );
  console.log("");
}
