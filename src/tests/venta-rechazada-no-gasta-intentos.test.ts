import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

// ═══ UNA VENTA QUE NO SE PUEDE FACTURAR AQUI SE RECHAZA, Y NO GASTA INTENTOS ═══
//
// Se prueba EL SERVICIO de verdad (`emitirFacturaDeVenta`) contra la base real, con Alegra y Sentry
// simulados, porque lo que se protege es un ORDEN: las dos decisiones (ambiente y paciente) tienen que ir
// ANTES del reclamo, que es quien sube el contador. Invertido, cada pulsacion del boton le gastaria un
// intento a una venta cuyo resultado no puede cambiar, y a los cinco el panel diria "agotados".
//
// Y SE PRUEBA QUE NUNCA SE LLAMA A ALEGRA en esos casos. Es la mitad que importa manana: un pago de prueba
// que llegara a `createAlegraInvoice` en produccion seria una factura fiscal real.

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/alegra/client", () => ({
  createAlegraContact: vi.fn(),
  createAlegraInvoice: vi.fn(),
  createAlegraPayment: vi.fn(),
  findAlegraContactByDocument: vi.fn(),
  getAlegraInvoice: vi.fn(),
}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: se salta.
}
HAS_DB = Boolean(process.env.DATABASE_URL) && /sandbox/i.test(process.env.ALEGRA_BASE_URL ?? "");

const ventas: string[] = [];
const pacientes: string[] = [];

// El documento se genera del uuid y no de la hora: la primera version cortaba Date.now() a diez digitos, y
// dos pacientes creados en el mismo segundo colisionaban contra el unico (org, tipo, documento).
function documentoUnico(): string {
  return `8${BigInt("0x" + randomUUID().replace(/-/g, "").slice(0, 12)).toString().slice(0, 9)}`;
}

async function paciente(esDePrueba: boolean): Promise<string> {
  const { db } = await import("@/db");
  const id = randomUUID();
  await db.execute(dsql`
    insert into patients (id, organization_id, document_type, document_number, is_test)
    select ${id}, o.id, 'CC', ${documentoUnico()}, ${esDePrueba}
      from organizations o limit 1`);
  pacientes.push(id);
  return id;
}

async function venta(opts: { patientId: string; wompiEnv: string; alegraEnv?: string | null }): Promise<string> {
  const { db } = await import("@/db");
  const id = randomUUID();
  await db.execute(dsql`
    insert into transactions (id, organization_id, patient_id, amount, status, idempotency_key,
                              wompi_env, alegra_env, alegra_invoice_state, alegra_attempts)
    select ${id}, o.id, ${opts.patientId}, 107100, 'paid', ${`test-rechazo-${id}`},
           ${opts.wompiEnv}, ${opts.alegraEnv ?? null}, 'pendiente', 2
      from organizations o limit 1`);
  ventas.push(id);
  return id;
}

async function leer(id: string) {
  const { db } = await import("@/db");
  const [t] = await db.execute<{ alegra_invoice_state: string; alegra_attempts: number; alegra_last_error: string }>(
    dsql`select alegra_invoice_state, alegra_attempts, alegra_last_error from transactions where id = ${id}`,
  );
  return t;
}

describe.skipIf(!HAS_DB)("rechazar sin gastar intentos (BD real, Alegra simulado)", () => {
  afterAll(async () => {
    const { db } = await import("@/db");
    for (const id of ventas) await db.execute(dsql`delete from transactions where id = ${id}`);
    for (const id of pacientes) await db.execute(dsql`delete from patients where id = ${id}`);
  });

  it("un pago REAL contra sandbox: rechazada, 2 intentos siguen siendo 2, y Alegra no se toca", async () => {
    const alegra = await import("@/lib/alegra/client");
    const { emitirFacturaDeVenta } = await import("@/modules/payments/services/facturacion-service");
    const id = await venta({ patientId: await paciente(true), wompiEnv: "produccion" });

    await emitirFacturaDeVenta({ id, amount: "107100", patientId: pacientes.at(-1)!, canal: "wompi" });

    const t = await leer(id);
    expect(t.alegra_invoice_state).toBe("rechazada");
    expect(Number(t.alegra_attempts), "la decisión gastó un intento").toBe(2);
    expect(alegra.createAlegraInvoice).not.toHaveBeenCalled();
    expect(alegra.createAlegraContact).not.toHaveBeenCalled();
  });

  it("una factura de OTRO ambiente: rechazada sin releerla, que era el caso de la factura de otra persona", async () => {
    const alegra = await import("@/lib/alegra/client");
    const { emitirFacturaDeVenta } = await import("@/modules/payments/services/facturacion-service");
    const id = await venta({ patientId: await paciente(true), wompiEnv: "test", alegraEnv: "produccion" });

    await emitirFacturaDeVenta({ id, amount: "107100", patientId: pacientes.at(-1)!, canal: "wompi" });

    const t = await leer(id);
    expect(t.alegra_invoice_state).toBe("rechazada");
    expect(Number(t.alegra_attempts)).toBe(2);
    expect(alegra.getAlegraInvoice, "releyó una factura de otro ambiente").not.toHaveBeenCalled();
  });

  it("un paciente REAL contra sandbox: rechazada, sin gastar intentos y sin que su identidad salga", async () => {
    const alegra = await import("@/lib/alegra/client");
    const { emitirFacturaDeVenta } = await import("@/modules/payments/services/facturacion-service");
    const pac = await paciente(false);
    const id = await venta({ patientId: pac, wompiEnv: "test" });

    await emitirFacturaDeVenta({ id, amount: "107100", patientId: pac, canal: "wompi" });

    const t = await leer(id);
    expect(t.alegra_invoice_state).toBe("rechazada");
    expect(Number(t.alegra_attempts)).toBe(2);
    expect(alegra.findAlegraContactByDocument).not.toHaveBeenCalled();
    expect(alegra.createAlegraContact, "la identidad de un paciente real viajó al sandbox").not.toHaveBeenCalled();
  });

  it("y pulsar el botón muchas veces no la agota: sigue en 2", async () => {
    // Es lo que pidio Santiago con sus palabras: una decision no se rinde.
    const { emitirFacturaDeVenta } = await import("@/modules/payments/services/facturacion-service");
    const pac = await paciente(false);
    const id = await venta({ patientId: pac, wompiEnv: "test" });

    for (let i = 0; i < 6; i++) {
      await emitirFacturaDeVenta({ id, amount: "107100", patientId: pac, canal: "wompi" });
    }
    expect(Number((await leer(id)).alegra_attempts), "seis pulsaciones gastaron intentos").toBe(2);
  });
});
