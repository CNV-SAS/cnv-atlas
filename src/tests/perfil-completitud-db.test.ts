import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

// ═══ EL GATE QUE DEJA LIQUIDAR SIGUE EXIGIENDO LAS DOS MITADES (2026-09-25) ═══
//
// ESTE ES EL RIESGO REAL DE PARTIR EL FORMULARIO DEL PERFIL EN DOS PESTAÑAS. `tax_status_completed_at` es lo
// que la liquidacion mira para saber que el integrante "dio su parte", y lo ponia el envio UNICO que traia lo
// tributario Y la cuenta. Partido, si el envio tributario la pusiera por su cuenta, un integrante quedaria
// completo SIN CUENTA BANCARIA y la liquidacion dejaria pasar un giro que no tiene a donde ir.
//
// VA CONTRA LA BASE y no contra un mock porque la marca se calcula LEYENDO LA FILA: es lo unico que puede
// saber si la otra mitad ya esta. Un mock del escritor no probaria nada de eso.

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta
}
HAS_DB = Boolean(process.env.DATABASE_URL);

let professionalId = "";
let previo: Record<string, unknown> | null = null;

const TRIBUTARIA = { personType: "natural" as const, hasRut: false, idType: "CC" as const, idNumber: "ZZ-FIXTURE-99", idDv: null };

describe.skipIf(!HAS_DB)("la marca de perfil completo (BD real)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    // SE ELIGE UN PROFESIONAL POR NOMBRE, no "el primero": varios tests toman el primero con `limit 1` sin
    // orden, y una fila nueva les cambia cual es. Ya nos paso con la liquidacion.
    const [prof] = await db.execute<{ id: string }>(dsql`
      select pp.id from professional_profiles pp join profiles p on p.id = pp.profile_id
       order by p.full_name limit 1`);
    professionalId = prof.id;
    // SE GUARDA LO QUE HABIA Y SE RESTAURA AL FINAL: este test escribe sobre una fila real de la base local.
    const [fila] = await db.execute<Record<string, unknown>>(dsql`
      select tax_person_type, tax_has_rut, tax_id_type, tax_id_number, tax_id_dv, bank_name,
             bank_account_type, bank_account_number, bank_account_holder_name, bank_account_holder_document,
             tax_status_completed_at
        from professional_profiles where id = ${professionalId}::uuid`);
    previo = fila;
  }, 30_000);

  afterAll(async () => {
    if (!HAS_DB || !previo) return;
    const { db } = await import("@/db");
    await db.execute(dsql`
      update professional_profiles set
        tax_person_type = ${previo.tax_person_type as string | null}::tax_person_type,
        tax_has_rut = ${previo.tax_has_rut as boolean | null},
        tax_id_type = ${previo.tax_id_type as string | null}::document_type,
        tax_id_number = ${previo.tax_id_number as string | null},
        tax_id_dv = ${previo.tax_id_dv as string | null},
        bank_name = ${previo.bank_name as string | null},
        bank_account_type = ${previo.bank_account_type as string | null}::bank_account_type,
        bank_account_number = ${previo.bank_account_number as string | null},
        bank_account_holder_name = ${previo.bank_account_holder_name as string | null},
        bank_account_holder_document = ${previo.bank_account_holder_document as string | null},
        tax_status_completed_at = ${(previo.tax_status_completed_at as string | null) ?? null}::timestamptz
       where id = ${professionalId}::uuid`);
  }, 30_000);

  it("lo tributario solo NO marca el perfil como completo", async () => {
    const { db } = await import("@/db");
    const { saveTaxIdentity } = await import("@/modules/professionals/data/tax-status-writer");

    // Se parte de una fila sin cuenta y sin marca, que es el caso del integrante nuevo.
    await db.execute(dsql`
      update professional_profiles
         set bank_name = null, bank_account_type = null, bank_account_number = null,
             bank_account_holder_name = null, bank_account_holder_document = null,
             tax_status_completed_at = null
       where id = ${professionalId}::uuid`);

    await saveTaxIdentity(professionalId, TRIBUTARIA, null);

    const [fila] = await db.execute<{ completado: string | null }>(dsql`
      select tax_status_completed_at::text as completado from professional_profiles
       where id = ${professionalId}::uuid`);
    expect(fila.completado).toBeNull();
  }, 30_000);

  it("y al guardar la cuenta, ahi SI queda completo", async () => {
    const { db } = await import("@/db");
    const { saveBankAccount } = await import("@/modules/professionals/data/tax-status-writer");

    await saveBankAccount(professionalId, {
      bankName: "Banco de Prueba",
      bankAccountType: "ahorros",
      bankAccountNumber: "ZZ-FIXTURE-CUENTA",
      bankAccountHolderName: "Fixture Titular",
      bankAccountHolderDocument: TRIBUTARIA.idNumber,
    });

    const [fila] = await db.execute<{ completado: string | null }>(dsql`
      select tax_status_completed_at::text as completado from professional_profiles
       where id = ${professionalId}::uuid`);
    expect(fila.completado).not.toBeNull();
  }, 30_000);

  it("el documento guardado es lo que valida al titular de la cuenta", async () => {
    // El envio bancario ya NO trae el documento tributario: lo lee de la fila. Si esta lectura se rompiera, la
    // validacion de "el titular eres tu" pasaria a comparar contra undefined y aceptaria cualquier cuenta.
    const { documentoTributarioGuardado } = await import("@/modules/professionals/data/tax-status-writer");
    expect(await documentoTributarioGuardado(professionalId)).toBe(TRIBUTARIA.idNumber);
  }, 30_000);
});
