import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { ANEXO3_CURRENT_VERSION } from "@/modules/clinical-access/anexo3";

// Integracion contra el Supabase local: prueba public.patient_professional_anexo3_current
// (0018), la precondicion del Nivel (b). El helper no depende de auth.uid() (mira la
// firma del profesional del paciente en professional_document_signatures), asi que se
// llama directo.
//
// Ademas verifica la SINCRONIA TS<->SQL: firma con ANEXO3_CURRENT_VERSION (la constante
// TS) y exige que el helper (que compara contra su literal) concuerde. Si alguien sube
// la constante sin migrar el helper, este test falla.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const PATIENT_LINKED = "d0000000-0000-0000-0000-0000000000d1";
const PATIENT_ORPHAN = "d0000000-0000-0000-0000-0000000000d2";

let professionalProfileId: string;

async function precondition(patientId: string): Promise<boolean> {
  const [row] = await sql`select public.patient_professional_anexo3_current(${patientId}) as ok`;
  return row.ok as boolean;
}

// Simula la firma del Anexo 3 del profesional. null = no firmado (sin fila).
async function setAnexo3(v: string | null) {
  if (v === null) {
    await sql`delete from public.professional_document_signatures
      where professional_id = ${professionalProfileId} and document_type = 'anexo3'`;
    return;
  }
  await sql`
    insert into public.professional_document_signatures
      (professional_id, document_type, signed_version, signed_at)
    values (${professionalProfileId}, 'anexo3', ${v}, now())
    on conflict (professional_id, document_type)
    do update set signed_version = excluded.signed_version, signed_at = excluded.signed_at`;
}

beforeAll(async () => {
  const [prof] = await sql`
    select pp.id from public.professional_profiles pp
    join public.profiles p on p.id = pp.profile_id
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where r.name = 'professional' limit 1`;
  professionalProfileId = prof.id;

  await sql`insert into public.patients (id, organization_id, document_type, document_number)
    values (${PATIENT_LINKED}, ${ORG_ID}, 'CC', 'ANEXO3-LINKED') on conflict (id) do nothing`;
  await sql`insert into public.patients (id, organization_id, document_type, document_number)
    values (${PATIENT_ORPHAN}, ${ORG_ID}, 'CC', 'ANEXO3-ORPHAN') on conflict (id) do nothing`;
  await sql`insert into public.patient_professional_relationships (patient_id, professional_id)
    values (${PATIENT_LINKED}, ${professionalProfileId}) on conflict (patient_id, professional_id) do nothing`;
});

afterAll(async () => {
  await setAnexo3(null);
  await sql`delete from public.patient_professional_relationships where patient_id = ${PATIENT_LINKED}`;
  await sql`delete from public.patients where id in (${PATIENT_LINKED}, ${PATIENT_ORPHAN})`;
  await sql.end();
});

describe("patient_professional_anexo3_current: precondicion Nivel (b)", () => {
  it("concede cuando el profesional firmo la version vigente (sincronia TS<->SQL)", async () => {
    await setAnexo3(ANEXO3_CURRENT_VERSION);
    expect(await precondition(PATIENT_LINKED)).toBe(true);
  });

  it("niega cuando el profesional firmo una version distinta", async () => {
    await setAnexo3("0.9");
    expect(await precondition(PATIENT_LINKED)).toBe(false);
  });

  it("niega cuando el profesional no firmo el Anexo 3 (sin fila)", async () => {
    await setAnexo3(null);
    expect(await precondition(PATIENT_LINKED)).toBe(false);
  });

  it("niega para un paciente sin profesional asignado", async () => {
    await setAnexo3(ANEXO3_CURRENT_VERSION);
    expect(await precondition(PATIENT_ORPHAN)).toBe(false);
  });
});
