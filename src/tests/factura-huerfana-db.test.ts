import { randomUUID } from "node:crypto";

import { sql as dsql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/core/http/http-error";

// ═══ LA FACTURA HUERFANA: EMITIDA EN ALEGRA, SIN ID EN ATLAS ═══
//
// EL CASO REAL (smoke del Bloque 3, 2026-09-14): la emision tardo mas que el timeout, Alegra emitio
// SETP990214715, Atlas la dio por fallida sin id, y el pago nunca se registro. La idempotencia de entonces
// miraba "la venta ya tiene id de factura", asi que un reintento habria emitido una SEGUNDA factura.
//
// Se prueba EL SERVICIO de verdad contra la base real, con Alegra simulado. El caso central es el tercero: el
// corte deja la venta fallida, y el REINTENTO encuentra la factura por su referencia y la adopta sin emitir.

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/alegra/client", () => ({
  buscarFacturaPorReferencia: vi.fn(),
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
let pacienteId = "";
let producto: { id: string; precio: number } = { id: "", precio: 0 };

const FACTURA = {
  id: "9016",
  numero: "SETP990214715",
  estado: "open",
  stamp: { cufe: "cufe-de-prueba", legalStatus: "STAMPED_AND_ACCEPTED" },
  total: 0,
  tax: 0,
  balance: 0,
};

async function ventaPagada(): Promise<string> {
  const { db } = await import("@/db");
  const id = randomUUID();
  await db.execute(dsql`
    insert into transactions (id, organization_id, patient_id, amount, status, idempotency_key, wompi_env,
                              alegra_invoice_state, payment_method, payment_method_type, payment_card_type)
    select ${id}, o.id, ${pacienteId}, ${producto.precio}, 'paid', ${`test-huerfana-${id}`}, 'test',
           'pendiente', 'wompi', 'CARD', 'CREDIT'
      from organizations o limit 1`);
  await db.execute(dsql`
    insert into transaction_items (transaction_id, nutraceutical_id, quantity, unit_price)
    values (${id}, ${producto.id}, 1, ${producto.precio})`);
  ventas.push(id);
  return id;
}

async function leer(id: string) {
  const { db } = await import("@/db");
  const [t] = await db.execute<{
    alegra_invoice_state: string;
    alegra_invoice_id: string | null;
    alegra_payment_id: string | null;
    alegra_last_error: string | null;
  }>(dsql`select alegra_invoice_state, alegra_invoice_id, alegra_payment_id, alegra_last_error from transactions where id = ${id}`);
  return t;
}

async function emitir(id: string) {
  const { emitirFacturaDeVenta } = await import("@/modules/payments/services/facturacion-service");
  await emitirFacturaDeVenta({ id, amount: String(producto.precio), patientId: pacienteId, canal: "wompi" });
}

describe.skipIf(!HAS_DB)("la factura cuya respuesta se pierde (BD real, Alegra simulado)", () => {
  beforeAll(async () => {
    const { db } = await import("@/db");
    pacienteId = randomUUID();
    const documento = `7${BigInt("0x" + randomUUID().replace(/-/g, "").slice(0, 12)).toString().slice(0, 9)}`;
    // Paciente de PRUEBA con su contacto de Alegra del sandbox ya resuelto: lo que se prueba es la factura.
    await db.execute(dsql`
      insert into patients (id, organization_id, document_type, document_number, is_test, alegra_contact_id, alegra_env)
      select ${pacienteId}, o.id, 'CC', ${documento}, true, '3', 'sandbox' from organizations o limit 1`);
    const [p] = await db.execute<{ id: string; unit_price: string }>(dsql`
      select n.id, n.unit_price from nutraceuticals n
        join alegra_items ai on ai.nutraceutical_id = n.id and ai.env = 'sandbox'
       where not n.is_test and n.unit_price is not null
       limit 1`);
    producto = { id: p.id, precio: Number(p.unit_price) };
    FACTURA.total = producto.precio;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const alegra = await import("@/lib/alegra/client");
    vi.mocked(alegra.getAlegraInvoice).mockResolvedValue({ ...FACTURA, balance: producto.precio });
    vi.mocked(alegra.createAlegraPayment).mockResolvedValue({ id: "pago-1" });
  });

  afterAll(async () => {
    const { db } = await import("@/db");
    for (const id of ventas) await db.execute(dsql`delete from transactions where id = ${id}`);
    await db.execute(dsql`delete from patients where id = ${pacienteId}`);
  });

  it("la emision lleva la referencia de la venta", async () => {
    const alegra = await import("@/lib/alegra/client");
    vi.mocked(alegra.buscarFacturaPorReferencia).mockResolvedValue(null);
    vi.mocked(alegra.createAlegraInvoice).mockResolvedValue({ ...FACTURA });
    const id = await ventaPagada();
    await emitir(id);
    expect(alegra.createAlegraInvoice).toHaveBeenCalledWith(expect.objectContaining({ referencia: `Atlas venta ${id}` }));
    expect((await leer(id)).alegra_invoice_state).toBe("emitida");
  });

  it("si ya EXISTE en Alegra, la adopta, NO emite otra, y registra el pago", async () => {
    const alegra = await import("@/lib/alegra/client");
    vi.mocked(alegra.buscarFacturaPorReferencia).mockResolvedValue({ ...FACTURA });
    const id = await ventaPagada();
    await emitir(id);

    expect(alegra.createAlegraInvoice, "emitió una segunda factura de una venta que ya la tenía").not.toHaveBeenCalled();
    expect(alegra.createAlegraPayment).toHaveBeenCalledTimes(1);
    expect(await leer(id)).toMatchObject({ alegra_invoice_state: "emitida", alegra_invoice_id: "9016", alegra_payment_id: "pago-1" });
  });

  it("EL CASO DEL SMOKE: la emision se corta, la venta queda fallida SIN id, y el REINTENTO la adopta sin emitir", async () => {
    const { db } = await import("@/db");
    const alegra = await import("@/lib/alegra/client");
    // Primer intento: nada que adoptar antes, la emision se corta, y justo despues todavia no aparece.
    vi.mocked(alegra.buscarFacturaPorReferencia).mockResolvedValue(null);
    vi.mocked(alegra.createAlegraInvoice).mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    );
    const id = await ventaPagada();
    await emitir(id);

    const primero = await leer(id);
    expect(primero.alegra_invoice_state).toBe("fallida");
    expect(primero.alegra_invoice_id).toBeNull();
    expect(primero.alegra_last_error).toMatch(/No se supo si Alegra emitió/);
    expect(alegra.createAlegraInvoice).toHaveBeenCalledTimes(1);
    expect(alegra.buscarFacturaPorReferencia, "tras el corte no volvió a buscar").toHaveBeenCalledTimes(2);

    // Reintento, pasado el arriendo: ahora Alegra ya muestra la factura que si emitio.
    await db.execute(dsql`update transactions set alegra_last_attempt_at = now() - interval '5 minutes' where id = ${id}`);
    vi.mocked(alegra.buscarFacturaPorReferencia).mockResolvedValue({ ...FACTURA });
    await emitir(id);

    expect(alegra.createAlegraInvoice, "el reintento emitió una SEGUNDA factura del mismo pago").toHaveBeenCalledTimes(1);
    expect(await leer(id)).toMatchObject({ alegra_invoice_state: "emitida", alegra_invoice_id: "9016", alegra_payment_id: "pago-1" });
  });

  it("si tras el corte la factura YA aparece, se adopta en el mismo intento", async () => {
    const alegra = await import("@/lib/alegra/client");
    vi.mocked(alegra.buscarFacturaPorReferencia).mockResolvedValueOnce(null).mockResolvedValueOnce({ ...FACTURA });
    vi.mocked(alegra.createAlegraInvoice).mockRejectedValue(new HttpError("HTTP 504", 504, {}));
    const id = await ventaPagada();
    await emitir(id);
    expect(await leer(id)).toMatchObject({ alegra_invoice_state: "emitida", alegra_invoice_id: "9016" });
  });

  it("EL PAGO con la misma forma: se corta, Alegra SI lo registro, y el reintento NO registra otro", async () => {
    // El pago no lleva referencia propia: se encuentra por el SALDO de la factura, releida. Si ya no debe nada,
    // el pago existe. Es la regla que ya tenia el servicio; aqui queda probada con el corte.
    const { db } = await import("@/db");
    const alegra = await import("@/lib/alegra/client");
    vi.mocked(alegra.buscarFacturaPorReferencia).mockResolvedValue(null);
    vi.mocked(alegra.createAlegraInvoice).mockResolvedValue({ ...FACTURA, balance: producto.precio });
    vi.mocked(alegra.createAlegraPayment).mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    );
    const id = await ventaPagada();
    await emitir(id);
    expect(await leer(id)).toMatchObject({ alegra_invoice_id: "9016", alegra_payment_id: null });

    // Reintento: la factura releida ya no debe nada, porque Alegra si registro el pago.
    await db.execute(dsql`update transactions set alegra_last_attempt_at = now() - interval '5 minutes' where id = ${id}`);
    vi.mocked(alegra.getAlegraInvoice).mockResolvedValue({ ...FACTURA, balance: 0 });
    await emitir(id);

    expect(alegra.createAlegraPayment, "el reintento registró un SEGUNDO pago").toHaveBeenCalledTimes(1);
    expect(alegra.createAlegraInvoice).toHaveBeenCalledTimes(1);
    expect((await leer(id)).alegra_payment_id).toBe("pagada-en-alegra");
  });

  it("un RECHAZO (4xx) no busca despues: Alegra no creo nada", async () => {
    const alegra = await import("@/lib/alegra/client");
    vi.mocked(alegra.buscarFacturaPorReferencia).mockResolvedValue(null);
    vi.mocked(alegra.createAlegraInvoice).mockRejectedValue(new HttpError("HTTP 400", 400, { message: "dato invalido" }));
    const id = await ventaPagada();
    await emitir(id);
    expect(alegra.buscarFacturaPorReferencia).toHaveBeenCalledTimes(1); // solo la de antes
    expect((await leer(id)).alegra_last_error).toMatch(/HTTP 400/);
  });
});
