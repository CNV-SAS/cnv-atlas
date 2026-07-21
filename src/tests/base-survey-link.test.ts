import { describe, expect, it, vi } from "vitest";

import { and, eq, isNull } from "drizzle-orm";

import { generateOpaqueToken } from "@/modules/evaluations/services/survey-link-service";

// CANDADO de unicidad del link base de consultorio (ST-I1): el indice unico parcial
// survey_links_base_unique garantiza a nivel de BD un solo link base (inicial reusable) por
// profesional. Sin el, una condicion de carrera crearia dos QR distintos para el mismo
// consultorio, y eso es un problema en algo que se imprime. Corre contra la BD (bypass RLS por la
// conexion directa: se prueba la garantia de BD, no la RLS).

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el bloque contra BD se auto-salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("link base de consultorio: unicidad (BD real)", () => {
  it("el indice unico parcial rechaza un segundo link base del mismo profesional", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");

    // El seed deja un link base (inicial reusable) para el profesional demo.
    const [base] = await db
      .select({
        professionalId: schema.surveyLinks.professionalId,
        organizationId: schema.surveyLinks.organizationId,
      })
      .from(schema.surveyLinks)
      .where(and(eq(schema.surveyLinks.type, "inicial"), isNull(schema.surveyLinks.patientId)))
      .limit(1);
    expect(base, "el seed deja un link base inicial reusable").toBeDefined();

    // Un segundo link base para el mismo profesional debe violar survey_links_base_unique.
    const token = generateOpaqueToken();
    let inserted = false;
    try {
      await db.insert(schema.surveyLinks).values({
        organizationId: base.organizationId,
        professionalId: base.professionalId,
        type: "inicial",
        token,
      });
      inserted = true; // no deberia: el indice debe rechazar
    } catch {
      // esperado: violacion del indice unico parcial
    }
    // Limpieza defensiva si por un bug (indice ausente) el insert paso: no dejar basura.
    if (inserted) {
      await db.delete(schema.surveyLinks).where(eq(schema.surveyLinks.token, token));
    }
    expect(inserted, "un segundo link base debe ser rechazado por survey_links_base_unique").toBe(
      false,
    );
  });
});
