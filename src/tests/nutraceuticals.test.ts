import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Integracion contra el stack local. Stock se ajusta con cliente admin (RLS:
// admin/soporte); el registro de uso se hace con cliente PROFESIONAL contra un
// tratamiento de fixture (RLS: solo el profesional del paciente). La cadena
// clinica (paciente -> evaluacion -> diagnostico -> tratamiento) se arma via sql
// (superusuario), porque su UI aun no existe (B9/B12).

if (!process.env.DATABASE_URL) process.loadEnvFile?.(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ORG = "11111111-1111-1111-1111-111111111111";
const PROF_PROFILE_ID = "33333333-3333-3333-3333-333333333333";
const MODEL_VERSION_ID = "44444444-4444-4444-4444-444444444444";
const NUTRA_NAME = "TEST-NUTRA-B5";
const PATIENT_DOC = "TEST-B5-DOC-0001";

const adminClient = createClient(URL, ANON, { auth: { persistSession: false } });
const proClient = createClient(URL, ANON, { auth: { persistSession: false } });
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

let nutraId: string;
let treatmentId: string;

async function cleanup() {
  await sql`delete from public.nutraceutical_usage u using public.nutraceuticals n
            where u.nutraceutical_id = n.id and n.name = ${NUTRA_NAME}`;
  await sql`delete from public.treatments t using public.diagnoses d, public.evaluations e, public.patients p
            where t.diagnosis_id = d.id and d.evaluation_id = e.id and e.patient_id = p.id
              and p.document_number = ${PATIENT_DOC} and p.organization_id = ${ORG}`;
  await sql`delete from public.diagnoses d using public.evaluations e, public.patients p
            where d.evaluation_id = e.id and e.patient_id = p.id
              and p.document_number = ${PATIENT_DOC} and p.organization_id = ${ORG}`;
  await sql`delete from public.evaluations e using public.patients p
            where e.patient_id = p.id and p.document_number = ${PATIENT_DOC} and p.organization_id = ${ORG}`;
  await sql`delete from public.patients where document_number = ${PATIENT_DOC} and organization_id = ${ORG}`;
  await sql`delete from public.nutraceuticals where name = ${NUTRA_NAME}`;
}

beforeAll(async () => {
  const a = await adminClient.auth.signInWithPassword({
    email: "sau.idk001@gmail.com",
    password: process.env.SEED_ADMIN_PASSWORD!,
  });
  if (a.error) throw a.error;
  const p = await proClient.auth.signInWithPassword({
    email: "profesional.demo@cnvsystem.com",
    password: process.env.SEED_PROFESSIONAL_PASSWORD!,
  });
  if (p.error) throw p.error;

  await cleanup();

  // Profile id del profesional (created_by del tratamiento, FK a profiles).
  const prof = await sql`select profile_id from public.professional_profiles where id = ${PROF_PROFILE_ID}`;
  const createdBy = prof[0].profile_id as string;

  // Cadena clinica de fixture (via superusuario, sin pasar por RLS).
  const [patient] = await sql`
    insert into public.patients (organization_id, document_type, document_number)
    values (${ORG}, 'CC', ${PATIENT_DOC}) returning id`;
  await sql`insert into public.patient_professional_relationships (patient_id, professional_id)
            values (${patient.id}, ${PROF_PROFILE_ID})`;
  const [evaluation] = await sql`
    insert into public.evaluations (patient_id, professional_id, organization_id, type)
    values (${patient.id}, ${PROF_PROFILE_ID}, ${ORG}, 'inicial') returning id`;
  const [diagnosis] = await sql`
    insert into public.diagnoses
      (evaluation_id, efr_state_number, diagnosis_name, engine_version, model_version_id, rules_version)
    values (${evaluation.id}, 1, 'Fixture B5', 'stub', ${MODEL_VERSION_ID}, 'stub') returning id`;
  const [treatment] = await sql`
    insert into public.treatments (diagnosis_id, created_by)
    values (${diagnosis.id}, ${createdBy}) returning id`;
  treatmentId = treatment.id as string;

  // Nutraceutico de fixture + su inventario en 0.
  const [nutra] = await sql`
    insert into public.nutraceuticals (organization_id, name, unit)
    values (${ORG}, ${NUTRA_NAME}, 'capsula') returning id`;
  nutraId = nutra.id as string;
  await sql`insert into public.nutraceutical_inventory (nutraceutical_id, stock_quantity)
            values (${nutraId}, 0)`;
}, 30000);

afterAll(async () => {
  await cleanup();
  await sql.end();
});

describe("B5: inventario y uso (integracion)", () => {
  it("admin ajusta el stock; el profesional NO puede (RLS)", async () => {
    // Admin sube el stock a 25.
    const upd = await adminClient
      .from("nutraceutical_inventory")
      .update({ stock_quantity: 25, last_updated: new Date().toISOString() })
      .eq("nutraceutical_id", nutraId)
      .select("stock_quantity");
    expect(upd.error).toBeNull();
    expect(upd.data?.[0]?.stock_quantity).toBe(25);

    // Profesional intenta ponerlo en 999: la RLS no le da UPDATE, matchea 0 filas.
    const proUpd = await proClient
      .from("nutraceutical_inventory")
      .update({ stock_quantity: 999 })
      .eq("nutraceutical_id", nutraId)
      .select("stock_quantity");
    expect(proUpd.data ?? []).toHaveLength(0);

    // El stock siguio en 25 (no lo cambio el profesional).
    const check = await sql`select stock_quantity from public.nutraceutical_inventory where nutraceutical_id = ${nutraId}`;
    expect(Number(check[0].stock_quantity)).toBe(25);
  }, 30000);

  it("el profesional del paciente registra uso contra el tratamiento", async () => {
    const ins = await proClient
      .from("nutraceutical_usage")
      .insert({ treatment_id: treatmentId, nutraceutical_id: nutraId, quantity: 2 })
      .select("id, quantity")
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data?.quantity).toBe(2);

    // Confirmado en BD.
    const rows = await sql`select quantity from public.nutraceutical_usage where treatment_id = ${treatmentId}`;
    expect(rows.length).toBe(1);
    expect(Number(rows[0].quantity)).toBe(2);
  }, 30000);
});
