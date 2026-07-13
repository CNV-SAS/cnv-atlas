import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

import { ANEXO3_CURRENT_VERSION } from "@/modules/clinical-access/anexo3";

// Integracion contra el Supabase local del bloque de auditoria/control de calidad. Los
// tres concerns viven en UN archivo a proposito: mutan filas compartidas (la firma
// Anexo 3 del profesional del seed y los grants del admin), asi que deben correr
// secuenciales; vitest paraleliza por archivo, no dentro de uno. Simula cada rol como
// PostgREST (set local role authenticated + request.jwt.claims); la RLS se evalua de
// verdad. Requiere `supabase start`, migraciones aplicadas y el seed.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

const ORG_ID = "11111111-1111-1111-1111-111111111111";
// Pacientes para el scope de grants Nivel (c).
const PATIENT_1 = "c0000000-0000-0000-0000-0000000000c1";
const PATIENT_2 = "c0000000-0000-0000-0000-0000000000c2";
// Paciente con relacion (precondicion Anexo 3) y su cadena de notas.
const PATIENT_N = "f0000000-0000-0000-0000-0000000000f1";
const PATIENT_ORPHAN = "f0000000-0000-0000-0000-0000000000f2";
const EVAL_N = "f0000000-0000-0000-0000-0000000000e1";
const DIAG_N = "f0000000-0000-0000-0000-0000000000d1";
const TREAT_N = "f0000000-0000-0000-0000-0000000000c3";
const NOTE_EVAL = "f0000000-0000-0000-0000-00000000ee01";
const NOTE_DIAG = "f0000000-0000-0000-0000-00000000dd01";
const NOTE_TREAT = "f0000000-0000-0000-0000-00000000cc01";

let adminId: string;
let professionalId: string;
let professionalProfileId: string;
let modelVersionId: string;

async function asUser<T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

// --- helpers de grant ---------------------------------------------------------

async function insertGrant(opts: {
  grantType: "notes_pseudonymous" | "notes_identified";
  status: "pending" | "approved" | "denied" | "revoked";
  expiresInterval: string | null;
  resourceId?: string | null;
}) {
  await sql`
    insert into public.clinical_access_grants
      (grant_type, reason_category, status, requester_id, approver_role, resource_id, reason, expires_at)
    values (
      ${opts.grantType}, 'auditoria_calidad', ${opts.status}, ${adminId}, 'direccion',
      ${opts.resourceId ?? null}, 'test',
      ${opts.expiresInterval === null ? null : sql`now() + ${opts.expiresInterval}::interval`}
    )`;
}

async function clearGrants() {
  await sql`delete from public.clinical_access_grants where requester_id in (${adminId}, ${professionalId})`;
}

async function gate(userId: string, grantType: string, resourceId?: string): Promise<boolean> {
  return asUser(userId, async (tx) => {
    const [row] = resourceId
      ? await tx`select public.has_active_grant(${grantType}::public.access_grant_type, ${resourceId}::uuid) as ok`
      : await tx`select public.has_active_grant(${grantType}::public.access_grant_type) as ok`;
    return row.ok as boolean;
  });
}

// --- helpers de Anexo 3 -------------------------------------------------------

async function setAnexo3(v: string | null) {
  if (v === null) {
    await sql`delete from public.professional_document_signatures
      where professional_id = ${professionalProfileId} and document_type = 'anexo3'`;
    return;
  }
  await sql`insert into public.professional_document_signatures
      (professional_id, document_type, signed_version, signed_at)
    values (${professionalProfileId}, 'anexo3', ${v}, now())
    on conflict (professional_id, document_type)
    do update set signed_version = excluded.signed_version, signed_at = excluded.signed_at`;
}

async function precondition(patientId: string): Promise<boolean> {
  const [row] = await sql`select public.patient_professional_anexo3_current(${patientId}) as ok`;
  return row.ok as boolean;
}

// --- helpers de notas ---------------------------------------------------------

async function visibleNotes(userId: string): Promise<number> {
  return asUser(userId, async (tx) => {
    const ev = await tx`select id from public.evaluation_notes where id = ${NOTE_EVAL}`;
    const dg = await tx`select id from public.diagnosis_notes where id = ${NOTE_DIAG}`;
    const tr = await tx`select id from public.treatment_notes where id = ${NOTE_TREAT}`;
    return ev.length + dg.length + tr.length;
  });
}

// -----------------------------------------------------------------------------

