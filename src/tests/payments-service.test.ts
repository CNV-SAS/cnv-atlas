import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks de las dependencias del servicio. Asi se prueba la LOGICA de orquestacion
// (sellado de precios, idempotencia, mapeo de estados) sin tocar BD, Supabase, ni
// los modulos server-only (writer, repo, alegra, nutraceuticos). El alias "@" lo
// resuelve vitest.config.
vi.mock("../modules/payments/data/payments-writer", () => ({
  createTransactionWithItems: vi.fn(),
  recordWebhookEvent: vi.fn(),
  markWebhookProcessed: vi.fn(),
  sealPaidTransaction: vi.fn(),
  markTransactionFailed: vi.fn(),
  setAlegraInvoiceId: vi.fn(),
}));
vi.mock("../modules/payments/data/payments-repository", () => ({
  getProfessionalProfileIdByUser: vi.fn(),
  getProfessionalIdForPatient: vi.fn(),
}));
vi.mock("@/modules/nutraceuticals/data/nutraceuticals-repository", () => ({
  listNutraceuticals: vi.fn(),
}));
vi.mock("@/lib/alegra/client", () => ({ createAlegraInvoice: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as alegra from "@/lib/alegra/client";
import * as nutraRepo from "@/modules/nutraceuticals/data/nutraceuticals-repository";

import * as repo from "../modules/payments/data/payments-repository";
import * as writer from "../modules/payments/data/payments-writer";
import {
  CheckoutError,
  createCheckout,
  processWompiWebhook,
} from "../modules/payments/services/payments-service";

const TX_REF = "11111111-1111-1111-1111-111111111111";

// Usuario de prueba (solo los campos que usa el servicio).
function user(roles: string[]) {
  return { id: "u1", organizationId: "org-1", roles } as never;
}

// Evento de Wompi minimo ya verificado (la firma se prueba aparte).
function event(status: string) {
  return {
    event: "transaction.updated",
    timestamp: 1,
    signature: { checksum: "x", properties: [] },
    data: {
      transaction: {
        id: "wompi-1",
        reference: TX_REF,
        status,
        amount_in_cents: 100,
        currency: "COP",
      },
    },
  } as never;
}

describe("createCheckout: sella el precio en el servidor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calcula el monto desde el catalogo (no del cliente) y crea la transaccion", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "A", unit_price: "50000" },
      { id: "n2", name: "B", unit_price: "75000" },
    ] as never);
    vi.mocked(writer.createTransactionWithItems).mockResolvedValue({ id: "tx-1" });

    const res = await createCheckout(
      { patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 2 }, { nutraceuticalId: "n2", quantity: 1 }] },
      user(["professional"]),
    );

    expect(writer.createTransactionWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        patientId: "p1",
        professionalId: "prof-1",
        amount: 175000, // 2*50000 + 1*75000
        currency: "COP",
        items: [
          { nutraceuticalId: "n1", quantity: 2, unitPrice: 50000 },
          { nutraceuticalId: "n2", quantity: 1, unitPrice: 75000 },
        ],
      }),
    );
    expect(res.transactionId).toBe("tx-1");
    expect(res.checkoutUrl).toContain("/checkout/tx-1");
  });

  it("rechaza si un nutraceutico no tiene precio configurado", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "A", unit_price: null },
    ] as never);

    await expect(
      createCheckout({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["professional"])),
    ).rejects.toBeInstanceOf(CheckoutError);
    expect(writer.createTransactionWithItems).not.toHaveBeenCalled();
  });

  it("si lo crea un admin sin perfil, atribuye la comision al profesional del paciente", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue(null);
    vi.mocked(repo.getProfessionalIdForPatient).mockResolvedValue("prof-asignado");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "A", unit_price: "10000" },
    ] as never);
    vi.mocked(writer.createTransactionWithItems).mockResolvedValue({ id: "tx-2" });

    await createCheckout({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["admin"]));

    expect(writer.createTransactionWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ professionalId: "prof-asignado" }),
    );
  });
});

describe("processWompiWebhook: idempotencia y mapeo de estado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un evento ya procesado no vuelve a sellar (un solo efecto)", async () => {
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: false, alreadyProcessed: true });

    const out = await processWompiWebhook(event("APPROVED"));

    expect(out.duplicate).toBe(true);
    expect(writer.sealPaidTransaction).not.toHaveBeenCalled();
    expect(writer.markWebhookProcessed).not.toHaveBeenCalled();
  });

  it("APPROVED nuevo: sella el pago, marca procesado e intenta la factura", async () => {
    process.env.ALEGRA_DEFAULT_CLIENT_ID = "1";
    process.env.ALEGRA_DEFAULT_ITEM_ID = "1";
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: true, alreadyProcessed: false });
    vi.mocked(writer.sealPaidTransaction).mockResolvedValue({
      id: TX_REF,
      amount: "100",
      currency: "COP",
      patientId: null,
      professionalId: "prof-1",
    });
    vi.mocked(alegra.createAlegraInvoice).mockResolvedValue({ id: "inv-9" });

    const out = await processWompiWebhook(event("APPROVED"));

    expect(writer.sealPaidTransaction).toHaveBeenCalledWith(TX_REF, "wompi-1");
    expect(writer.markWebhookProcessed).toHaveBeenCalled();
    expect(alegra.createAlegraInvoice).toHaveBeenCalled();
    expect(writer.setAlegraInvoiceId).toHaveBeenCalledWith(TX_REF, "inv-9");
    expect(out.sealed).toBe(true);
  });

  it("DECLINED: marca la transaccion fallida, sin sellar ingreso", async () => {
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: true, alreadyProcessed: false });

    const out = await processWompiWebhook(event("DECLINED"));

    expect(writer.markTransactionFailed).toHaveBeenCalledWith(TX_REF, "wompi-1");
    expect(writer.sealPaidTransaction).not.toHaveBeenCalled();
    expect(out.sealed).toBe(false);
  });

  it("APPROVED ya sellado (seal devuelve null): no intenta factura", async () => {
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: true, alreadyProcessed: false });
    vi.mocked(writer.sealPaidTransaction).mockResolvedValue(null);

    const out = await processWompiWebhook(event("APPROVED"));

    expect(out.sealed).toBe(false);
    expect(alegra.createAlegraInvoice).not.toHaveBeenCalled();
  });
});
