import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CODIGO_ALEGRA,
  codigoAlegraDelPago,
  medioDianDelPago,
} from "@/modules/payments/medio-de-pago";
import { wompiEventSchema } from "@/modules/payments/validations";

// ═══ EL MEDIO DE PAGO DE LA FACTURA ═══
//
// TRES VOCABULARIOS: Wompi (CARD, PSE, NEQUI), DIAN (la tabla de contabilidad) y Alegra (un CODIGO en
// mayusculas, no el rotulo de su pantalla). Confundirlos es mandar un valor que la API no reconoce, y en
// un campo informativo eso puede rechazar la factura ENTERA por algo que no tenia efecto fiscal.

describe("de Wompi a DIAN: la tabla de contabilidad del 2026-09-13", () => {
  const wompi = (tipo: string | null, tipoTarjeta: string | null = null) =>
    medioDianDelPago({ canal: "wompi", tipo, tipoTarjeta });

  it("tarjeta de crédito y de débito, cada una a lo suyo", () => {
    expect(wompi("CARD", "CREDIT")).toBe("tarjeta_credito");
    expect(wompi("CARD", "DEBIT")).toBe("tarjeta_debito");
  });

  it("PSE, Nequi y transferencia van a transferencia débito", () => {
    expect(wompi("PSE")).toBe("transferencia_debito");
    expect(wompi("NEQUI")).toBe("transferencia_debito");
    expect(wompi("BANCOLOMBIA_TRANSFER")).toBe("transferencia_debito");
  });

  it("y el efectivo, que no pasa por Wompi, va a efectivo", () => {
    expect(medioDianDelPago({ canal: "efectivo", tipo: null, tipoTarjeta: null })).toBe("efectivo");
  });

  it("UNA TARJETA SIN TIPO NO ES CRÉDITO POR DEFECTO: es un medio que no se conoce", () => {
    // Wompi dice "CARD" para las dos. Si falta `card_type`, adivinar credito seria facturar un medio falso.
    expect(wompi("CARD", null)).toBeNull();
    expect(wompi("CARD", "OTRA_COSA")).toBeNull();
  });

  it("un instrumento nuevo de Wompi NO hereda por parecido el medio de otro", () => {
    expect(wompi("DAVIPLATA")).toBeNull();
    expect(wompi("BANCOLOMBIA_QR")).toBeNull();
    expect(wompi(null)).toBeNull();
  });
});

describe("a Alegra solo viaja un código VERIFICADO", () => {
  it("cada código de la tabla lleva su evidencia, o no está", () => {
    // La regla que hace esto seguro. Un codigo sin evidencia es una suposicion, y una suposicion en este campo
    // puede rechazar una factura que estaba bien.
    for (const [medio, entrada] of Object.entries(CODIGO_ALEGRA)) {
      if (entrada === null) continue;
      expect(entrada.codigo, `${medio}: código vacío`).toMatch(/^[A-Z_]+$/);
      expect(entrada.evidencia.length, `${medio}: código sin evidencia de dónde salió`).toBeGreaterThan(20);
    }
  });

  it("y ningún código es el RÓTULO de la pantalla, que es el error que se evitó", () => {
    // Verificado en el sandbox: la pantalla dice "Instrumento no definido" y la API guarda
    // "INSTRUMENT_NOT_DEFINED". Mandar el rotulo seria mandar algo que Alegra no reconoce.
    for (const entrada of Object.values(CODIGO_ALEGRA)) {
      if (entrada === null) continue;
      expect(entrada.codigo, "parece un rótulo de pantalla, no un código de la API").not.toMatch(/[a-záéíóú ]/);
    }
  });

  it("los dos VERIFICADOS en el sandbox viajan: efectivo y transferencia débito", () => {
    // Leidos de las facturas 701 y 702 despues de que Santiago los eligiera en la pantalla de Alegra.
    expect(codigoAlegraDelPago({ canal: "efectivo", tipo: null, tipoTarjeta: null })).toBe("CASH");
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "PSE", tipoTarjeta: null })).toBe("DEBIT_TRANSFER");
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "NEQUI", tipoTarjeta: null })).toBe("DEBIT_TRANSFER");
  });

  it("y las TARJETAS no viajan: Alegra no tiene ese medio, y a qué caen lo decide contabilidad", () => {
    // Informativo: "no definido" no tiene efecto fiscal. Por eso no se elige por nuestra cuenta.
    expect(CODIGO_ALEGRA.tarjeta_credito).toBeNull();
    expect(CODIGO_ALEGRA.tarjeta_debito).toBeNull();
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "CARD", tipoTarjeta: "CREDIT" })).toBeNull();
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "CARD", tipoTarjeta: "DEBIT" })).toBeNull();
  });

  it("y el servicio no manda el campo si no hay código", () => {
    const src = readFileSync("src/modules/payments/services/facturacion-service.ts", "utf8");
    expect(src).toContain("...(paymentMethod ? { paymentMethod } : {})");
  });
});

describe("el webhook guarda el tipo de tarjeta", () => {
  const evento = (transaction: Record<string, unknown>) => ({
    event: "transaction.updated",
    timestamp: 1,
    signature: { checksum: "x", properties: [] },
    data: {
      transaction: {
        id: "t",
        reference: "r",
        status: "APPROVED",
        amount_in_cents: 10710000,
        currency: "COP",
        ...transaction,
      },
    },
  });

  it("conserva card_type, que es lo único que separa crédito de débito", () => {
    const r = wompiEventSchema.safeParse(
      evento({ payment_method_type: "CARD", payment_method: { extra: { card_type: "DEBIT" } } }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.data.transaction.payment_method?.extra?.card_type).toBe("DEBIT");
  });

  it("y NO guarda el resto del objeto del medio de pago, que trae datos del titular", () => {
    // Se declara solo lo que se usa. Zod elimina lo demas, y aqui eso es lo que se quiere.
    const r = wompiEventSchema.safeParse(
      evento({
        payment_method_type: "CARD",
        payment_method: { extra: { card_type: "CREDIT", name: "TITULAR", last_four: "4242" } },
      }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    const extra = r.data.data.transaction.payment_method?.extra as Record<string, unknown>;
    expect(extra.name).toBeUndefined();
    expect(extra.last_four).toBeUndefined();
  });
});
