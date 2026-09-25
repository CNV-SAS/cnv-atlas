import { sql as dsql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ LA PANTALLA DE ADMIN POR INTEGRANTE, CONTRA LA BASE (2026-09-25) ═══
//
// POR QUE ESTE CANDADO Y NO UNO DE UNIDAD: lo unico que esta pantalla puede hacer mal es LEER MAL, y un
// mock no sabe que columnas existen. El defecto ya ocurrio dos veces en este bloque: la pantalla de ventas
// retroactivas leia `first_name` de `patients` (vive en `patient_profiles`) y devolvia 500, y el escritor
// estaba cubierto mientras que a los lectores no los llamaba nadie. Un SELECT contra una columna que no
// existe compila verde, pasa el lint y revienta en el navegador.
//
// NO COMPRUEBA CIFRAS, COMPRUEBA QUE LAS CINCO CONSULTAS CORREN. Las cifras dependen de lo que haya en la
// base de cada quien; lo que aqui no puede pasar es que una de las consultas este mal escrita.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let professionalId = "";

describe.skipIf(!HAS_DB)("leer a un integrante desde admin (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    const [prof] = await db.execute<{ id: string }>(dsql`
      select pp.id
        from professional_profiles pp
        join profiles p on p.id = pp.profile_id
       order by p.full_name
       limit 1`);
    professionalId = prof.id;
  }, 30_000);

  it("las cinco consultas corren contra el esquema real", async () => {
    const { leerIntegrante } = await import("@/modules/payments/data/integrante-reader");
    const detalle = await leerIntegrante(professionalId);

    expect(detalle).not.toBeNull();
    expect(detalle?.nombre).toBeTruthy();
    expect(detalle?.profesion).toBeTruthy();
    // Las listas pueden venir vacias (un integrante nuevo no tiene nada); lo que importa es que sean listas
    // y no una excepcion de Postgres.
    expect(Array.isArray(detalle?.inventario)).toBe(true);
    expect(Array.isArray(detalle?.ventas)).toBe(true);
    expect(Array.isArray(detalle?.faltantesAbiertos)).toBe(true);
    expect(Number.isFinite(detalle?.pacientes ?? NaN)).toBe(true);
    expect(Number.isFinite(detalle?.comision.causada ?? NaN)).toBe(true);
  }, 30_000);

  it("causada = liquidada + pendiente, que es lo que hace la cuenta creible", async () => {
    const { leerIntegrante } = await import("@/modules/payments/data/integrante-reader");
    const detalle = await leerIntegrante(professionalId);
    const { causada, liquidada, pendiente } = detalle!.comision;
    // Sale de una sola consulta a proposito; si algun dia se separan, esto lo atrapa.
    expect(Math.abs(causada - (liquidada + pendiente))).toBeLessThan(0.01);
  }, 30_000);

  it("un id que no es de nadie devuelve null, no revienta", async () => {
    const { leerIntegrante } = await import("@/modules/payments/data/integrante-reader");
    expect(await leerIntegrante("00000000-0000-0000-0000-000000000000")).toBeNull();
  }, 30_000);
});
