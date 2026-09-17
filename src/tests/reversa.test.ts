import { describe, expect, it } from "vitest";

import {
  avisoDeTercero,
  diferenciaDelDebito,
  efectosDe,
  loQuePideLaReversa,
  type Reversa,
} from "@/modules/payments/reversa";

// ═══ LA REVERSA DE UNA VENTA: LAS REGLAS DE CONTABILIDAD (Bloque 3b, sesion 1, 2026-09-16) ═══
//
// La idea central: SE SEPARA EL EFECTO DE CAJA DEL DE RESULTADO. El banco debita al abrirse la disputa, y eso es
// un hecho; pero el ingreso no se toca hasta perderla, porque la factura sigue siendo valida mientras viva.

const r = (over: Partial<Reversa> = {}): Reversa => ({
  id: "rev-1",
  transactionId: "venta-1",
  tipo: "contracargo",
  estado: "abierta",
  montoDeLaVenta: "90000",
  montoDebitado: null,
  propiedad: "propio",
  abiertaEn: "2026-09-16T15:00:00Z", // miercoles
  resueltaEn: null,
  notaCredito: null,
  ...over,
});

describe("que mueve cada estado", () => {
  it("ABIERTA no toca el ingreso: la disputa se puede ganar y la factura sigue siendo valida", () => {
    expect(efectosDe("abierta")).toEqual({ revierteElIngreso: false, pideNotaCredito: false });
  });

  it("GANADA tampoco: el ingreso nunca se movio", () => {
    expect(efectosDe("ganada")).toEqual({ revierteElIngreso: false, pideNotaCredito: false });
  });

  it("PERDIDA revierte el ingreso Y pide la nota credito, las dos cosas", () => {
    expect(efectosDe("perdida")).toEqual({ revierteElIngreso: true, pideNotaCredito: true });
  });
});

describe("el debito del banco contra el valor de la venta", () => {
  it("DEBITAR DE MAS ES LO ESPERADO, no un error: la franquicia cobra por la disputa", () => {
    const d = diferenciaDelDebito(r({ montoDebitado: "105000" }));
    expect(d.hayDiferencia).toBe(true);
    expect(d.diferencia).toBe(15000);
    expect(d.aviso).toContain("se concilia con contabilidad");
    expect(d.aviso, "la nota credito va solo por la venta: los cargos son gasto, no menor ingreso").toContain(
      "solo por el valor de la venta",
    );
    expect(d.aviso, "no es un error, es algo que conciliar").not.toContain("Error");
  });

  it("si coinciden, no dice nada", () => {
    expect(diferenciaDelDebito(r({ montoDebitado: "90000" }))).toMatchObject({ hayDiferencia: false, diferencia: 0 });
  });

  it("sin saber cuanto debitaron, tampoco inventa una diferencia", () => {
    expect(diferenciaDelDebito(r({ montoDebitado: null }))).toEqual({ hayDiferencia: false, diferencia: null, aviso: null });
  });
});

describe("hasta cuando hay, y para que", () => {
  it("ABIERTA: 3 dias habiles para responderle al banco, porque sin respuesta se pierde por silencio", () => {
    const p = loQuePideLaReversa(r());
    expect(p?.limite, "miercoles 16 + 3 habiles = lunes 21").toBe("2026-09-21");
    expect(p?.causa).toContain("responderle al banco");
  });

  it("PERDIDA sin nota credito: 5 dias habiles DESDE LA RESOLUCION, no desde la apertura", () => {
    const p = loQuePideLaReversa(r({ estado: "perdida", resueltaEn: "2026-09-21T15:00:00Z" }));
    expect(p?.limite, "lunes 21 + 5 habiles = lunes 28").toBe("2026-09-28");
    expect(p?.causa).toContain("nota crédito");
  });

  it("GANADA no pide nada, y PERDIDA con su nota credito escrita tampoco", () => {
    expect(loQuePideLaReversa(r({ estado: "ganada", resueltaEn: "2026-09-21T15:00:00Z" }))).toBeNull();
    expect(
      loQuePideLaReversa(r({ estado: "perdida", resueltaEn: "2026-09-21T15:00:00Z", notaCredito: "NC4" })),
    ).toBeNull();
  });
});

describe("el producto de tercero", () => {
  it("avisa que CNV ya le pago al proveedor, para poder reclamarselo", () => {
    expect(avisoDeTercero({ propiedad: "tercero", estado: "abierta" })).toContain("ya le pagó su parte al proveedor");
    expect(avisoDeTercero({ propiedad: "mixto", estado: "perdida" })).not.toBeNull();
  });

  it("CONTROL: con producto propio, o con la disputa ganada, no dice nada", () => {
    expect(avisoDeTercero({ propiedad: "propio", estado: "perdida" })).toBeNull();
    expect(avisoDeTercero({ propiedad: "tercero", estado: "ganada" })).toBeNull();
  });
});
