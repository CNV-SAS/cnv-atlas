import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks de las dependencias del servicio. Asi se prueba la LOGICA de orquestacion
// (sellado de precios, idempotencia, mapeo de estados) sin tocar BD, Supabase, ni
// los modulos server-only (writer, repo, alegra, nutraceuticos). El alias "@" lo
// resuelve vitest.config.
// El servicio importa el de reversas (Bloque 3b), que es `server-only` y toca la base. Aqui se simula
// diciendo que la venta NO estaba pagada, que es el caso de esta suite: un rechazo normal de un link. Que un
// VOIDED sobre una venta PAGADA abra el caso se prueba contra base real en `reversa-db`.
vi.mock("server-only", () => ({}));
vi.mock("../modules/payments/services/reversas-service", () => ({
  abrirPorAnulacionDeWompi: vi.fn(async () => false),
}));
vi.mock("../modules/payments/data/payments-writer", () => ({
  createTransactionWithItems: vi.fn(),
  createPaidCashTransaction: vi.fn(),
  recordWebhookEvent: vi.fn(),
  markWebhookProcessed: vi.fn(),
  sealPaidTransaction: vi.fn(),
  markTransactionFailed: vi.fn(),
  setAlegraInvoiceId: vi.fn(),
  resolverRevision: vi.fn(),
  SoporteDeRevisionError: class SoporteDeRevisionError extends Error {},
}));
vi.mock("../modules/payments/data/payments-repository", () => ({
  getProfessionalProfileIdByUser: vi.fn(),
  getProfessionalIdForPatient: vi.fn(),
  getTratamientoParaVenta: vi.fn(),
}));
vi.mock("@/modules/nutraceuticals/data/nutraceuticals-repository", () => ({
  listNutraceuticals: vi.fn(),
}));
// La FACTURA se mockea a nivel de servicio, no de cliente HTTP: desde el Bloque 2a la emision es un
// servicio propio (contacto, lineas, emision, pago), y este test es del WEBHOOK. Lo que aqui importa es
// que el pago se selle y que la factura SE INTENTE; que la factura salga bien lo prueban sus propios
// candados.
vi.mock("../modules/payments/services/facturacion-service", () => ({ emitirFacturaDeVenta: vi.fn() }));
vi.mock("../modules/payments/data/facturacion-repository", () => ({ marcarFacturaPendiente: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
// EL INVENTARIO DE LA VENTA (Bloque 3) tiene sus candados contra base real (venta-inventario.test.ts). Aqui
// solo importa la ORQUESTACION: que el webhook y el efectivo lo llamen, y que un checkout sin existencias se
// traduzca al error del formulario.
vi.mock("../modules/payments/data/inventario-de-venta", () => ({
  InventarioDeVentaError: class InventarioDeVentaError extends Error {},
  liberarReservasDeVenta: vi.fn(),
}));
vi.mock("../modules/payments/services/inventario-venta-service", () => ({ descontarInventarioDeVenta: vi.fn() }));
vi.mock("@/modules/avisos/services/avisos-service", () => ({ avisarAlIntegranteDeRevision: vi.fn() }));

import * as nutraRepo from "@/modules/nutraceuticals/data/nutraceuticals-repository";

import * as repo from "../modules/payments/data/payments-repository";
import * as writer from "../modules/payments/data/payments-writer";
import * as inventario from "../modules/payments/data/inventario-de-venta";
import * as facturacion from "../modules/payments/services/facturacion-service";
import * as descuento from "../modules/payments/services/inventario-venta-service";
import {
  CheckoutError,
  createCheckout,
  buildWompiCheckoutParams,
  processWompiWebhook,
  registerCashSale,
  resolverRevisionDeVenta,
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
      { id: "n1", name: "A", unit_price: "50000", commercial_availability: "en_consultorio" },
      { id: "n2", name: "B", unit_price: "75000", commercial_availability: "en_consultorio" },
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
      { id: "n1", name: "A", unit_price: "10000", commercial_availability: "en_consultorio" },
    ] as never);
    vi.mocked(writer.createTransactionWithItems).mockResolvedValue({ id: "tx-2" });

    await createCheckout({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["admin"]));

    expect(writer.createTransactionWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ professionalId: "prof-asignado" }),
    );
  });
});

