import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Integracion contra el Supabase local: prueba el gate public.has_active_grant (0016)
// con la RLS real, simulando al usuario como PostgREST (set local role authenticated +
// request.jwt.claims). Requiere `supabase start` y las migraciones aplicadas.
//
// Cada escenario limpia los grants del solicitante antes de insertar el suyo, para que
// un grant activo no contamine la prueba de otro estado. Los grants se insertan como
// postgres (bypass RLS); la lectura del helper se hace como el usuario.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const PATIENT_1 = "c0000000-0000-0000-0000-0000000000c1";
const PATIENT_2 = "c0000000-0000-0000-0000-0000000000c2";

let adminId: string;
let professionalId: string;

async function asUser<T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

// Inserta un grant (como postgres, bypass RLS). expiresAt es un intervalo relativo a
// now() de la BD, o null, para no depender del reloj del proceso de test.
async function insertGrant(opts: {
  requesterId: string;
  grantType: "notes_pseudonymous" | "notes_identified";
  status: "pending" | "approved" | "denied" | "revoked";
  expiresInterval: string | null; // ej. '30 days', '-1 hour', o null
  resourceId?: string | null;
}) {
  const expires = opts.expiresInterval === null ? null : opts.expiresInterval;
  await sql`
    insert into public.clinical_access_grants
      (grant_type, reason_category, status, requester_id, approver_role, resource_id, reason, expires_at)
    values (
      ${opts.grantType}, 'auditoria_calidad', ${opts.status}, ${opts.requesterId}, 'direccion',
      ${opts.resourceId ?? null},
      'test',
      ${expires === null ? null : sql`now() + ${expires}::interval`}
    )`;
}

async function gate(userId: string, grantType: string, resourceId?: string): Promise<boolean> {
  return asUser(userId, async (tx) => {
    const [row] = resourceId
      ? await tx`select public.has_active_grant(${grantType}::public.access_grant_type, ${resourceId}::uuid) as ok`
      : await tx`select public.has_active_grant(${grantType}::public.access_grant_type) as ok`;
    return row.ok as boolean;
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

  await sql`insert into public.patients (id, organization_id, document_type, document_number)
    values (${PATIENT_1}, ${ORG_ID}, 'CC', 'GRANT-TEST-1') on conflict (id) do nothing`;
  await sql`insert into public.patients (id, organization_id, document_type, document_number)
    values (${PATIENT_2}, ${ORG_ID}, 'CC', 'GRANT-TEST-2') on conflict (id) do nothing`;
});

afterAll(async () => {
  await sql`delete from public.clinical_access_grants where requester_id in (${adminId}, ${professionalId})`;
  await sql`delete from public.patients where id in (${PATIENT_1}, ${PATIENT_2})`;
  await sql.end();
});

async function clearGrants() {
  await sql`delete from public.clinical_access_grants where requester_id in (${adminId}, ${professionalId})`;
}

describe("has_active_grant: ciclo de vida y expiracion", () => {
  it("concede con grant approved y no vencido (Nivel b, alcance amplio)", async () => {
    await clearGrants();
    await insertGrant({
      requesterId: adminId,
      grantType: "notes_pseudonymous",
      status: "approved",
      expiresInterval: "30 days",
    });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(true);
  });

  it("niega si esta pending (aunque no este vencido)", async () => {
    await clearGrants();
    await insertGrant({
      requesterId: adminId,
      grantType: "notes_pseudonymous",
      status: "pending",
      expiresInterval: "30 days",
    });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(false);
  });

  it("niega si esta denied", async () => {
    await clearGrants();
    await insertGrant({
      requesterId: adminId,
      grantType: "notes_pseudonymous",
      status: "denied",
      expiresInterval: "30 days",
    });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(false);
  });

  it("niega si esta approved pero vencido", async () => {
    await clearGrants();
    await insertGrant({
      requesterId: adminId,
      grantType: "notes_pseudonymous",
      status: "approved",
      expiresInterval: "-1 hour",
    });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(false);
  });

  it("niega si esta revoked", async () => {
    await clearGrants();
    await insertGrant({
      requesterId: adminId,
      grantType: "notes_pseudonymous",
      status: "revoked",
      expiresInterval: "30 days",
    });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(false);
  });
});

describe("has_active_grant: scope por tipo y recurso", () => {
  it("Nivel c: concede para el paciente del grant, niega para otro", async () => {
    await clearGrants();
    await insertGrant({
      requesterId: adminId,
      grantType: "notes_identified",
      status: "approved",
      expiresInterval: "2 days",
      resourceId: PATIENT_1,
    });
    expect(await gate(adminId, "notes_identified", PATIENT_1)).toBe(true);
    expect(await gate(adminId, "notes_identified", PATIENT_2)).toBe(false);
  });

  it("un grant Nivel b (amplio) no concede acceso Nivel c (identificado)", async () => {
    await clearGrants();
    await insertGrant({
      requesterId: adminId,
      grantType: "notes_pseudonymous",
      status: "approved",
      expiresInterval: "30 days",
    });
    expect(await gate(adminId, "notes_identified", PATIENT_1)).toBe(false);
    expect(await gate(adminId, "notes_pseudonymous")).toBe(true);
  });
});

describe("has_active_grant: aislamiento por solicitante", () => {
  it("el grant de un usuario no concede acceso a otro", async () => {
    await clearGrants();
    await insertGrant({
      requesterId: adminId,
      grantType: "notes_pseudonymous",
      status: "approved",
      expiresInterval: "30 days",
    });
    // El profesional no es el solicitante: el gate no lo concede.
    expect(await gate(professionalId, "notes_pseudonymous")).toBe(false);
  });
});