beforeAll(async () => {
  [{ id: adminId }] = await sql`
    select p.id from public.profiles p join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id where r.name = 'admin' limit 1`;
  [{ id: professionalId }] = await sql`
    select p.id from public.profiles p join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id where r.name = 'professional' limit 1`;
  [{ id: professionalProfileId }] =
    await sql`select id from public.professional_profiles where profile_id = ${professionalId} limit 1`;
  [{ id: modelVersionId }] = await sql`select id from public.model_versions limit 1`;

  for (const p of [PATIENT_1, PATIENT_2, PATIENT_N, PATIENT_ORPHAN]) {
    await sql`insert into public.patients (id, organization_id, document_type, document_number)
      values (${p}, ${ORG_ID}, 'CC', ${"CA-TEST-" + p.slice(-4)}) on conflict (id) do nothing`;
  }
  await sql`insert into public.patient_professional_relationships (patient_id, professional_id)
    values (${PATIENT_N}, ${professionalProfileId}) on conflict (patient_id, professional_id) do nothing`;
  await sql`insert into public.evaluations (id, patient_id, professional_id, organization_id, type)
    values (${EVAL_N}, ${PATIENT_N}, ${professionalProfileId}, ${ORG_ID}, 'inicial') on conflict (id) do nothing`;
  await sql`insert into public.diagnoses
      (id, evaluation_id, efr_state_number, diagnosis_name, engine_version, model_version_id, rules_version)
    values (${DIAG_N}, ${EVAL_N}, 42, 'test', 'anibise-1.0.0', ${modelVersionId}, 'r1') on conflict (id) do nothing`;
  await sql`insert into public.treatments (id, diagnosis_id, created_by)
    values (${TREAT_N}, ${DIAG_N}, ${professionalId}) on conflict (id) do nothing`;
  await sql`insert into public.evaluation_notes (id, evaluation_id, author_id, note)
    values (${NOTE_EVAL}, ${EVAL_N}, ${professionalId}, 'nota evaluacion') on conflict (id) do nothing`;
  await sql`insert into public.diagnosis_notes (id, diagnosis_id, note)
    values (${NOTE_DIAG}, ${DIAG_N}, 'nota diagnostico') on conflict (id) do nothing`;
  await sql`insert into public.treatment_notes (id, treatment_id, note)
    values (${NOTE_TREAT}, ${TREAT_N}, 'nota tratamiento') on conflict (id) do nothing`;
});

afterAll(async () => {
  await clearGrants();
  await setAnexo3(null);
  await sql`delete from public.evaluation_notes where id = ${NOTE_EVAL}`;
  await sql`delete from public.diagnosis_notes where id = ${NOTE_DIAG}`;
  await sql`delete from public.treatment_notes where id = ${NOTE_TREAT}`;
  await sql`delete from public.treatments where id = ${TREAT_N}`;
  await sql`delete from public.diagnoses where id = ${DIAG_N}`;
  await sql`delete from public.evaluations where id = ${EVAL_N}`;
  await sql`delete from public.patient_professional_relationships where patient_id = ${PATIENT_N}`;
  await sql`delete from public.patients where id in (${PATIENT_1}, ${PATIENT_2}, ${PATIENT_N}, ${PATIENT_ORPHAN})`;
  await sql.end();
});

describe("has_active_grant: ciclo de vida y expiracion", () => {
  it("concede con grant approved y no vencido (Nivel b, alcance amplio)", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "approved", expiresInterval: "30 days" });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(true);
  });

  it("niega si esta pending (aunque no este vencido)", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "pending", expiresInterval: "30 days" });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(false);
  });

  it("niega si esta denied", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "denied", expiresInterval: "30 days" });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(false);
  });

  it("niega si esta approved pero vencido", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "approved", expiresInterval: "-1 hour" });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(false);
  });

  it("niega si esta revoked", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "revoked", expiresInterval: "30 days" });
    expect(await gate(adminId, "notes_pseudonymous")).toBe(false);
  });
});

describe("has_active_grant: scope por tipo y recurso", () => {
  it("Nivel c: concede para el paciente del grant, niega para otro", async () => {
    await clearGrants();
    await insertGrant({
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
    await insertGrant({ grantType: "notes_pseudonymous", status: "approved", expiresInterval: "30 days" });
    expect(await gate(adminId, "notes_identified", PATIENT_1)).toBe(false);
    expect(await gate(adminId, "notes_pseudonymous")).toBe(true);
  });
});

describe("has_active_grant: aislamiento por solicitante", () => {
  it("el grant de un usuario no concede acceso a otro", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "approved", expiresInterval: "30 days" });
    expect(await gate(professionalId, "notes_pseudonymous")).toBe(false);
  });
});

