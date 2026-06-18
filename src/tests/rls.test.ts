import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Tests de integracion de la capa de datos contra el stack local de Supabase.
// Simulan cada rol como lo hace PostgREST: conexion directa, `set local role
// authenticated` y el claim request.jwt.claims que lee auth.uid(). Asi la RLS se
// evalua de verdad, no se simula. Requieren `supabase start` y el seed aplicado.

// Cargamos DATABASE_URL desde .env.local (vitest no lo hace por su cuenta).
if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const PATIENT_A = "a0000000-0000-0000-0000-0000000000a1";
const PATIENT_B = "b0000000-0000-0000-0000-0000000000b1";
const EVAL_A = "e0000000-0000-0000-0000-0000000000e1";

let adminId: string;
let professionalId: string;
let professionalProfileId: string;

// Ejecuta `fn` dentro de una transaccion con el rol authenticated y el claim sub
// del usuario indicado. La transaccion se revierte al terminar (o al fallar), asi
// los intentos de escritura no dejan rastro.
async function asUser(userId: string, fn: (tx: postgres.TransactionSql) => Promise<void>) {
  await sql.begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await fn(tx);
  });
}

beforeAll(async () => {
  [{ id: adminId }] = await sql`
    select p.id from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where r.name = 'admin' limit 1`;
  [{ id: professionalId }] = await sql`
    select p.id from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id
    where r.name = 'professional' limit 1`;
  [{ id: professionalProfileId }] =
    await sql`select id from public.professional_profiles where profile_id = ${professionalId} limit 1`;

  // Fixtures (como postgres, bypass RLS). Idempotentes.
  await sql`insert into public.patients (id, organization_id, document_type, document_number)
    values (${PATIENT_A}, ${ORG_ID}, 'CC', 'RLS-TEST-A') on conflict (id) do nothing`;
  await sql`insert into public.patients (id, organization_id, document_type, document_number)
    values (${PATIENT_B}, ${ORG_ID}, 'CC', 'RLS-TEST-B') on conflict (id) do nothing`;
  await sql`insert into public.patient_professional_relationships (patient_id, professional_id)
    values (${PATIENT_A}, ${professionalProfileId}) on conflict (patient_id, professional_id) do nothing`;
  await sql`insert into public.evaluations (id, patient_id, professional_id, organization_id, type)
    values (${EVAL_A}, ${PATIENT_A}, ${professionalProfileId}, ${ORG_ID}, 'inicial') on conflict (id) do nothing`;
});

afterAll(async () => {
  // Limpieza hijo-primero (evaluations referencia patient con restrict).
  await sql`delete from public.evaluations where id = ${EVAL_A}`;
  await sql`delete from public.patient_consents where patient_id = ${PATIENT_A}`;
  await sql`delete from public.patient_professional_relationships where patient_id = ${PATIENT_A}`;
  await sql`delete from public.patients where id in (${PATIENT_A}, ${PATIENT_B})`;
  await sql.end();
});

describe("clinical_audit_log append-only", () => {
  it("bloquea UPDATE incluso con service role (trigger)", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe("set local role service_role"); // bypassa RLS, no el trigger
        const [row] = await tx`insert into public.clinical_audit_log (event) values ('test') returning id`;
        await tx`update public.clinical_audit_log set event = 'hacked' where id = ${row.id}`;
      }),
    ).rejects.toThrow(/append-only/);
  });

  it("bloquea DELETE incluso con service role (trigger)", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe("set local role service_role");
        const [row] = await tx`insert into public.clinical_audit_log (event) values ('test') returning id`;
        await tx`delete from public.clinical_audit_log where id = ${row.id}`;
      }),
    ).rejects.toThrow(/append-only/);
  });

  it("el profesional no puede escribir el audit log (sin policy de INSERT)", async () => {
    await expect(
      asUser(professionalId, async (tx) => {
        await tx`insert into public.clinical_audit_log (event) values ('hack')`;
      }),
    ).rejects.toThrow(/row-level security|permission denied/i);
  });
});

describe("RLS por rol en pacientes y evaluaciones", () => {
  it("el profesional ve a su paciente, no a uno ajeno", async () => {
    await asUser(professionalId, async (tx) => {
      const own = await tx`select id from public.patients where id = ${PATIENT_A}`;
      const other = await tx`select id from public.patients where id = ${PATIENT_B}`;
      expect(own.length).toBe(1);
      expect(other.length).toBe(0);
    });
  });

  it("el profesional ve su evaluacion", async () => {
    await asUser(professionalId, async (tx) => {
      const rows = await tx`select id from public.evaluations where id = ${EVAL_A}`;
      expect(rows.length).toBe(1);
    });
  });

  it("el admin ve a ambos pacientes", async () => {
    await asUser(adminId, async (tx) => {
      const rows = await tx`select id from public.patients where id in (${PATIENT_A}, ${PATIENT_B})`;
      expect(rows.length).toBe(2);
    });
  });

  it("el profesional no puede ver el audit log (solo admin)", async () => {
    await asUser(professionalId, async (tx) => {
      const rows = await tx`select id from public.clinical_audit_log limit 1`;
      expect(rows.length).toBe(0);
    });
  });

  it("sin sesion (rol anon) no obtiene datos del paciente", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe("set local role anon");
        await tx`select id from public.patients where id = ${PATIENT_A}`;
      }),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });
});

describe("esquema: campos clave de consentimiento (criterio B1)", () => {
  it("patient_consents tiene revoked_at y existe el enum consent_type_enum", async () => {
    const col = await sql`
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'patient_consents' and column_name = 'revoked_at'`;
    expect(col.length).toBe(1);

    const enumType = await sql`
      select 1 from pg_type where typname = 'consent_type_enum' and typtype = 'e'`;
    expect(enumType.length).toBe(1);
  });
});

describe("gate de consentimiento: una sola autorizacion activa por tipo", () => {
  it("rechaza un segundo consentimiento 'servicio' activo y permite re-consentir tras revocar", async () => {
    // Estado limpio para este paciente.
    await sql`delete from public.patient_consents where patient_id = ${PATIENT_A}`;

    // Primera autorizacion activa: ok.
    await sql`insert into public.patient_consents (patient_id, consent_type, consent_version, document_hash)
      values (${PATIENT_A}, 'servicio', '1.2', 'hash1')`;

    // Segunda activa del mismo tipo: la viola el indice unico parcial.
    await expect(
      sql`insert into public.patient_consents (patient_id, consent_type, consent_version, document_hash)
        values (${PATIENT_A}, 'servicio', '1.2', 'hash2')`,
    ).rejects.toThrow(/patient_consents_one_active_idx|duplicate key/);

    // Tras revocar la primera, re-consentir es valido.
    await sql`update public.patient_consents set revoked_at = now()
      where patient_id = ${PATIENT_A} and consent_type = 'servicio' and revoked_at is null`;
    await sql`insert into public.patient_consents (patient_id, consent_type, consent_version, document_hash)
      values (${PATIENT_A}, 'servicio', '1.2', 'hash3')`;

    const active = await sql`select count(*)::int as n from public.patient_consents
      where patient_id = ${PATIENT_A} and consent_type = 'servicio' and revoked_at is null`;
    expect(active[0].n).toBe(1);
  });
});
