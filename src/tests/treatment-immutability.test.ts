import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Integracion contra el Supabase local (T2 A2). Verifica el trigger treatments_immutability:
// protocol_suggested write-once, congelamiento de la prescripcion al aprobar, y que
// proxima_cita/restricciones/restrictions_ack_* queden editables tras aprobar. Corre como
// owner (DATABASE_URL): la RLS no aplica, el trigger si. Requiere migraciones aplicadas + seed.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

let treatmentId: string;
let profileId: string;

beforeAll(async () => {
  const [d] = await sql<{ id: string }[]>`SELECT id FROM diagnoses LIMIT 1`;
  const [p] = await sql<{ id: string }[]>`SELECT id FROM profiles LIMIT 1`;
  profileId = p.id;
  const [t] = await sql<{ id: string }[]>`
    INSERT INTO treatments (diagnosis_id, created_by) VALUES (${d.id}, ${p.id}) RETURNING id`;
  treatmentId = t.id;
});

afterAll(async () => {
  // El tratamiento queda approved (inmutable); se limpia por la via de bypass documentada
  // (session_replication_role = replica desactiva el trigger). Solo en pruebas/dev.
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM treatments WHERE id = ${treatmentId}`;
  });
  await sql.end();
});

describe("treatments_immutability", () => {
  it("protocol_suggested es write-once", async () => {
    await sql`UPDATE treatments SET protocol_suggested = ${JSON.stringify({ a: 1 })}::jsonb WHERE id = ${treatmentId}`;
    await expect(
      sql`UPDATE treatments SET protocol_suggested = ${JSON.stringify({ a: 2 })}::jsonb WHERE id = ${treatmentId}`,
    ).rejects.toThrow();
  });

  it("congela la prescripcion al aprobar; deja editables proxima_cita, restricciones y ack", async () => {
    await sql`UPDATE treatments SET status = 'approved', approved_by = ${profileId}, approved_at = now(), protocol_approved = ${JSON.stringify({ x: 1 })}::jsonb WHERE id = ${treatmentId}`;

    // Congelados:
    await expect(
      sql`UPDATE treatments SET kcal_objetivo = 2000 WHERE id = ${treatmentId}`,
    ).rejects.toThrow();
    await expect(
      sql`UPDATE treatments SET adj_prot_gkg = 1.5 WHERE id = ${treatmentId}`,
    ).rejects.toThrow();
    await expect(
      sql`UPDATE treatments SET status = 'draft' WHERE id = ${treatmentId}`,
    ).rejects.toThrow();

    // Editables tras aprobar:
    await sql`UPDATE treatments SET proxima_cita = '2026-08-01' WHERE id = ${treatmentId}`;
    await sql`UPDATE treatments SET restricciones = ARRAY['sin gluten'] WHERE id = ${treatmentId}`;
    await sql`UPDATE treatments SET restrictions_ack_at = now(), restrictions_ack_by = ${profileId} WHERE id = ${treatmentId}`;
  });

  it("no se puede borrar un protocolo aprobado", async () => {
    await expect(sql`DELETE FROM treatments WHERE id = ${treatmentId}`).rejects.toThrow();
  });
});