describe("patient_professional_anexo3_current: precondicion Nivel (b)", () => {
  it("concede cuando el profesional firmo la version vigente (sincronia TS<->SQL)", async () => {
    await setAnexo3(ANEXO3_CURRENT_VERSION);
    expect(await precondition(PATIENT_N)).toBe(true);
  });

  it("niega cuando el profesional firmo una version distinta", async () => {
    await setAnexo3("0.9");
    expect(await precondition(PATIENT_N)).toBe(false);
  });

  it("niega cuando el profesional no firmo el Anexo 3 (sin fila)", async () => {
    await setAnexo3(null);
    expect(await precondition(PATIENT_N)).toBe(false);
  });

  it("niega para un paciente sin profesional asignado", async () => {
    await setAnexo3(ANEXO3_CURRENT_VERSION);
    expect(await precondition(PATIENT_ORPHAN)).toBe(false);
  });
});

describe("policies de notas: cierre de admin y apertura Nivel (b)", () => {
  it("admin SIN grant ya no ve ninguna nota (cierre del acceso incondicional)", async () => {
    await clearGrants();
    await setAnexo3("1.0");
    expect(await visibleNotes(adminId)).toBe(0);
  });

  it("admin CON grant activo y Anexo 3 vigente ve las tres notas (Nivel b)", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "approved", expiresInterval: "30 days" });
    await setAnexo3("1.0");
    expect(await visibleNotes(adminId)).toBe(3);
  });

  it("admin CON grant pero SIN Anexo 3 vigente no ve nada (precondicion)", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "approved", expiresInterval: "30 days" });
    await setAnexo3(null);
    expect(await visibleNotes(adminId)).toBe(0);
  });

  it("admin CON grant pero Anexo 3 en version distinta no ve nada", async () => {
    await clearGrants();
    await insertGrant({ grantType: "notes_pseudonymous", status: "approved", expiresInterval: "30 days" });
    await setAnexo3("0.9");
    expect(await visibleNotes(adminId)).toBe(0);
  });

  it("el profesional dueno sigue viendo las notas de su paciente (sin grant)", async () => {
    await clearGrants();
    await setAnexo3(null);
    expect(await visibleNotes(professionalId)).toBe(3);
  });

  it("un grant notes_identified NO abre las notas por RLS (Nivel c va por servidor auditado)", async () => {
    // Aun con un grant identificado valido y con scope a este paciente, la RLS de las
    // notas (que solo responde a notes_pseudonymous) devuelve 0: el acceso identificado
    // no se cuela por RLS, debe pasar por la accion de servidor auditada (access.used).
    await clearGrants();
    await setAnexo3("1.0");
    await insertGrant({
      grantType: "notes_identified",
      status: "approved",
      expiresInterval: "2 days",
      resourceId: PATIENT_N,
    });
    expect(await visibleNotes(adminId)).toBe(0);
  });
});

describe("RLS de clinical_access_grants (SELECT): solicitante y aprobador", () => {
  // Inserta un grant con requester/approver_role explicitos (bypass) y devuelve su id.
  async function insertRaw(requesterId: string, approverRole: string): Promise<string> {
    const [row] = await sql`insert into public.clinical_access_grants
        (grant_type, reason_category, status, requester_id, approver_role, reason)
      values ('notes_pseudonymous', 'auditoria_calidad', 'pending', ${requesterId}, ${approverRole}, 'test')
      returning id`;
    return row.id as string;
  }

  async function grantVisibleTo(userId: string, grantId: string): Promise<boolean> {
    return asUser(userId, async (tx) => {
      const rows = await tx`select id from public.clinical_access_grants where id = ${grantId}`;
      return rows.length === 1;
    });
  }

  it("el solicitante ve su grant; el aprobador (por approver_role) tambien; un tercero no", async () => {
    await clearGrants();
    // Grant cuyo aprobador designado es 'admin' (como una solicitud de soporte).
    const g1 = await insertRaw(professionalId, "admin");
    expect(await grantVisibleTo(professionalId, g1)).toBe(true); // solicitante
    expect(await grantVisibleTo(adminId, g1)).toBe(true); // has_role('admin') = approver_role

    // Grant cuyo aprobador designado es 'direccion': admin no lo ve (ni es solicitante ni
    // tiene el rol), el solicitante si.
    const g2 = await insertRaw(adminId, "direccion");
    expect(await grantVisibleTo(adminId, g2)).toBe(true); // solicitante
    expect(await grantVisibleTo(professionalId, g2)).toBe(false); // ni solicitante ni direccion

    await clearGrants();
  });
});
