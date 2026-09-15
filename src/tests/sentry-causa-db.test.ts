import { sql } from "drizzle-orm";
import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it, vi } from "vitest";

import { cadenaDeCausas } from "@/lib/sentry/causa";
import { scrubPhiFromEvent } from "@/lib/sentry/scrub";

// ═══ UN FALLO DE LA BASE LLEGA A SENTRY CON SU CAUSA, Y SIN LOS DATOS (2026-09-15) ═══
//
// Smoke del Bloque A: Sentry mostro "Failed query: ... params: 2026-09-15,pm" y nada mas. Con un error REAL de
// Drizzle y postgres.js (no uno armado a mano, que es donde se equivoca la forma), se prueba que la cadena trae el
// SQLSTATE, y que ni la cadena ni el texto de la excepcion llevan el valor que se consulto.

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL);

const DOCUMENTO = "CC99887766";

describe.skipIf(!HAS_DB)("la causa de un fallo de consulta (BD real)", () => {
  it("trae el envoltorio de Drizzle y el SQLSTATE de Postgres, sin el valor consultado", async () => {
    const { db } = await import("@/db");
    const error = await db.execute(sql`select ${DOCUMENTO}::uuid`).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error, "la consulta tenia que fallar").toBeInstanceOf(Error);
    expect((error as Error).message, "CONTROL: el mensaje de Drizzle SI trae el parametro").toContain(DOCUMENTO);

    const cadena = cadenaDeCausas(error);
    expect(cadena[0].tipo).toBe("DrizzleQueryError");
    expect(cadena[0].parametros, "sin la forma, el error tapa su causa; con el valor, viaja PHI").toEqual([
      `texto(${DOCUMENTO.length})`,
    ]);
    expect(cadena[1]).toMatchObject({ tipo: "PostgresError", codigo: "22P02" });
    expect(JSON.stringify(cadena)).not.toContain(DOCUMENTO);

    const causa = (error as { cause: Error }).cause;
    expect(causa.message, "CONTROL: el mensaje de Postgres SI trae el valor").toContain(DOCUMENTO);
    const evento = scrubPhiFromEvent({
      exception: { values: [{ type: "Error", value: (error as Error).message }, { type: "PostgresError", value: causa.message }] },
    } as unknown as ErrorEvent);
    const textos = evento.exception!.values!.map((v) => v.value).join("\n");
    expect(textos).toContain("Failed query:");
    expect(textos).toContain("invalid input syntax for type uuid");
    expect(textos, "el documento viajo a Sentry").not.toContain(DOCUMENTO);
  });
});