describe("registerCashSale: misma resolucion de venta, transaccion ya pagada", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sella el precio del catalogo y crea la transaccion en efectivo con la clave del cliente", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "A", unit_price: "50000", commercial_availability: "en_consultorio" },
    ] as never);
    vi.mocked(writer.createPaidCashTransaction).mockResolvedValue({ id: "cash-1", linksAnulados: [] });

    const res = await registerCashSale(
      { patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 2 }] },
      user(["professional"]),
      "idem-123",
    );

    // Reusa la resolucion de venta: precio del catalogo (no del cliente), profesional para la comision,
    // y la clave de idempotencia que TRAE el cliente (anti doble-cobro).
    expect(writer.createPaidCashTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        patientId: "p1",
        professionalId: "prof-1",
        amount: 100000, // 2 * 50000, del catalogo
        currency: "COP",
        idempotencyKey: "idem-123",
        items: [{ nutraceuticalId: "n1", quantity: 2, unitPrice: 50000 }],
      }),
    );
    expect(res).toEqual({ transactionId: "cash-1", amount: 100000, linksAnulados: 0 });
    // El checkout de Wompi NO se toca: es otro camino.
    expect(writer.createTransactionWithItems).not.toHaveBeenCalled();
  });

  it("rechaza si un nutraceutico no tiene precio; no crea nada", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "A", unit_price: null },
    ] as never);

    await expect(
      registerCashSale({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["professional"]), "idem-1"),
    ).rejects.toBeInstanceOf(CheckoutError);
    expect(writer.createPaidCashTransaction).not.toHaveBeenCalled();
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
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: true, alreadyProcessed: false });
    vi.mocked(writer.sealPaidTransaction).mockResolvedValue({
      id: TX_REF,
      amount: "100",
      currency: "COP",
      patientId: null,
      professionalId: "prof-1",
      enRevision: false,
    });
    const out = await processWompiWebhook(event("APPROVED"));

    // El tercer argumento es el instrumento de pago. El evento de este test no lo trae, y eso NO puede
    // impedir sellar: llega como null y el pago se sella igual.
    // Los dos ultimos son el instrumento y el tipo de tarjeta. El evento de este test no los trae, y eso NO
    // puede impedir sellar: llegan como null y el pago se sella igual.
    // Y el quinto, el AMBIENTE del evento (Bloque 3): este evento tampoco lo trae, y llega como null.
    expect(writer.sealPaidTransaction).toHaveBeenCalledWith(TX_REF, "wompi-1", null, null, null);
    // EL INVENTARIO SE DESCUENTA ANTES DE PEDIR LA FACTURA, y despues de sellar el pago.
    expect(descuento.descontarInventarioDeVenta).toHaveBeenCalledWith(TX_REF);
    expect(vi.mocked(descuento.descontarInventarioDeVenta).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(writer.sealPaidTransaction).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(descuento.descontarInventarioDeVenta).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(facturacion.emitirFacturaDeVenta).mock.invocationCallOrder[0],
    );
    expect(writer.markWebhookProcessed).toHaveBeenCalled();
    // Se intenta la factura, y con el CANAL correcto: es lo que elige la cuenta puente del pago.
    expect(facturacion.emitirFacturaDeVenta).toHaveBeenCalledWith(
      expect.objectContaining({ id: TX_REF, canal: "wompi" }),
    );
    expect(out.sealed).toBe(true);
  });

  it("DECLINED: marca la transaccion fallida, sin sellar ingreso", async () => {
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: true, alreadyProcessed: false });

    const out = await processWompiWebhook(event("DECLINED"));

    expect(writer.markTransactionFailed).toHaveBeenCalledWith(TX_REF, "wompi-1");
    // Y suelta sus reservas, DESPUES de marcarla fallida (la liberacion solo actua sobre una venta failed).
    expect(inventario.liberarReservasDeVenta).toHaveBeenCalledWith(TX_REF);
    expect(vi.mocked(inventario.liberarReservasDeVenta).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(writer.markTransactionFailed).mock.invocationCallOrder[0],
    );
    expect(writer.sealPaidTransaction).not.toHaveBeenCalled();
    expect(descuento.descontarInventarioDeVenta).not.toHaveBeenCalled();
    expect(out.sealed).toBe(false);
  });

  it("APPROVED ya sellado (seal devuelve null): no intenta factura", async () => {
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: true, alreadyProcessed: false });
    vi.mocked(writer.sealPaidTransaction).mockResolvedValue(null);

    const out = await processWompiWebhook(event("APPROVED"));

    expect(out.sealed).toBe(false);
    expect(facturacion.emitirFacturaDeVenta).not.toHaveBeenCalled();
    expect(descuento.descontarInventarioDeVenta).not.toHaveBeenCalled();
  });

  it("APPROVED sobre un LINK ANULADO: queda sellado y en revision, SIN descuento ni factura, y avisa", async () => {
    // Casi seguro un cobro doble (el link se anulo al cobrar en efectivo). Una factura validada solo se
    // deshace con nota credito, que no existe hasta el 3b (Santiago, 2026-09-14).
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: true, alreadyProcessed: false });
    vi.mocked(writer.sealPaidTransaction).mockResolvedValue({
      id: TX_REF,
      amount: "100",
      currency: "COP",
      patientId: null,
      professionalId: "prof-1",
      enRevision: true,
    });
    const Sentry = await import("@sentry/nextjs");
    const out = await processWompiWebhook(event("APPROVED"));
    expect(out.sealed).toBe(true);
    expect(descuento.descontarInventarioDeVenta).not.toHaveBeenCalled();
    expect(facturacion.emitirFacturaDeVenta).not.toHaveBeenCalled();
    const avisos = await import("@/modules/avisos/services/avisos-service");
    expect(avisos.avisarAlIntegranteDeRevision, "el Integrante se entera en el momento").toHaveBeenCalledWith(TX_REF);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Pago aprobado sobre un link de pago anulado",
      expect.objectContaining({ tags: expect.objectContaining({ area: "pago-sobre-link-anulado" }) }),
    );
  });

  it("el AMBIENTE del evento llega al sellado", async () => {
    vi.mocked(writer.recordWebhookEvent).mockResolvedValue({ isNew: true, alreadyProcessed: false });
    vi.mocked(writer.sealPaidTransaction).mockResolvedValue(null);
    await processWompiWebhook({ ...(event("APPROVED") as object), environment: "prod" } as never);
    expect(writer.sealPaidTransaction).toHaveBeenCalledWith(TX_REF, "wompi-1", null, null, "prod");
  });
});

