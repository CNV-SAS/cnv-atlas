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

  it("los CUATRO medios de contabilidad están verificados y viajan", () => {
    // Leidos de las facturas en borrador del sandbox despues de que Santiago los eligiera en la pantalla.
    expect(codigoAlegraDelPago({ canal: "efectivo", tipo: null, tipoTarjeta: null })).toBe("CASH");
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "PSE", tipoTarjeta: null })).toBe("DEBIT_TRANSFER");
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "NEQUI", tipoTarjeta: null })).toBe("DEBIT_TRANSFER");
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "CARD", tipoTarjeta: "CREDIT" })).toBe("CREDIT_CARD");
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "CARD", tipoTarjeta: "DEBIT" })).toBe("DEBIT_CARD");
  });

  it("el caso real del smoke: el pago con tarjeta de crédito del 13-sep sale con CREDIT_CARD", () => {
    // Ese pago guardo tipo CARD y tarjeta CREDIT, leidos de la base. Su factura salio sin medio porque en ese
    // momento el codigo de tarjeta no estaba verificado. Con el codigo, la siguiente sale con el suyo.
    // CONFIRMADO: la siguiente (LUVIA con Visa de prueba, SETP990214714) salio con "Tarjeta credito" en la
    // pantalla y CREDIT_CARD por API.
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "CARD", tipoTarjeta: "CREDIT" })).toBe("CREDIT_CARD");
  });

  it("y la tarjeta SIN tipo sigue sin viajar: no se adivina crédito", () => {
    expect(codigoAlegraDelPago({ canal: "wompi", tipo: "CARD", tipoTarjeta: null })).toBeNull();
  });

  it("el número de la DIAN va al lado del código, los cuatro confirmados por contabilidad", () => {
    // Transferencia debito estuvo sin numero hasta que contabilidad eligio entre 46 (Interbancario, el que
    // Alegra abrevia como "Transferencia debito") y 47 (Bancaria, que Alegra expone aparte). Es el 46.
    expect(CODIGO_ALEGRA.efectivo?.dian).toBe("10");
    expect(CODIGO_ALEGRA.tarjeta_credito?.dian).toBe("48");
    expect(CODIGO_ALEGRA.tarjeta_debito?.dian).toBe("49");
    expect(CODIGO_ALEGRA.transferencia_debito?.dian).toBe("46");
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

// ═══ UNA VENTA DE DISTRIBUCION NO TIENE MEDIO DE PAGO PARA LA DIAN (0211) ═══
//
// EL CANAL `cobrado_por_el_integrante` existe porque `payment_method` responde "COMO LLEGO LA PLATA A CNV", y
// bajo Distribucion NO LLEGO: el paciente le pago AL INTEGRANTE. Guardar 'efectivo' ahi afirmaria que el
// Integrante custodia dinero de CNV, que es falso y esta escrito al contrario en dos sitios del codigo.
describe("el canal de una venta de Distribucion", () => {
  const pago = { canal: "cobrado_por_el_integrante" as const, tipo: null, tipoTarjeta: null };

  // EL null ES LA RESPUESTA CORRECTA, no un "falta verificar el codigo", que es lo que un null significa en el
  // resto de este archivo: CNV NO EMITE esa factura (la 0210 la saco de las seis vias de la cola).
  it("no tiene medio DIAN, y por eso no tiene codigo de Alegra", () => {
    expect(medioDianDelPago(pago)).toBeNull();
    expect(codigoAlegraDelPago(pago)).toBeNull();
  });

  // NO HEREDA EL MEDIO DEL EFECTIVO. Es el error que el valor propio existe para impedir: si cayera en
  // 'efectivo', una venta que CNV no cobro saldria con el medio de una que si.
  it("no se confunde con el efectivo", () => {
    expect(medioDianDelPago(pago)).not.toBe("efectivo");
    expect(medioDianDelPago({ canal: "efectivo", tipo: null, tipoTarjeta: null })).toBe("efectivo");
  });

  // Y NO APUNTA PLATA A NINGUNA CUENTA PUENTE: no hay pago que registrar, porque no entro a CNV.
  it("no apunta a ninguna cuenta de Alegra", async () => {
    const { cuentaDelPago } = await import("@/modules/payments/facturacion");
    const mapa = {
      bankAccountEfectivoId: "1",
      bankAccountPasarelaId: "2",
      bankAccountTransferenciaId: "3",
    } as Parameters<typeof cuentaDelPago>[1];
    expect(cuentaDelPago("cobrado_por_el_integrante", mapa)).toBeNull();
    // Y LOS OTROS SIGUEN APUNTANDO: si el cambio se hubiera llevado los tres, esto lo dice.
    expect(cuentaDelPago("efectivo", mapa)).toBe(1);
    expect(cuentaDelPago("wompi", mapa)).toBe(2);
  });
});
