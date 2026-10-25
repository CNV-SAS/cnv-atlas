// ══════════════════════════════════════════════════════════════════════════════════════════════════
// ¿QUEDO BIEN LA REASIGNACION DE LOS 25?  ·  SOLO LECTURA  ·  2026-10-25
//
// ═══ QUE SE VERIFICA, Y POR QUE ESTAS CUATRO COSAS ═══
//
// Santiago movio en un clic los pacientes que Maria Camila atendio con el enlace de Gildardo el 13-oct.
// Gildardo pidio verificar cuatro hechos, y los cuatro son "lo que la pantalla DIJO" contra "lo que la base
// TIENE", que son dos cosas distintas: la pantalla puede decir 25 y haber movido 24.
//
//   1. LOS 25 QUEDARON BAJO MARIA CAMILA  ->  una relacion `active` con ella por cada paciente.
//   2. GILDARDO SE QUEDO SIN ACCESO       ->  CERO relaciones `active` suyas con esos pacientes. Es el
//      hecho estructural del que depende la RLS: desde la 0223 `is_patient_of` exige `status = 'active'`,
//      asi que la relacion historica (`reasignada`) no abre la historia clinica.
//   3. LA FIRMA NO SE MOVIO               ->  `diagnoses.confirmed_by` del diagnostico de esa paciente
//      sigue siendo Gildardo. Es la decision de Santiago: `professional_id` dice quien ATIENDE y
//      `confirmed_by` quien FIRMO, y reasignar no reescribe una firma clinica.
//   4. HAY RASTRO POR PACIENTE            ->  una fila de `clinical_audit_log` por cada uno, no una sola
//      del lote. Un asiento por lote no contesta "quien pudo ver ESTA historia y hasta cuando".
//
// ═══ NO IMPRIME DATOS DE PACIENTE ═══
//
// Conteos, y los ultimos cuatro digitos del documento SOLO de la cedula que Gildardo nombro el mismo en su
// mensaje. Ningun nombre, ninguna fecha de nacimiento, ningun documento completo.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/QUEDO_BIEN_LA_REASIGNACION_2026-10-25.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "verifica la reasignacion del 2026-10-25 (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

/** Falla fuerte: una verificacion que sigue despues de un error de lectura afirma sobre datos que no leyo. */
function ok(etiqueta, { data, error }) {
  if (error) {
    console.error(`\n  FALLO leyendo ${etiqueta}: ${error.message}`);
    process.exit(1);
  }
  return data;
}

// ── 1 · EL RASTRO ES EL PUNTO DE PARTIDA ────────────────────────────────────────────────────────────
//
// Y no la lista de pacientes de Maria Camila: si se arranca de ahi se verifica el estado de hoy sin saber
// cuales movio ESTE acto, y un paciente que ya era suyo contaria como movido.
const asientos = ok(
  "clinical_audit_log",
  await db
    .from("clinical_audit_log")
    .select("id, entity_id, actor_email, payload, created_at")
    .eq("event", "patient.reasignado")
    .gte("created_at", "2026-10-24T00:00:00Z")
    .order("created_at", { ascending: true }),
);

const porPaciente = new Map();
for (const a of asientos) {
  const ya = porPaciente.get(a.entity_id) ?? [];
  ya.push(a);
  porPaciente.set(a.entity_id, ya);
}

console.log("1 · EL RASTRO");
console.log(`  asientos patient.reasignado desde el 24-oct: ${asientos.length}`);
console.log(`  pacientes distintos en esos asientos:        ${porPaciente.size}`);
const repetidos = [...porPaciente.values()].filter((v) => v.length > 1).length;
console.log(`  pacientes con mas de un asiento:             ${repetidos}`);
const destinos = new Set(asientos.map((a) => a.payload?.haciaProfesionalId));
console.log(`  profesionales de destino distintos:          ${destinos.size}`);
const motivos = new Set(asientos.map((a) => a.payload?.motivo));
console.log(`  motivos distintos:                           ${motivos.size}`);
for (const m of motivos) console.log(`    "${String(m).slice(0, 110)}"`);
const movidas = asientos.reduce((n, a) => n + (a.payload?.evaluacionesMovidas?.length ?? 0), 0);
const firmados = asientos.reduce((n, a) => n + (a.payload?.conDiagnosticoFirmado ?? 0), 0);
console.log(`  evaluaciones que cambiaron de atribucion:    ${movidas}`);
console.log(`  de esas, con diagnostico YA firmado:         ${firmados}  (la firma no se movio)`);
const actores = new Set(asientos.map((a) => a.actor_email));
console.log(`  quien lo hizo: ${[...actores].join(", ")}`);