describe("el inventario en la venta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un checkout SIN EXISTENCIAS se rechaza con el mensaje del inventario, como error del formulario", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "A", unit_price: "50000", commercial_availability: "en_consultorio" },
    ] as never);
    vi.mocked(writer.createTransactionWithItems).mockRejectedValue(
      new inventario.InventarioDeVentaError("Solo hay 1 unidad de \"A\" disponible, y la venta pide 2."),
    );
    const promesa = createCheckout(
      { patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 2 }] },
      user(["professional"]),
    );
    await expect(promesa).rejects.toBeInstanceOf(CheckoutError);
    await expect(promesa).rejects.toThrow(/Solo hay 1 unidad/);
  });

  it("la venta en EFECTIVO descuenta el inventario despues de crearse y antes de la factura", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "A", unit_price: "50000", commercial_availability: "en_consultorio" },
    ] as never);
    vi.mocked(writer.createPaidCashTransaction).mockResolvedValue({ id: "cash-9", linksAnulados: [] });
    await registerCashSale({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["professional"]), "idem-9");

    expect(descuento.descontarInventarioDeVenta).toHaveBeenCalledWith("cash-9");
    expect(vi.mocked(descuento.descontarInventarioDeVenta).mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(writer.createPaidCashTransaction).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(descuento.descontarInventarioDeVenta).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(facturacion.emitirFacturaDeVenta).mock.invocationCallOrder[0],
    );
  });
});

