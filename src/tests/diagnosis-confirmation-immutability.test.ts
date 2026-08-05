import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Integracion contra el Supabase local (mini-bloque): el trigger diagnoses_confirmation_immutability
// (mig 0027). La confirmacion es la FIRMA CLINICA del diagnostico: una vez sellada no se cambia ni se
// borra. Corre como owner (DATABASE_URL): la RLS no aplica, el trigger si. Verifica el camino que
// PASA (null -> valor) y los que NO deben (cambiar/limpiar una confirmacion sellada, borrar un
// diagnostico confirmado), mas que un diagnostico SIN confirmar si se puede borrar.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

const CONFIRMED = "e0000000-0000-4000-8000-0000000000e1";
const UNCONFIRMED = "e0000000-0000-4000-8000-0000000000e2";
let profileId: string;

beforeAll(async () => {
  const [ev] = await sql<{ id: string }[]>`SELECT id FROM evaluations LIMIT 1`;
  const [mv] = await sql<{ id: string }[]>`SELECT id FROM model_versions WHERE status='active' LIMIT 1`;
  const [p] = await sql<{ id: string }[]>`SELECT id FROM profiles LIMIT 1`;
  profileId = p.id;
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM diagnoses WHERE id IN (${CONFIRMED}, ${UNCONFIRMED})`;
  });
  for (const id of [CONFIRMED, UNCONFIRMED]) {
    await sql`INSERT INTO diagnoses (id, evaluation_id, efr_state_number, diagnosis_name, engine_version, model_version_id, rules_version)
      VALUES (${id}, ${ev.id}, 33, 'test inmutabilidad confirmacion', 'anibise-1.0.0', ${mv.id}, 'r1')`;
  }
});

afterAll(async () => {
  // El confirmado no se puede borrar normal (el trigger lo blinda): se limpia por el bypass.
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM diagnoses WHERE id IN (${CONFIRMED}, ${UNCONFIRMED})`;
  });
  await sql.end();
});

describe("diagnoses_confirmation_immutability (mig 0027)", () => {
  it("confirmar (null -> valor) PASA", async () => {
    const r = await sql`UPDATE diagnoses SET confirmed_by=${profileId}, confirmed_at=now()
      WHERE id=${CONFIRMED} AND confirmed_by IS NULL RETURNING id`;
    expect(r.length).toBe(1);
  });

  it("cambiar confirmed_by ya sellado FALLA", async () => {
    await expect(
      sql`UPDATE diagnoses SET confirmed_by=${profileId}, confirmed_at=now() WHERE id=${CONFIRMED}`,
    ).rejects.toThrow();
  });

  it("limpiar confirmed_by ya sellado FALLA", async () => {
    await expect(
      sql`UPDATE diagnoses SET confirmed_by=NULL, confirmed_at=NULL WHERE id=${CONFIRMED}`,
    ).rejects.toThrow();
  });

  it("cambiar confirmed_profession ya sellada FALLA (parte de la firma clinica, mig 0037)", async () => {
    await expect(
      sql`UPDATE diagnoses SET confirmed_profession='medico' WHERE id=${CONFIRMED}`,
    ).rejects.toThrow();
  });

  it("borrar un diagnostico confirmado FALLA", async () => {
    await expect(sql`DELETE FROM diagnoses WHERE id=${CONFIRMED}`).rejects.toThrow();
  });

  it("borrar un diagnostico SIN confirmar PASA", async () => {
    const r = await sql`DELETE FROM diagnoses WHERE id=${UNCONFIRMED} RETURNING id`;
    expect(r.length).toBe(1);
  });
});