const pacienteIds = [...porPaciente.keys()];
if (pacienteIds.length === 0) {
  console.log("\n  NO HAY ASIENTOS. O la reasignacion no corrio, o corrio contra otra base.");
  process.exit(1);
}

// ── 2 · DONDE QUEDARON ──────────────────────────────────────────────────────────────────────────────
const relaciones = ok(
  "patient_professional_relationships",
  await db
    .from("patient_professional_relationships")
    .select("patient_id, professional_id, status, assigned_at")
    .in("patient_id", pacienteIds),
);

const perfiles = ok(
  "professional_profiles",
  await db.from("professional_profiles").select("id, profile_id, profiles!profile_id(full_name)"),
);
const nombreDelProfesional = new Map(
  perfiles.map((p) => [p.id, p.profiles?.full_name ?? "(sin nombre)"]),
);

console.log("\n2 · DONDE QUEDARON LOS PACIENTES DEL LOTE");
const activasPorPaciente = new Map();
for (const r of relaciones.filter((r) => r.status === "active")) {
  const ya = activasPorPaciente.get(r.patient_id) ?? [];
  ya.push(r);
  activasPorPaciente.set(r.patient_id, ya);
}
const sinActiva = pacienteIds.filter((id) => !activasPorPaciente.has(id)).length;
const conVarias = [...activasPorPaciente.values()].filter((v) => v.length > 1).length;
console.log(`  sin ninguna relacion activa:                 ${sinActiva}`);
console.log(`  con MAS DE UNA relacion activa:              ${conVarias}`);

const porDestino = new Map();
for (const [, rs] of activasPorPaciente) {
  for (const r of rs) {
    porDestino.set(r.professional_id, (porDestino.get(r.professional_id) ?? 0) + 1);
  }
}
console.log("  profesional activo hoy, por paciente del lote:");
for (const [id, n] of [...porDestino].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${n} con ${nombreDelProfesional.get(id) ?? id}`);
}

// Quien ERA el dueño, segun el rastro: de ahi sale a quien hay que mirarle el acceso, sin teclear un nombre.
const origenes = new Set(asientos.flatMap((a) => a.payload?.desdeProfesionalIds ?? []));
console.log("\n  EL ACCESO DEL PROFESIONAL DE ORIGEN (el que tenia que perderlo):");
for (const origen of origenes) {
  const suyas = relaciones.filter((r) => r.professional_id === origen);
  const activas = suyas.filter((r) => r.status === "active").length;
  const historicas = suyas.filter((r) => r.status !== "active").length;
  console.log(
    `    ${nombreDelProfesional.get(origen) ?? origen}: ${activas} activas, ${historicas} historicas`,
  );
  console.log(
    activas === 0
      ? "      SIN ACCESO a los del lote (is_patient_of exige status = 'active' desde la 0223)"
      : "      TODAVIA TIENE ACCESO a alguno: revisar",
  );
}

// Las evaluaciones: la atribucion tambien se mueve, y es lo que decide su lista de trabajo.
const evaluaciones = ok(
  "evaluations",
  await db
    .from("evaluations")
    .select("id, patient_id, professional_id, status, superseded_at, retirada_at, created_at")
    .in("patient_id", pacienteIds),
);
const vigentes = evaluaciones.filter((e) => !e.superseded_at && !e.retirada_at);
const porProfesionalEval = new Map();
for (const e of vigentes) {
  porProfesionalEval.set(e.professional_id, (porProfesionalEval.get(e.professional_id) ?? 0) + 1);
}
console.log("\n  LA ATRIBUCION DE LAS CONSULTAS VIGENTES de esos pacientes:");
for (const [id, n] of [...porProfesionalEval].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${n} a nombre de ${nombreDelProfesional.get(id) ?? id}`);
}
console.log(`    (y ${evaluaciones.length - vigentes.length} reemplazadas o retiradas, que no se mueven)`);