// ═══ LA DISPONIBILIDAD GATEA LA VENTA, NO SOLO LA ENTREGA (2026-09-11) ═══
//
// EL HUECO QUE ESTO CIERRA: `recordDespacho` ya bloqueaba todo lo que no fuera `en_consultorio`, pero el
// checkout solo miraba si el producto tenia precio. Asi que un producto marcado `no_disponible` no se
// podia ENTREGAR y si se podia VENDER. La bandera gateaba media puerta.
//
// POR QUE IMPORTA AHORA Y NO ANTES: LUVIA entra al catalogo como producto de tercero y NO puede venderse
// hasta que Direccion Cientifica firme las equivalencias de alergenos. `no_disponible` es exactamente lo
// que tiene que impedirlo.
//
// Y VA EN EL SERVICIO, no en la pantalla: /pagos ya filtra el catalogo, pero un filtro de formulario es
// una comodidad y no una garantia, porque la accion recibe ids y se puede invocar con cualquiera.
describe("un producto no disponible no se puede vender", () => {
  it("`no_disponible` se rechaza aunque tenga precio", async () => {
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "LUVIA", unit_price: "90000", commercial_availability: "no_disponible" },
    ] as never);
    await expect(
      createCheckout({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["professional"])),
    ).rejects.toThrow(/no está disponible/);
  });

  it("y `solo_tienda` también, con su propia razón", async () => {
    // No es el mismo caso: ese producto SI se vende, pero en la tienda. Cobrarlo aqui seria cobrarle dos
    // veces al paciente por lo mismo, asi que el mensaje tiene que decir otra cosa.
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "A", unit_price: "50000", commercial_availability: "solo_tienda" },
    ] as never);
    await expect(
      createCheckout({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["professional"])),
    ).rejects.toThrow(/en la tienda/);
  });
});

describe("la pagina de Wompi vence con el link (expiration-time firmado)", () => {
  it("manda el vencimiento del link y lo mete en la firma", async () => {
    const { computeIntegritySignature } = await import("@/lib/wompi/signatures");
    vi.stubEnv("NEXT_PUBLIC_WOMPI_PUBLIC_KEY", "pub_test_x");
    vi.stubEnv("WOMPI_INTEGRITY_SECRET", "test_integrity_x");
    const vence = "2026-09-15T13:32:18.000Z";
    const p = buildWompiCheckoutParams({ id: TX_REF, amount: "107100", currency: "COP", expiresAt: vence });
    expect(p.expirationTime).toBe(vence);
    expect(p.signature).toBe(
      computeIntegritySignature({
        reference: TX_REF,
        amountInCents: 10710000,
        currency: "COP",
        expirationTime: vence,
        integritySecret: "test_integrity_x",
      }),
    );
    // CONTROL: no es la firma sin vencimiento, que Wompi rechazaria al venir el campo.
    expect(p.signature).not.toBe(
      computeIntegritySignature({ reference: TX_REF, amountInCents: 10710000, currency: "COP", integritySecret: "test_integrity_x" }),
    );
    vi.unstubAllEnvs();
  });
});

describe("el minimo de Wompi ($1.500)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("un checkout por menos de $1.500 se rechaza ANTES de crear la venta, con el mensaje para el profesional", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "PRUEBA", unit_price: "1190", commercial_availability: "en_consultorio" },
    ] as never);
    await expect(
      createCheckout({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["professional"])),
    ).rejects.toThrow(/menos de \$1\.500. Cóbralo en efectivo/);
    expect(writer.createTransactionWithItems).not.toHaveBeenCalled();
  });

  it("CONTROL: 1.500 exactos pasa, y la venta en efectivo no tiene minimo", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "PRUEBA", unit_price: "1500", commercial_availability: "en_consultorio" },
      { id: "n2", name: "BARATO", unit_price: "1190", commercial_availability: "en_consultorio" },
    ] as never);
    vi.mocked(writer.createTransactionWithItems).mockResolvedValue({ id: "tx-min" });
    vi.mocked(writer.createPaidCashTransaction).mockResolvedValue({ id: "cash-min", linksAnulados: [] });
    await createCheckout({ patientId: "p1", items: [{ nutraceuticalId: "n1", quantity: 1 }] }, user(["professional"]));
    expect(writer.createTransactionWithItems).toHaveBeenCalled();
    await registerCashSale({ patientId: "p1", items: [{ nutraceuticalId: "n2", quantity: 1 }] }, user(["professional"]), "idem-min");
    expect(writer.createPaidCashTransaction).toHaveBeenCalled();
  });
});

