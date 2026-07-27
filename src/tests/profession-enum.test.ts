import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

// Integracion contra el Supabase local (T2 A1). Ancla la regla dura de A1: professional_profiles
// .profession es lista cerrada (enum), no texto libre; un valor fuera de lista se rechaza a nivel
// BD. Requiere `supabase start`, la migracion 0024 aplicada y DATABASE_URL (.env.local).
// Segunda red: tambien verifica que la migracion HIZO EFECTO. Si la columna hubiera quedado en
// text (drizzle-kit sub-genera el text -> enum), insertar un valor invalido funcionaria y el
// primer test fallaria. Es decir, este test cae si el SET DATA TYPE no se aplico, no solo si el
// enum estuviera mal definido.

if (!process.env.DATABASE_URL) {
  process.loadEnvFile?.(".env.local");
}

const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

afterAll(async () => {
  await sql.end();
});

describe("professional_profession enum", () => {
  it("rechaza un valor fuera de lista", async () => {
    // El cast falla en la BD (22P02). Prueba el candado sin depender de una fila concreta.
    await expect(sql`SELECT 'kinesiologo'::professional_profession`).rejects.toThrow();
  });

  it("acepta exactamente los cuatro valores validos", async () => {
    const rows = await sql<{ v: string }[]>`
      SELECT unnest(enum_range(NULL::professional_profession))::text AS v`;
    expect(rows.map((r) => r.v).sort()).toEqual([
      "deportologo",
      "medico",
      "nutricionista",
      "psicologo",
    ]);
  });
});
