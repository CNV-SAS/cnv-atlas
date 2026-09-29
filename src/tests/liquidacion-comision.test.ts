import { describe, expect, it } from "vitest";

import {
  liquidarComision,
  type PerfilTributario,
  RETENCION_ALTA,
  RETENCION_BASE,
  UMBRAL_UVT,
  UVT_2026,
} from "@/modules/payments/liquidacion";

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

// ═══ LOS CARGOS POR FALTANTE, COMPENSADOS EN LA LIQUIDACION (2026-09-28) ═══
//
// EL HUECO QUE ESTO CIERRA: un faltante clasificado injustificado materializaba `charge_status` y NADIE LO
// COBRABA. El cargo existia en la pantalla y no llegaba a ninguna liquidacion, asi que el Integrante nunca se
// le descontaba. La Clausula 5.5 dice que entra en la liquidacion del periodo y se cruza contra la comision.
//
// LO QUE ESTE CANDADO VIGILA ES DONDE SE RESTA, que es donde un error cuesta plata: el cargo se descuenta del
// NETO y NO de la base gravada. La comision es un servicio que se presto completo, asi que su IVA y su retencion
// van sobre el total causado; el faltante es OTRA obligacion, y el modelo dice que "las obligaciones reciprocas
// SE COMPENSAN". Bajarlo de la base seria retener y facturar de menos sobre un servicio que si se presto.
describe("los cargos por faltante en la liquidacion", () => {
  const perfilConIva: PerfilTributario = {
    tipoDePersona: "natural",
    responsableDeIva: true,
    obligadoAFacturar: true,
  };

  it("NO cambian el IVA ni la retencion: esos van sobre la comision causada", () => {
    const sin = liquidarComision({ base: 100_000, perfil: perfilConIva, acumuladoPrevio: 0 });
    const con = liquidarComision({
      base: 100_000,
      perfil: perfilConIva,
      acumuladoPrevio: 0,
      cargosDeFaltante: 30_000,
    });
    // Es la asercion que importa: el cargo no toca la base gravada.
    expect(con.base).toBe(sin.base);
    expect(con.iva).toBe(sin.iva);
    expect(con.retencion).toBe(sin.retencion);
    expect(con.tarifaDeRetencion).toBe(sin.tarifaDeRetencion);
  });

  it("se restan del neto, y la cuenta se puede seguir a mano", () => {
    const l = liquidarComision({
      base: 100_000,
      perfil: perfilConIva,
      acumuladoPrevio: 0,
      cargosDeFaltante: 30_000,
    });
    // 100.000 de comision + 19.000 de IVA − 10.000 de retencion − 30.000 de cargo = 79.000.
    expect(l.iva).toBe(19_000);
    expect(l.retencion).toBe(10_000);
    expect(l.cargosDeFaltante).toBe(30_000);
    expect(l.neto).toBe(79_000);
  });

  it("un cargo que SUPERA la comision deja el neto NEGATIVO, y eso es caso normal", () => {
    // Textual del modelo: "un faltante puede superar la comision mensual de quien vende poco. El sistema debe
    // tratar el saldo negativo como caso NORMAL, no como error." Recortarlo a cero le regalaria al Integrante la
    // diferencia y dejaria a CNV sin cobrar lo que el modelo dice que cobra.
    const l = liquidarComision({
      base: 40_000,
      perfil: perfilConIva,
      acumuladoPrevio: 0,
      cargosDeFaltante: 90_000,
    });
    expect(l.neto).toBeLessThan(0);
    // 40.000 + 7.600 − 4.000 − 90.000 = −46.400
    expect(l.neto).toBe(-46_400);
  });

  it("sin cargos la cuenta es la de antes: no cambia nada donde todavia no se leen", () => {
    const sinCampo = liquidarComision({ base: 100_000, perfil: perfilConIva, acumuladoPrevio: 0 });
    const conCero = liquidarComision({
      base: 100_000,
      perfil: perfilConIva,
      acumuladoPrevio: 0,
      cargosDeFaltante: 0,
    });
    expect(sinCampo.neto).toBe(conCero.neto);
    expect(sinCampo.cargosDeFaltante).toBe(0);
  });
});
