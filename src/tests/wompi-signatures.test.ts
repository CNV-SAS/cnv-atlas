import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  computeIntegritySignature,
  verifyEventSignature,
  type WompiEvent,
} from "../lib/wompi/signatures";

describe("Wompi: firma de integridad del checkout", () => {
  it("hashea reference + amountInCents + currency + secret en ese orden (SHA256 hex)", () => {
    const params = {
      reference: "REF-123",
      amountInCents: 5_000_000,
      currency: "COP",
      integritySecret: "test_integrity_secret",
    };
    const expected = createHash("sha256")
      .update("REF-1235000000COPtest_integrity_secret")
      .digest("hex");
    expect(computeIntegritySignature(params)).toBe(expected);
  });

  it("cambia si cambia cualquier campo", () => {
    const base = { reference: "A", amountInCents: 100, currency: "COP", integritySecret: "s" };
    const sig = computeIntegritySignature(base);
    expect(computeIntegritySignature({ ...base, amountInCents: 101 })).not.toBe(sig);
    expect(computeIntegritySignature({ ...base, currency: "USD" })).not.toBe(sig);
    expect(computeIntegritySignature({ ...base, reference: "B" })).not.toBe(sig);
  });

  it("CON VENCIMIENTO: el ejemplo de la documentacion de Wompi, la fecha entre la moneda y el secreto", () => {
    // Cadena literal de docs.wompi.co (Web Checkout, "firma de integridad" con fecha de expiracion). El hash se
    // calcula aqui sobre ESA cadena, asi que el test prueba el orden y no una copia de la implementacion.
    const documentada =
      "sk8-438k4-xmxm392-sn2m2490000COP2023-06-09T20:28:50.000Zprod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6";
    const esperado = createHash("sha256").update(documentada, "utf8").digest("hex");
    expect(
      computeIntegritySignature({
        reference: "sk8-438k4-xmxm392-sn2m",
        amountInCents: 2490000,
        currency: "COP",
        expirationTime: "2023-06-09T20:28:50.000Z",
        integritySecret: "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6",
      }),
    ).toBe(esperado);
  });

  it("el vencimiento cambia la firma: no se puede alargar desde el navegador", () => {
    const base = { reference: "A", amountInCents: 100, currency: "COP", integritySecret: "s" };
    const con = computeIntegritySignature({ ...base, expirationTime: "2026-09-15T13:00:00.000Z" });
    expect(con).not.toBe(computeIntegritySignature(base));
    expect(computeIntegritySignature({ ...base, expirationTime: "2026-09-16T13:00:00.000Z" })).not.toBe(con);
  });
});

describe("Wompi: verificacion de la firma de eventos (HMAC)", () => {
  // Vector con los datos del ejemplo oficial de Wompi (docs.wompi.co/docs/colombia/
  // eventos). El checksum es el SHA256 real de la concatenacion documentada
  // (valores de properties + timestamp + secret), verificado por computacion directa.
  const event: WompiEvent = {
    timestamp: 1530291411,
    signature: {
      checksum: "5a18ec5e8fdb7df463e9f94774cba8f583ba21bd04a09ceff2ea68a4bc0aefbe",
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
    },
    data: {
      transaction: {
        id: "1234-1610641025-49201",
        status: "APPROVED",
        amount_in_cents: 4490000,
      },
    },
  };
  const secret = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";

  it("acepta el vector conocido oficial", () => {
    expect(verifyEventSignature(event, secret)).toBe(true);
  });

  it("acepta el checksum en mayusculas (comparacion case-insensitive)", () => {
    const upper: WompiEvent = {
      ...event,
      signature: { ...event.signature, checksum: event.signature.checksum.toUpperCase() },
    };
    expect(verifyEventSignature(upper, secret)).toBe(true);
  });

  it("rechaza con el secret equivocado", () => {
    expect(verifyEventSignature(event, "secret_equivocado")).toBe(false);
  });

  it("rechaza si el payload fue manipulado (otro monto)", () => {
    const tampered: WompiEvent = {
      ...event,
      data: {
        transaction: { id: "1234-1610641025-49201", status: "APPROVED", amount_in_cents: 9990000 },
      },
    };
    expect(verifyEventSignature(tampered, secret)).toBe(false);
  });

  it("rechaza un evento sin firma valida", () => {
    const noSig = {
      timestamp: 1,
      data: {},
      signature: { checksum: "", properties: [] },
    } as unknown as WompiEvent;
    expect(verifyEventSignature(noSig, secret)).toBe(false);
  });
});
