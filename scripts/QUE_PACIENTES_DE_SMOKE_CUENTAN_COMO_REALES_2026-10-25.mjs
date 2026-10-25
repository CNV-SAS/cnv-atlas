// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE PACIENTES DE SMOKE ESTAN CONTANDO COMO REALES  ·  SOLO LECTURA  ·  2026-10-25
//
// ═══ DE DONDE SALE ═══
//
// Gildardo (2026-10-25): tres pacientes de smoke no estan marcados de prueba, "hoy estan en la cohorte de
// investigacion, y uno de los 4 pares que reporte son ellos". Y la pregunta que importa mas que los tres:
// *"mira por que Santiago Arroyave no hereda la marca de Profesional Demo"* y *"dime si hay otros pacientes
// de smoke en la misma situacion"*.
//
// ═══ LA REGLA QUE SE ESTA MIDIENDO (0202) ═══
//
// `patients.cuenta_como_de_prueba` es DERIVADA por trigger. Cuenta como de prueba si esta marcado a mano
// (`is_test`) O si TODOS sus profesionales activos son de prueba y nadie dijo lo contrario
// (`es_real_confirmado`). Hay tres formas de que un paciente de smoke NO cuente como de prueba, y son
// distintas:
//
//   A · su profesional NO esta marcado `is_test`  -> la derivacion no tiene de donde deducirlo
//   B · alguien lo marco `es_real_confirmado`      -> la salida explicita, puesta a mano
//   C · tiene ADEMAS un profesional real activo    -> y entonces es real a proposito (regla de la 0202)
//
// Distinguirlas decide el arreglo: en A se marca la CUENTA, en B hay que quitar esa marca, y en C no hay
// nada que arreglar. Contestar "no esta marcado" sin decir cual de las tres es lo que hace que el arreglo
// se aplique en el sitio equivocado.
//
// ═══ IMPRIME NOMBRES ═══
//
// A proposito, y acotado: SOLO de los pacientes cuyo profesional es una cuenta de prueba, mas los que
// coinciden con el patron de smoke. Es una lista de datos de PRUEBA, y sin el nombre no se puede decidir
// cual es cual. No imprime documentos completos ni fechas de nacimiento.
//
// COMO SE CORRE (lee la nube, no escribe nada):
//   node --env-file=.env.production.local scripts/QUE_PACIENTES_DE_SMOKE_CUENTAN_COMO_REALES_2026-10-25.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "busca pacientes de smoke que cuentan como reales (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

function ok(etiqueta, { data, error }) {
  if (error) {
    console.error(`\n  FALLO leyendo ${etiqueta}: ${error.message}`);
    process.exit(1);
  }
  return data;
}

// ── LOS PROFESIONALES, CON SU MARCA ─────────────────────────────────────────────────────────────────
const perfiles = ok(
  "professional_profiles",
  await db.from("professional_profiles").select("id, profile_id, is_test, profiles!profile_id(full_name)"),
);
const nombreDe = new Map(perfiles.map((p) => [p.id, p.profiles?.full_name ?? "(sin nombre)"]));
const esDePrueba = new Map(perfiles.map((p) => [p.id, Boolean(p.is_test)]));

console.log("1 · LAS CUENTAS Y SU MARCA");
for (const p of [...perfiles].sort((a, b) => Number(b.is_test) - Number(a.is_test))) {
  const n = nombreDe.get(p.id);
  const pinta = /prueba|demo|test/i.test(n);
  if (p.is_test || pinta) {
    console.log(`  ${p.is_test ? "DE PRUEBA" : "sin marcar"}  ${n}`);
  }
}
console.log(`  (y ${perfiles.filter((p) => !p.is_test && !/prueba|demo|test/i.test(nombreDe.get(p.id))).length} cuentas reales mas)`);

// ── LAS RELACIONES ──────────────────────────────────────────────────────────────────────────────────
const relaciones = ok(
  "patient_professional_relationships",
  await db
    .from("patient_professional_relationships")
    .select("patient_id, professional_id, status")
    .eq("status", "active"),
);
const activosDe = new Map();
for (const r of relaciones) {
  const ya = activosDe.get(r.patient_id) ?? [];
  ya.push(r.professional_id);
  activosDe.set(r.patient_id, ya);
}

