import { describe, expect, it } from "vitest";

import { liquidarComision, RETENCION_ALTA, RETENCION_BASE, UMBRAL_UVT, UVT_2026 } from "@/modules/payments/liquidacion";

// ═══ LA CUENTA QUE DECIDE CUANTO SE LE GIRA A UNA PERSONA (Bloque 4) ═══
//
// Las cifras salen del modelo comercial §3, no de nosotros. Este candado las ancla: si alguien cambia una
// tarifa o el umbral, se entera aqui y no en un giro.

const UMBRAL = UVT_2026 * UMBRAL_UVT; // 172.834.200 con la UVT de 2026

const natural = { tipoDePersona: "natural" as const, responsableDeIva: true, obligadoAFacturar: true };

describe("la liquidación de la comisión", () => {
  it("EL EJEMPLO DEL MODELO, peso por peso", () => {
    // Modelo §3: comision 20.000, IVA 3.800, retencion 2.000, neto 21.800.
    const r = liquidarComision({ base: 20_000, perfil: natural, acumuladoPrevio: 0 });
    expect(r.iva).toBe(3_800);
    expect(r.retencion).toBe(2_000);
    expect(r.neto).toBe(21_800);
    expect(r.tarifaDeRetencion).toBe(RETENCION_BASE);
  });

  it("LA RETENCION VA SOBRE LA COMISION, NUNCA SOBRE EL IVA", () => {
    // Es el error clasico de esta cuenta: retener sobre 23.800 daria 2.380 y se giraria de menos.
    const r = liquidarComision({ base: 20_000, perfil: natural, acumuladoPrevio: 0 });
    expect(r.retencion).not.toBe(2_380);
    expect(r.retencion).toBe(20_000 * RETENCION_BASE);
  });

  it("sin IVA si no es responsable, y la retención no cambia", () => {
    const r = liquidarComision({
      base: 20_000,
      perfil: { ...natural, responsableDeIva: false },
      acumuladoPrevio: 0,
    });
    expect(r.iva).toBe(0);
    expect(r.retencion).toBe(2_000);
    expect(r.neto).toBe(18_000);
  });

  it("una persona jurídica retiene al 11 % sin importar el acumulado", () => {
    const r = liquidarComision({
      base: 20_000,
      perfil: { ...natural, tipoDePersona: "juridica" },
      acumuladoPrevio: 0,
    });
    expect(r.tarifaDeRetencion).toBe(RETENCION_ALTA);
    expect(r.retencion).toBe(2_200);
    expect(r.cruzaElUmbral, "una jurídica no cruza umbral: siempre estuvo al 11 %").toBe(false);
  });

  it("EL CAMBIO DE TARIFA APLICA DESDE EL PAGO QUE CRUZA EL UMBRAL, no desde el siguiente", () => {
    // Justo por debajo: 10 %.
    const antes = liquidarComision({ base: 1_000_000, perfil: natural, acumuladoPrevio: UMBRAL - 2_000_000 });
    expect(antes.tarifaDeRetencion).toBe(RETENCION_BASE);
    expect(antes.cruzaElUmbral).toBe(false);

    // El pago que lo cruza: ya va al 11 %, ese mismo.
    const cruza = liquidarComision({ base: 1_000_000, perfil: natural, acumuladoPrevio: UMBRAL - 500_000 });
    expect(cruza.tarifaDeRetencion).toBe(RETENCION_ALTA);
    expect(cruza.cruzaElUmbral).toBe(true);

    // Y el siguiente sigue al 11 %, pero ya no "cruza".
    const despues = liquidarComision({ base: 1_000_000, perfil: natural, acumuladoPrevio: UMBRAL + 1_000_000 });
    expect(despues.tarifaDeRetencion).toBe(RETENCION_ALTA);
    expect(despues.cruzaElUmbral).toBe(false);
  });

  it("el acumulado que devuelve es el del año DESPUÉS de este pago", () => {
    const r = liquidarComision({ base: 500_000, perfil: natural, acumuladoPrevio: 3_000_000 });
    expect(r.acumuladoDelAno).toBe(3_500_000);
  });

  it("UNA BASE NEGATIVA no se retiene ni genera IVA: es una deuda que arrastra", () => {
    // Pasa cuando las reversiones del periodo superan lo causado (D-3b-2: lo ya liquidado se descuenta en la
    // liquidacion siguiente). Retener sobre un negativo seria devolverle retencion a nadie.
    const r = liquidarComision({ base: -50_000, perfil: natural, acumuladoPrevio: 1_000_000 });
    expect(r.iva).toBe(0);
    expect(r.retencion).toBe(0);
    expect(r.neto).toBe(-50_000);
  });

  it("sin los datos tributarios NO se liquida, y dice cuáles faltan", () => {
    // Asumir aqui es girar de menos o de mas, y las dos se arreglan con plata de por medio.
    const r = liquidarComision({
      base: 20_000,
      perfil: { tipoDePersona: null, responsableDeIva: null, obligadoAFacturar: null },
      acumuladoPrevio: 0,
    });
    expect(r.faltantes).toHaveLength(3);
    expect(r.faltantes.join(" ")).toContain("persona natural o jurídica");
  });

  it("el documento del pago lo decide el perfil", () => {
    expect(liquidarComision({ base: 1, perfil: natural, acumuladoPrevio: 0 }).documento).toBe(
      "factura_del_integrante",
    );
    expect(
      liquidarComision({ base: 1, perfil: { ...natural, obligadoAFacturar: false }, acumuladoPrevio: 0 })
        .documento,
    ).toBe("documento_soporte");
  });
});