// ── 3 · LA FIRMA DE LA CEDULA QUE GILDARDO NOMBRO ───────────────────────────────────────────────────
const CEDULA = "43828247";
const [paciente] = ok(
  "patients",
  await db.from("patients").select("id, document_number").eq("document_number", CEDULA).limit(1),
);
console.log(`\n3 · LA FIRMA DEL DIAGNOSTICO DE LA CC ...${CEDULA.slice(-4)}`);
if (!paciente) {
  console.log("  no aparece ese documento en produccion");
} else {
  const delPaciente = evaluaciones.filter((e) => e.patient_id === paciente.id);
  const enElLote = porPaciente.has(paciente.id);
  console.log(`  esta en el lote reasignado: ${enElLote ? "si" : "NO"}`);
  const evalIds = (
    delPaciente.length > 0
      ? delPaciente
      : ok(
          "evaluations",
          await db.from("evaluations").select("id, professional_id").eq("patient_id", paciente.id),
        )
  ).map((e) => e.id);
  const dx = ok(
    "diagnoses",
    await db
      .from("diagnoses")
      .select("id, evaluation_id, confirmed_by, confirmed_profession, confirmed_at")
      .in("evaluation_id", evalIds),
  );
  const nombrePorUsuario = new Map(
    perfiles.map((p) => [p.profile_id, p.profiles?.full_name ?? "(sin nombre)"]),
  );
  for (const d of dx) {
    const quien = d.confirmed_by ? (nombrePorUsuario.get(d.confirmed_by) ?? d.confirmed_by) : "(sin firmar)";
    const atiende = delPaciente.find((e) => e.id === d.evaluation_id)?.professional_id;
    console.log(`  diagnostico ${d.id.slice(0, 8)}: firmado por ${quien} (${d.confirmed_profession ?? "-"})`);
    console.log(`    y la consulta la ATIENDE hoy ${nombreDelProfesional.get(atiende) ?? atiende}`);
  }
  if (dx.length === 0) console.log("  esa paciente no tiene diagnostico firmado");
}

// ── 4 · LAS DOS FECHAS QUE SE VEN DISTINTAS ─────────────────────────────────────────────────────────
//
// La vista de reasignacion muestra `assigned_at` (cuando paso a ESE profesional) y la ficha muestra la
// fecha de la CONSULTA. Las dos son correctas y contestan preguntas distintas; lo que faltaba era que el
// rotulo dijera cual es cual.
console.log("\n4 · LAS DOS FECHAS DEL LOTE (en hora de Colombia)");
const dia = (iso) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso)) : "-";
const porDiaAsignacion = new Map();
for (const [, rs] of activasPorPaciente) {
  for (const r of rs) {
    const d = dia(r.assigned_at);
    porDiaAsignacion.set(d, (porDiaAsignacion.get(d) ?? 0) + 1);
  }
}
console.log("  assigned_at de la relacion ACTIVA (lo que muestra la reasignacion):");
for (const [d, n] of [...porDiaAsignacion].sort()) console.log(`    ${d}: ${n}`);

// La fecha de la consulta sale de `bis_measurements.measurement_date` (el dia en que el equipo midio), no
// de una columna de `evaluations`: esa no existe, y es la misma fuente que usa la vista del roster.
const mediciones = ok(
  "bis_measurements",
  await db
    .from("bis_measurements")
    .select("evaluation_id, measurement_date, created_at")
    .in("evaluation_id", vigentes.map((e) => e.id)),
);
const porDiaConsulta = new Map();
for (const m of mediciones) {
  const d = m.measurement_date ?? dia(m.created_at);
  porDiaConsulta.set(d, (porDiaConsulta.get(d) ?? 0) + 1);
}
console.log("  fecha de la CONSULTA (lo que muestra la ficha, si hay medicion):");
for (const [d, n] of [...porDiaConsulta].sort()) console.log(`    ${dia(d)}: ${n}`);
console.log(`    (y ${vigentes.length - mediciones.length} consultas del lote todavia SIN medicion)`);

// Y para las que no tienen medicion, la ficha cae en `created_at` de la consulta: es la fecha que Gildardo
// vio como "el 13", asi que hay que confirmar que es esa y no otra.
const porDiaCreacion = new Map();
for (const e of vigentes) {
  const d = dia(e.created_at);
  porDiaCreacion.set(d, (porDiaCreacion.get(d) ?? 0) + 1);
}
console.log("  cuando se CREO la consulta (el respaldo de la ficha sin medicion):");
for (const [d, n] of [...porDiaCreacion].sort()) console.log(`    ${d}: ${n}`);

console.log("\nListo. Nada se escribio.\n");