const pacientes = ok(
  "patients",
  await db
    .from("patients")
    .select("id, is_test, es_real_confirmado, cuenta_como_de_prueba, test_proposed_reason, deleted_at")
    .is("deleted_at", null),
);
const fichas = ok(
  "patient_profiles",
  await db.from("patient_profiles").select("patient_id, first_name, last_name"),
);
const nombrePaciente = new Map(
  fichas.map((f) => [f.patient_id, `${f.first_name ?? ""} ${f.last_name ?? ""}`.trim() || "(sin nombre)"]),
);

/** Por que NO cuenta como de prueba, en una de las tres causas de la 0202. */
function porQueNoCuenta(p) {
  if (p.cuenta_como_de_prueba) return null;
  const activos = activosDe.get(p.id) ?? [];
  if (activos.length === 0) return "C-sin-profesional: sin relacion activa, no hay de quien deducirlo";
  const reales = activos.filter((id) => !esDePrueba.get(id));
  if (p.es_real_confirmado) {
    return "B-es_real_confirmado: alguien dijo a mano que SI es real";
  }
  if (reales.length > 0) {
    return `C-tiene-profesional-real: ${reales.map((id) => nombreDe.get(id)).join(", ")}`;
  }
  return "A-su-cuenta-no-esta-marcada: la derivacion no tiene de donde deducirlo";
}

// ── 2 · LOS PACIENTES DE CUENTAS QUE *PARECEN* DE SMOKE ─────────────────────────────────────────────
//
// Se mira por la CUENTA y no por el nombre del paciente: un paciente de smoke puede llamarse como sea, y
// lo que lo delata es de quien es.
const cuentasSospechosas = perfiles.filter((p) => p.is_test || /prueba|demo|test/i.test(nombreDe.get(p.id)));

console.log("\n2 · PACIENTES DE ESAS CUENTAS QUE **NO** CUENTAN COMO DE PRUEBA");
let cuantos = 0;
for (const cuenta of cuentasSospechosas) {
  const suyos = [...activosDe.entries()]
    .filter(([, ids]) => ids.includes(cuenta.id))
    .map(([pid]) => pacientes.find((p) => p.id === pid))
    .filter(Boolean);
  const sueltos = suyos.filter((p) => !p.cuenta_como_de_prueba);
  if (suyos.length === 0) continue;
  console.log(
    `\n  ${nombreDe.get(cuenta.id)} ${cuenta.is_test ? "(marcada de prueba)" : "(SIN MARCAR)"}: ` +
      `${suyos.length} paciente(s), ${sueltos.length} contando como reales`,
  );
  for (const p of sueltos) {
    cuantos++;
    console.log(`    - ${nombrePaciente.get(p.id)}  ->  ${porQueNoCuenta(p)}`);
  }
}
console.log(`\n  TOTAL contando como reales en cuentas de smoke: ${cuantos}`);

// ── 3 · Y AL REVES: EL PATRON EN EL NOMBRE, EN TODA LA BASE ─────────────────────────────────────────
//
// La red de seguridad para los que NO estan en una cuenta de smoke: un paciente que se llama "prueba" y
// pertenece a una cuenta real tambien contamina la cohorte, y la pregunta de Gildardo era si hay OTROS.
const PATRON = /\b(prueba|pruebas|test|demo|dummy|qa)\b/i;
console.log("\n3 · PACIENTES CON NOMBRE DE PRUEBA QUE CUENTAN COMO REALES (en cualquier cuenta)");
const porNombre = pacientes.filter(
  (p) => !p.cuenta_como_de_prueba && PATRON.test(nombrePaciente.get(p.id) ?? ""),
);
for (const p of porNombre) {
  const activos = (activosDe.get(p.id) ?? []).map((id) => nombreDe.get(id)).join(", ") || "(ninguno)";
  console.log(`  - ${nombrePaciente.get(p.id)}  ·  de: ${activos}  ->  ${porQueNoCuenta(p)}`);
}
console.log(`  TOTAL por nombre: ${porNombre.length}`);

// ── 4 · LA COHORTE, PARA SABER CUANTO MUEVE ─────────────────────────────────────────────────────────
const total = pacientes.length;
const dePrueba = pacientes.filter((p) => p.cuenta_como_de_prueba).length;
console.log("\n4 · LA COHORTE HOY");
console.log(`  pacientes vivos: ${total}`);
console.log(`  contando como de prueba: ${dePrueba}`);
console.log(`  contando como reales: ${total - dePrueba}`);
console.log(`  marcados a mano (is_test): ${pacientes.filter((p) => p.is_test).length}`);
console.log(`  con es_real_confirmado: ${pacientes.filter((p) => p.es_real_confirmado).length}`);

console.log("\nListo. Nada se escribio.\n");
