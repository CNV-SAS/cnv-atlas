// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA PESTAÑA DE ANTROP. & BIS QUE NO SE MUESTRA  ·  SOLO LECTURA  ·  2026-11-06
//
// EL CASO: Maria Teresa ve "Esta pestaña no se pudo mostrar" con el codigo 404641578 en la consulta
// 4d2a74e0, hacia las 13:30 de Colombia. Como admin se ve todo normal.
//
// QUE MIRA: el estado de esa consulta y de su paciente, y lo compara con OTRAS consultas suyas que si se
// ven. Lo que se busca es la diferencia, no una confirmacion.
//
// NO IMPRIME NI UN NOMBRE NI UN DOCUMENTO DE PACIENTE. De los profesionales si, que es lo que hace falta
// para saber de quien es la consulta.
//
// COMO SE CORRE:
//   node --env-file=.env.production.local scripts/LA_PESTANA_QUE_NO_SE_MUESTRA_2026-11-06.mjs
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
anunciarBase(url, "la pestaña que no se muestra (SOLO LECTURA)");

const db = createClient(url, key, { auth: { persistSession: false } });

const LA_QUE_FALLA = "4d2a74e0-53bf-4fea-929a-05665e05743b";
const LA_DE_LA_CADERA = "af66f3c8-0dff-4882-a281-0abadcbcf0b4";

async function una(tabla, columnas, filtro) {
  const { data, error } = await filtro(db.from(tabla).select(columnas)).maybeSingle();
  if (error) throw new Error(`${tabla}: ${error.message}`);
  return data;
}

for (const [rotulo, id] of [
  ["LA QUE FALLA (Antrop. & BIS)", LA_QUE_FALLA],
  ["LA DE LA CADERA", LA_DE_LA_CADERA],
]) {
  console.log(`\n══════ ${rotulo} · ${id.slice(0, 8)} ══════`);
  const ev = await una(
    "evaluations",
    "id, patient_id, professional_id, type, status, created_at, closed_at, retirada_at, weight_goal_kg",
    (q) => q.eq("id", id),
  );
  if (!ev) {
    console.log("  no existe (o la RLS del service role no la alcanza, que no deberia pasar)");
    continue;
  }
  console.log(`  tipo: ${ev.type} · estado: ${ev.status} · creada: ${ev.created_at}`);
  console.log(`  retirada: ${ev.retirada_at ?? "no"} · cerrada: ${ev.closed_at ?? "no"}`);
  console.log(`  version de encuesta sellada: ${"(no aplica)"}`);

  // DE QUIEN ES, y si ese profesional sigue activo y relacionado con el paciente: es lo que decide la RLS.
  const prof = await una("professional_profiles", "id, profile_id, profession, is_test", (q) =>
    q.eq("id", ev.professional_id),
  );
  const perfil = prof ? await una("profiles", "id, full_name, status, inactivo_desde", (q) => q.eq("id", prof.profile_id)) : null;
  console.log(`  profesional de la consulta: ${perfil?.full_name ?? "(sin perfil)"} · estado: ${perfil?.status}`);

  const { data: rels, error: eRel } = await db
    .from("patient_professional_relationships")
    .select("professional_id, status")
    .eq("patient_id", ev.patient_id);
  if (eRel) throw new Error(`relaciones: ${eRel.message}`);
  console.log(`  relaciones del paciente: ${rels.length}`);
  for (const r of rels) {
    const p = await una("professional_profiles", "profile_id", (q) => q.eq("id", r.professional_id));
    const n = p ? await una("profiles", "full_name, status", (q) => q.eq("id", p.profile_id)) : null;
    const esLaDeLaConsulta = r.professional_id === ev.professional_id ? "  <- es el de la consulta" : "";
    console.log(`    ${n?.full_name ?? "(sin perfil)"} · ${r.status} · estado: ${n?.status}${esLaDeLaConsulta}`);
  }

  // EL PACIENTE, sin nombrarlo: solo lo que el motor y las pantallas necesitan.
  const pac = await una("patients", "id, is_test, cuenta_como_de_prueba, deleted_at", (q) =>
    q.eq("id", ev.patient_id),
  );
  console.log(`  paciente: retirado: ${pac?.deleted_at ?? "no"}`);
  const pp = await una("patient_profiles", "patient_id, sex, birth_date", (q) => q.eq("patient_id", ev.patient_id));
  console.log(`  perfil del paciente: ${pp ? `sexo ${pp.sex ?? "FALTA"} · nacimiento ${pp.birth_date ?? "FALTA"}` : "NO HAY FILA"}`);

  // LO QUE LEE LA PESTAÑA DE ANTROP. & BIS.
  for (const [tabla, col] of [
    ["bis_measurements", "id, measurement_date, no_es_del_paciente_at"],
    ["evaluation_bis_intake", "evaluation_id, created_at"],
    ["survey_responses", "id, created_at"],
    ["diagnoses", "id, created_at"],
    ["patient_consents", "id, consent_type, revoked_at"],
  ]) {
    const { data, error } = await db.from(tabla).select(col).eq(tabla === "patient_consents" ? "patient_id" : "evaluation_id", tabla === "patient_consents" ? ev.patient_id : id);
    if (error) {
      console.log(`  ${tabla}: ERROR ${error.message}`);
      continue;
    }
    console.log(`  ${tabla}: ${data.length} fila(s)${data.length && tabla !== "patient_consents" ? ` · ${JSON.stringify(data[0])}` : ""}`);
  }
}

console.log("\nFin. Nada se escribió.");

// ── LA DIFERENCIA, QUE ES LO QUE SE BUSCA ────────────────────────────────────────────────────────
// Las dos consultas salieron iguales en forma y una se ve y la otra no. Asi que se comparan los CONTENIDOS
// de lo que lee esa pestaña, campo por campo.
console.log("\n\n══════ EL CONTENIDO DEL INTAKE, LADO A LADO ══════");
for (const [rotulo, id] of [
  ["falla   ", LA_QUE_FALLA],
  ["funciona", LA_DE_LA_CADERA],
]) {
  const { data, error } = await db.from("evaluation_bis_intake").select("*").eq("evaluation_id", id);
  if (error) {
    console.log(`  ${rotulo}: ERROR ${error.message}`);
    continue;
  }
  for (const fila of data) {
    console.log(`\n  ── ${rotulo} ──`);
    for (const [k, v] of Object.entries(fila)) {
      // El valor entero: aqui no hay nada identificable, son medidas y banderas.
      console.log(`    ${k}: ${JSON.stringify(v)}`);
    }
  }
}

console.log("\n\n══════ LAS CONDICIONES BIS ══════");
for (const [rotulo, id] of [
  ["falla   ", LA_QUE_FALLA],
  ["funciona", LA_DE_LA_CADERA],
]) {
  const { data, error } = await db.from("bis_conditions").select("*").eq("evaluation_id", id);
  if (error) {
    console.log(`  ${rotulo}: ERROR ${error.message}`);
    continue;
  }
  console.log(`  ${rotulo}: ${data.length} fila(s)`);
  for (const fila of data) console.log(`    ${JSON.stringify(fila)}`);
}