describe("la venta que nace en TRATAMIENTO (Bloque 3, sesion 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-1");
    vi.mocked(nutraRepo.listNutraceuticals).mockResolvedValue([
      { id: "n1", name: "MULTI-CELL BASE", unit_price: "107100", commercial_availability: "en_consultorio" },
      { id: "n2", name: "OMEGA", unit_price: "90000", commercial_availability: "en_consultorio" },
    ] as never);
    vi.mocked(writer.createTransactionWithItems).mockResolvedValue({ id: "tx-t" });
    vi.mocked(repo.getTratamientoParaVenta).mockResolvedValue({
      patientId: "p1",
      professionalId: "prof-1",
      decision: "si",
      prescritos: ["n1"],
    });
  });
  const venta = (extra: Partial<{ patientId: string; items: { nutraceuticalId: string; quantity: number }[] }> = {}) =>
    createCheckout(
      { patientId: "p1", treatmentId: "t1", items: [{ nutraceuticalId: "n1", quantity: 1 }], ...extra },
      user(["professional"]),
    );

  it("lo prescrito, del paciente del tratamiento y con el si: crea la venta CON el tratamiento", async () => {
    await venta();
    expect(writer.createTransactionWithItems).toHaveBeenCalledWith(expect.objectContaining({ treatmentId: "t1" }));
  });

  it("un producto NO prescrito no se cuela en la venta de la consulta", async () => {
    await expect(venta({ items: [{ nutraceuticalId: "n2", quantity: 1 }] })).rejects.toThrow(/prescritos/);
    expect(writer.createTransactionWithItems).not.toHaveBeenCalled();
  });

  it("el tratamiento de OTRO paciente se rechaza", async () => {
    await expect(venta({ patientId: "p2" })).rejects.toThrow(/Tratamiento no encontrado/);
  });

  it("sin el si del paciente no se vende", async () => {
    vi.mocked(repo.getTratamientoParaVenta).mockResolvedValue({
      patientId: "p1",
      professionalId: "prof-1",
      decision: "pendiente",
      prescritos: ["n1"],
    });
    await expect(venta()).rejects.toThrow(/adquiere/);
  });

  it("otro profesional no vende en la evaluacion ajena", async () => {
    vi.mocked(repo.getProfessionalProfileIdByUser).mockResolvedValue("prof-2");
    await expect(venta()).rejects.toThrow(/No estás asignado/);
  });

  it("CONTROL: sin tratamiento (/pagos) no se consulta ninguno", async () => {
    await createCheckout({ patientId: "p1", items: [{ nutraceuticalId: "n2", quantity: 1 }] }, user(["professional"]));
    expect(repo.getTratamientoParaVenta).not.toHaveBeenCalled();
    expect(writer.createTransactionWithItems).toHaveBeenCalledWith(expect.objectContaining({ treatmentId: null }));
  });
});

describe("resolver como EFECTIVO NO RECIBIDO (0142)", () => {
  beforeEach(() => vi.clearAllMocks());
  const venta = (casos: number) => ({
    id: TX_REF,
    amount: "11900",
    currency: "COP",
    patientId: "p1",
    professionalId: "prof-1",
    enRevision: false,
    efectivoNoRecibido: { ventaEnEfectivoId: "cash-1", professionalId: "prof-1", casosEn90Dias: casos },
  });

  it("factura el pago de Wompi SIN descontar, y alerta en nivel error", async () => {
    const Sentry = await import("@sentry/nextjs");
    vi.mocked(writer.resolverRevision).mockResolvedValue(venta(1));
    await resolverRevisionDeVenta(TX_REF, "efectivo_no_recibido", user(["admin"]));
    expect(facturacion.emitirFacturaDeVenta).toHaveBeenCalledWith(expect.objectContaining({ id: TX_REF, canal: "wompi" }));
    expect(descuento.descontarInventarioDeVenta).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Efectivo registrado que no se recibió",
      expect.objectContaining({ level: "error", tags: expect.objectContaining({ area: "efectivo-no-recibido" }) }),
    );
  });

  it("desde el segundo caso en 90 dias, la alerta dice que SE REPITE", async () => {
    const Sentry = await import("@sentry/nextjs");
    vi.mocked(writer.resolverRevision).mockResolvedValue(venta(2));
    await resolverRevisionDeVenta(TX_REF, "efectivo_no_recibido", user(["direccion"]));
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0][0]).toContain("SE REPITE (2 casos en 90 días");
  });
});
