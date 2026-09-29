import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { precioDeFacturacion } from "@/modules/payments/distribucion";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PRECIO DEL FALTANTE (2026-09-29).
//
// LA CORRECCION: el caso sellaba el PVP CON IVA y cobraba eso. El modelo dice el precio de FACTURACION (base
// sin IVA menos el descuento del Integrante), y contabilidad lo confirmo con tres razones:
//
//   1. EL IVA NO SE CAUSO. El PVP de MULTICELL trae 17.100 que son de la DIAN, y no hubo venta. Cobrarselos
//      seria cobrar un impuesto inexistente, y ademas rompe el tratamiento de INDEMNIZACION que el mismo
//      modelo fija ("no genera factura de venta, no genera IVA").
//   2. CNV NUNCA IBA A RECIBIR EL PVP por esa unidad: si se vendia, se quedaba con 72.000.
//   3. Y COBRAR EL PVP HARIA EL FALTANTE MAS RENTABLE QUE LA VENTA (107.100 perdida contra 72.000 vendida).
//      "Ese calculo lo va a hacer el primer Integrante al que se le cobre, y es indefendible."
//
// POR QUE LA ARITMETICA NO SE REESCRIBIO: el modelo llama "precio de facturacion" a la MISMA cifra en los dos
// sitios (la cuenta quincenal de Distribucion y la indemnizacion por faltante). Dos funciones que calculan lo
// mismo se separan con el tiempo; aqui hay una sola, y este candado lo sostiene.

describe("el precio del faltante", () => {
  // LAS DOS CIFRAS DE LA DECISION, tal cual las escribio contabilidad.
  it("MULTICELL: 72.000, no 107.100", () => {
    expect(precioDeFacturacion(107_100, 0.2).baseDescontada).toBe(72_000);
  });

  it("el de 166.600: 112.000", () => {
    expect(precioDeFacturacion(166_600, 0.2).baseDescontada).toBe(112_000);
  });

  it("no lleva IVA: la indemnizacion no es una venta", () => {
    const p = precioDeFacturacion(107_100, 0.2);
    // El cargo es la base descontada, NO su total con IVA.
    expect(p.baseDescontada).toBe(72_000);
    expect(p.total).toBe(85_680); // lo que SI llevaria IVA, y que aqui no se usa
  });

  // LA TASA SE SELLA, no se usa un 20% fijo: un Integrante con otra tasa paga otra cifra, y un caso viejo
  // tiene que poder explicar la suya aunque la tasa cambie despues.
  it("respeta la tasa del Integrante, sea cual sea", () => {
    expect(precioDeFacturacion(107_100, 0.25).baseDescontada).toBe(67_500);
    expect(precioDeFacturacion(107_100, 0.3).baseDescontada).toBe(63_000);
  });

  // EL DESINCENTIVO SIGUE INTACTO, que es la objecion previsible a cobrar menos: el Integrante paga 72.000,
  // no recibe nada del paciente, y ademas pierde los 18.000 que habria ganado por venderla.
  it("cobrar menos no lo vuelve barato: pierde ademas su comision", () => {
    const p = precioDeFacturacion(107_100, 0.2);
    const comisionQueHabriaGanado = p.base - p.baseDescontada;
    expect(comisionQueHabriaGanado).toBe(18_000);
    expect(p.baseDescontada + comisionQueHabriaGanado).toBe(p.base);
  });

  // Y NUNCA MAS QUE LA VENTA, que es la guarda que la base tambien tiene como CHECK.
  it("la indemnizacion nunca supera el valor de venta", () => {
    for (const pvp of [107_100, 166_600, 90_000, 30_000]) {
      expect(precioDeFacturacion(pvp, 0.2).baseDescontada).toBeLessThan(pvp);
    }
  });
});

describe("el escritor del caso", () => {
  const SRC = sinComentarios(readFileSync("src/modules/nutraceuticals/data/count-writer.ts", "utf8"));

  it("usa la aritmetica compartida y no una propia", () => {
    expect(SRC).toContain("precioDeFacturacion");
  });

  it("sella la tasa vigente A LA DETECCION, no la de hoy ni un 20% fijo", () => {
    expect(SRC).toContain("professional_commission_rates");
    expect(SRC).toContain("sealedCommissionRate");
  });

  // LO QUE COBRA LA LIQUIDACION ES `sealed_charge`. Si alguien la devolviera a `sealed_total`, volveria a
  // cobrar el PVP con IVA sin que nada fallara: es una columna que existe y tiene un numero plausible.
  it("la liquidacion cobra el cargo, no el valor de venta", () => {
    const LIQ = sinComentarios(readFileSync("src/modules/payments/data/liquidacion-writer.ts", "utf8"));
    expect(LIQ).toContain("sealed_charge");
  });
});
