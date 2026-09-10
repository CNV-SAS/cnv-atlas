import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Integracion contra el Supabase local. Verifica el trigger `treatments_immutability` DESPUES de la
// migracion 0116, que retiro dos de sus tres ramas.
//
// QUE CAMBIO Y POR QUE (Santiago, 2026-09-09). Aprobar hacia dos cosas pegadas: sellaba la prescripcion y
// la CERRABA. Se retiro el cierre, porque era lo que obligaba a un boton que parece un tramite, bloqueaba
// la edicion y exigia reabrir con motivo para corregir una coma. Lo que el cierre protegia por efecto
// lateral (que un documento ya entregado no cambiara) lo hace ahora la copia inmutable de cada emision,
// que es mas fuerte: el congelado protegia solo mientras nadie reabriera.
//
// LO QUE ESTE ARCHIVO TIENE QUE SEGUIR AFIRMANDO, y es la mitad que no se toco:
//   · `protocol_suggested` sigue siendo write-once. Es la salida del MOTOR (regla dura 7), no una decision
//     del profesional, y es lo que hace REPRODUCIBLE una emision: la copia guarda los ajustes, y
//     recomputar con ellos solo da lo mismo si el sugerido no se movio.
//   · Un plan que YA SALIO hacia un paciente no se borra. Misma regla, otro criterio: antes la marcaba el
//     estado 'approved' y ahora la marca tener emisiones.
//
// Corre como owner (DATABASE_URL): la RLS no aplica, el trigger si. Requiere migraciones aplicadas + seed.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

let treatmentId: string;
let evaluationId: string;
let profileId: string;

beforeAll(async () => {
  const [d] = await sql<{ id: string; evaluation_id: string }[]>`
    SELECT id, evaluation_id FROM diagnoses LIMIT 1`;
  const [p] = await sql<{ id: string }[]>`SELECT id FROM profiles LIMIT 1`;
  profileId = p.id;
  evaluationId = d.evaluation_id;
  const [t] = await sql<{ id: string }[]>`
    INSERT INTO treatments (diagnosis_id, created_by) VALUES (${d.id}, ${p.id}) RETURNING id`;
  treatmentId = t.id;
});

afterAll(async () => {
  // El tratamiento acaba con una emision, asi que el trigger prohibe borrarlo. Se limpia por la via de
  // bypass documentada (session_replication_role = replica). Solo en pruebas/dev.
  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM prescription_emissions WHERE treatment_id = ${treatmentId}`;
    await tx`DELETE FROM treatments WHERE id = ${treatmentId}`;
  });
  await sql.end();
});

describe("treatments_immutability, despues de retirar el candado", () => {
  it("protocol_suggested SIGUE siendo write-once", async () => {
    await sql`UPDATE treatments SET protocol_suggested = ${JSON.stringify({ a: 1 })}::jsonb WHERE id = ${treatmentId}`;
    await expect(
      sql`UPDATE treatments SET protocol_suggested = ${JSON.stringify({ a: 2 })}::jsonb WHERE id = ${treatmentId}`,
    ).rejects.toThrow();
  });

  it("la prescripcion se puede editar DESPUES de haberla entregado", async () => {
    // ESTA ES LA PETICION DE SANTIAGO, hecha comprobable. Antes esto era imposible: al aprobar, el trigger
    // congelaba `kcal_objetivo`, los seis `adj_*` y el propio estado, y la unica salida era reabrir con un
    // motivo escrito. Ahora entregar no cierra nada.
    await sql`
      INSERT INTO prescription_emissions
        (treatment_id, evaluation_id, prescripcion, kcal_objetivo, proteina_g, via, emitted_by, emitted_by_email)
      VALUES (${treatmentId}, ${evaluationId}, ${JSON.stringify({ calorico: { kcalObj: 2000 } })}::jsonb,
              2000, 60, 'impresa', ${profileId}, 'pro@cnv')`;

    // Lo que ANTES estaba congelado y ahora no:
    await sql`UPDATE treatments SET kcal_objetivo = 2100 WHERE id = ${treatmentId}`;
    await sql`UPDATE treatments SET adj_prot_gkg = 1.5 WHERE id = ${treatmentId}`;
    await sql`UPDATE treatments SET proteina_g = 70 WHERE id = ${treatmentId}`;

    const [row] = await sql<{ kcal: number; prot: number }[]>`
      SELECT kcal_objetivo AS kcal, proteina_g AS prot FROM treatments WHERE id = ${treatmentId}`;
    expect(row.kcal).toBe(2100);
    expect(row.prot).toBe(70);

    // Y lo que ya era editable lo sigue siendo (control: el cambio no aflojo por otro lado).
    await sql`UPDATE treatments SET proxima_cita = '2026-08-01' WHERE id = ${treatmentId}`;
    await sql`UPDATE treatments SET restricciones = ARRAY['sin gluten'] WHERE id = ${treatmentId}`;
  });

  it("pero la EMISION no se puede tocar: es la constancia de lo que recibio el paciente", async () => {
    // El candado se movio de sitio, no desaparecio. Aqui es donde vive ahora.
    await expect(
      sql`UPDATE prescription_emissions SET kcal_objetivo = 9999 WHERE treatment_id = ${treatmentId}`,
    ).rejects.toThrow();
    await expect(
      sql`DELETE FROM prescription_emissions WHERE treatment_id = ${treatmentId}`,
    ).rejects.toThrow();
  });

  it("y un plan que ya se entrego no se puede borrar", async () => {
    // MISMA REGLA, OTRO CRITERIO: antes la marcaba `status = 'approved'`, ahora tener emisiones. El hecho
    // clinico es el mismo, dicho con el estado que si existe.
    await expect(sql`DELETE FROM treatments WHERE id = ${treatmentId}`).rejects.toThrow();
  });
});
