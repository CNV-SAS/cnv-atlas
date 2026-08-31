import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Integracion contra el Supabase local: el trigger `treatments_immutability` DESPUES de la 0093, que
// permite reabrir una prescripcion aprobada (Gildardo 2026-08-30 §6c).
//
// POR QUE ESTOS TESTS SON LOS QUE IMPORTAN. Lo que su instruccion pide no es que exista un boton: es que
// el rastro sea la CONDICION de la reapertura, no un efecto que se pueda omitir. Eso solo se puede
// afirmar si la BASE lo rechaza, y eso solo se puede probar EJECUTANDO contra la base. Un test del
// servicio pasaria verde aunque el trigger no exigiera nada: probaria que nuestro codigo manda los sellos,
// no que sean obligatorios.
//
// Corre como owner (DATABASE_URL): la RLS no aplica, el trigger si.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

const TREATMENT = "d0000000-0000-4000-8000-0000000000d1";
let profileId: string;
let diagnosisId: string;

const APROBADA = { fenotipo: "F5", estrategia: "prueba de reapertura", protMin: 1.2 };

/** Deja el tratamiento en 'approved' con su prescripcion sellada. */
async function dejarAprobado() {
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM treatment_approvals WHERE treatment_id = ${TREATMENT}`;
    await tx`DELETE FROM treatments WHERE id = ${TREATMENT}`;
    await tx`INSERT INTO treatments (id, diagnosis_id, created_by, status, protocol_approved, approved_by, approved_at, kcal_objetivo, proteina_g)
      VALUES (${TREATMENT}, ${diagnosisId}, ${profileId}, 'approved', ${sql.json(APROBADA)}, ${profileId}, now(), 2000, 110)`;
  });
}

beforeAll(async () => {
  const [d] = await sql<{ id: string }[]>`SELECT id FROM diagnoses LIMIT 1`;
  const [p] = await sql<{ id: string }[]>`SELECT id FROM profiles LIMIT 1`;
  diagnosisId = d.id;
  profileId = p.id;
  await dejarAprobado();
});

afterAll(async () => {
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM treatment_approvals WHERE treatment_id = ${TREATMENT}`;
    await tx`DELETE FROM treatments WHERE id = ${TREATMENT}`;
  });
  await sql.end();
});

describe("sin los tres sellos, la base RECHAZA la reapertura", () => {
  it("volver a draft sin nada: rechazado", async () => {
    await dejarAprobado();
    await expect(
      sql`UPDATE treatments SET status='draft', protocol_approved=NULL, approved_by=NULL, approved_at=NULL WHERE id=${TREATMENT}`,
    ).rejects.toThrow(/quien, cuando y por que/i);
  });

  it("con motivo VACÍO: rechazado (una razón en blanco no registra nada)", async () => {
    await dejarAprobado();
    await expect(
      sql`UPDATE treatments SET status='draft', protocol_approved=NULL, approved_by=NULL, approved_at=NULL,
          reopened_at=now(), reopened_by=${profileId}, reopen_reason='   ' WHERE id=${TREATMENT}`,
    ).rejects.toThrow(/quien, cuando y por que/i);
  });

  it("sin decir QUIÉN: rechazado", async () => {
    await dejarAprobado();
    await expect(
      sql`UPDATE treatments SET status='draft', protocol_approved=NULL, approved_by=NULL, approved_at=NULL,
          reopened_at=now(), reopen_reason='motivo suficiente' WHERE id=${TREATMENT}`,
    ).rejects.toThrow(/quien, cuando y por que/i);
  });

  it("y con los sellos pero SIN soltar la aprobación: rechazado", async () => {
    // La otra mitad, y es la que protege el documento del paciente: si la fila se quedara en draft CON su
    // protocol_approved, la siguiente aprobación lo sobrescribiría y la prescripción que la persona tiene
    // en la mano desaparecería. La base exige que salga de la fila (y el writer la mueve a la historia).
    await dejarAprobado();
    await expect(
      sql`UPDATE treatments SET status='draft',
          reopened_at=now(), reopened_by=${profileId}, reopen_reason='motivo suficiente' WHERE id=${TREATMENT}`,
    ).rejects.toThrow(/se mueve a treatment_approvals/i);
  });
});

describe("con los tres sellos, la reapertura pasa", () => {
  it("approved -> draft con quién, cuándo y por qué", async () => {
    await dejarAprobado();
    await sql`UPDATE treatments SET status='draft', protocol_approved=NULL, approved_by=NULL, approved_at=NULL,
        reopened_at=now(), reopened_by=${profileId}, reopen_reason='el paciente reportó una intolerancia'
        WHERE id=${TREATMENT}`;
    const [t] = await sql<
      { status: string; protocol_approved: unknown; reopen_reason: string }[]
    >`SELECT status, protocol_approved, reopen_reason FROM treatments WHERE id=${TREATMENT}`;
    expect(t.status).toBe("draft");
    expect(t.protocol_approved).toBe(null);
    expect(t.reopen_reason).toContain("intolerancia");
  });

  it("y la historia acepta la aprobación que salió de la fila", async () => {
    await dejarAprobado();
    await sql`INSERT INTO treatment_approvals (treatment_id, protocol_approved, approved_by, approved_at, kcal_objetivo, proteina_g, reopened_by, reopen_reason)
      VALUES (${TREATMENT}, ${sql.json(APROBADA)}, ${profileId}, now(), 2000, 110, ${profileId}, 'motivo suficiente')`;
    const [h] = await sql<
      { protocol_approved: { estrategia: string }; kcal_objetivo: number }[]
    >`SELECT protocol_approved, kcal_objetivo FROM treatment_approvals WHERE treatment_id=${TREATMENT}`;
    expect(h.protocol_approved.estrategia).toBe("prueba de reapertura");
    expect(h.kcal_objetivo).toBe(2000);
  });
});

describe("lo que la 0093 NO relajó", () => {
  it("estando aprobada, la prescripción sigue congelada", async () => {
    // El riesgo de tocar un trigger es aflojar de más. Se comprueba que la rama vieja sigue en pie.
    await dejarAprobado();
    await expect(
      sql`UPDATE treatments SET kcal_objetivo = 1234 WHERE id=${TREATMENT}`,
    ).rejects.toThrow(/inmutable/i);
  });

  it("una prescripción aprobada sigue sin poder borrarse", async () => {
    await dejarAprobado();
    await expect(sql`DELETE FROM treatments WHERE id=${TREATMENT}`).rejects.toThrow(/no se puede borrar/i);
  });

  it("y approved -> cualquier otro estado que no sea draft sigue prohibido", async () => {
    // La 0093 abre UNA transicion, no la salida de 'approved' en general.
    await dejarAprobado();
    await expect(
      sql`UPDATE treatments SET status='approved', kcal_objetivo=999 WHERE id=${TREATMENT}`,
    ).rejects.toThrow(/inmutable/i);
  });
});
