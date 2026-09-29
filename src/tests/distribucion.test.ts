import { describe, expect, it } from "vitest";

import { UVT_2026 } from "@/modules/payments/liquidacion";
import {
  DESCUENTO_DISTRIBUCION,
  armarCuentaQuincenal,
  corteDe,
  fleteFacturado,
  plazosDelCorte,
  precioDeFacturacion,
  precioDeFacturacionSellado,
  puedeDespacharse,
} from "@/modules/payments/distribucion";

// CANDADO DEL RECAUDO DE DISTRIBUCION (2026-09-29). Cada caso cita la frase del modelo comercial que lo fija,
// porque ninguna de estas cifras es nuestra.

describe("el precio de facturacion", () => {
  // EL EJEMPLO ES DEL MODELO, §4, textual: "producto de base 100.000 y PVP 119.000: base descontada 80.000,
  // IVA 15.200, total 95.200 por unidad".
  it("reproduce el ejemplo del modelo", () => {
    expect(precioDeFacturacion(119_000)).toEqual({
      base: 100_000,
      baseDescontada: 80_000,
      iva: 15_200,
      total: 95_200,
    });
  });

  // La comprobacion rapida que el propio modelo da: equivale a multiplicar el PVP con IVA por 0,80.
  it("equivale a multiplicar el PVP por 0,80", () => {
    for (const pvp of [107_100, 166_600, 90_000, 119_000]) {
      expect(precioDeFacturacion(pvp).total).toBe(Math.round(Math.round(Math.round(pvp / 1.19) * 0.8) * 1.19));
    }
  });

  it("el descuento es el 20% y sale nombrado, no escondido en una cifra", () => {
    expect(DESCUENTO_DISTRIBUCION).toBe(0.2);
  });

  // NO ES EL IVA DEL PVP: se recalcula sobre la base YA DESCONTADA. Si se arrastrara el IVA original, CNV
  // facturaria un IVA que no corresponde a su base y la factura no cuadraria consigo misma.
  it("el IVA se recalcula sobre la base descontada", () => {
    const p = precioDeFacturacion(119_000);
    expect(p.iva).toBe(Math.round(p.baseDescontada * 0.19));
    expect(p.baseDescontada + p.iva).toBe(p.total);
  });
});

describe("el flete", () => {
  // §5.3: "El Integrante no gana ni pierde en el envio: solo lo traslada". Asi que NO lleva descuento.
  it("no lleva descuento", () => {
    expect(fleteFacturado(12_000).base).toBe(12_000);
  });

  // §5.4, articulo 447 del Estatuto Tributario: la base gravable incluye acarreos, aunque se facturen aparte.
  it("si lleva IVA del 19%", () => {
    expect(fleteFacturado(12_000)).toEqual({ base: 12_000, iva: 2_280, total: 14_280 });
  });
});

describe("el corte", () => {
  // §4: "Dias 15 y ultimo de cada mes". El dia 15 CIERRA la primera quincena, no abre la segunda.
  it("el 15 pertenece a la primera quincena", () => {
    expect(corteDe("2026-09-15")).toEqual({ desde: "2026-09-01", hasta: "2026-09-15" });
  });

  it("el 16 abre la segunda", () => {
    expect(corteDe("2026-09-16")).toEqual({ desde: "2026-09-16", hasta: "2026-09-30" });
  });

  it("la segunda quincena termina el ultimo dia del mes, sea cual sea", () => {
    expect(corteDe("2026-02-20").hasta).toBe("2026-02-28"); // 2026 no es bisiesto
    expect(corteDe("2026-01-31").hasta).toBe("2026-01-31");
  });
});

describe("los plazos", () => {
  // §4: emitir dentro de los DOS dias habiles siguientes al corte; objetar DOS habiles; corregir TRES;
  // pagar TRES habiles desde la RECEPCION.
  it("cuelgan de la recepcion de la factura, no del corte", () => {
    const corte = corteDe("2026-09-15");
    const tarde = plazosDelCorte(corte, "2026-09-25");
    const aTiempo = plazosDelCorte(corte, "2026-09-17");
    // Una factura tardia NO le come el plazo de pago al Integrante.
    expect(tarde.pagarHasta > aTiempo.pagarHasta).toBe(true);
  });

  it("la mora se cuenta en dias CALENDARIO, no habiles", () => {
    const p = plazosDelCorte(corteDe("2026-09-15"), "2026-09-17");
    const pagar = new Date(`${p.pagarHasta}T12:00:00`);
    const mora = new Date(`${p.moraDesde}T12:00:00`);
    expect(Math.round((mora.getTime() - pagar.getTime()) / 86_400_000)).toBe(3);
    const reversion = new Date(`${p.reversionDesde}T12:00:00`);
    expect(Math.round((reversion.getTime() - pagar.getTime()) / 86_400_000)).toBe(10);
  });
});

describe("la cuenta quincenal", () => {
  const corte = corteDe("2026-09-15");
  // LA LINEA VIENE SELLADA, como en la base: base de TODA la linea y el descuento del Integrante, tal como
  // los escribio el sellado de la venta. Con PVP 119.000 y tasa del 20%, una unidad sella base 100.000 y
  // descuento 20.000.
  const linea = (cantidad: number, baseSellada: number, descuentoSellado: number) => ({
    transactionId: "t1",
    dia: "2026-09-10",
    producto: "MULTICELL BASE",
    cantidad,
    baseSellada,
    descuentoSellado,
  });

  it("suma productos descontados y fletes sin descontar", () => {
    const c = armarCuentaQuincenal({
      corte,
      lineas: [linea(2, 200_000, 40_000)],
      fletes: [12_000],
      esAgenteRetenedor: false,
      uvt: UVT_2026,
    });
    expect(c.baseProductos).toBe(160_000); // 80.000 x 2
    expect(c.baseFletes).toBe(12_000);
    expect(c.base).toBe(172_000);
    expect(c.iva).toBe(30_400 + 2_280);
    expect(c.total).toBe(c.base + c.iva);
  });

  // §4, textual: "Si no hubo ventas, no se emite factura".
  it("sin ventas no hay nada que facturar", () => {
    const c = armarCuentaQuincenal({ corte, lineas: [], fletes: [], esAgenteRetenedor: false, uvt: UVT_2026 });
    expect(c.ventas).toBe(0);
    expect(c.total).toBe(0);
  });

  // §4.1: retefuente por compra de bienes, 2,5%, cuando la factura supere 27 UVT.
  it("el agente retenedor practica 2,5% sobre la base, por encima de 27 UVT", () => {
    const c = armarCuentaQuincenal({
      corte,
      lineas: [linea(20, 2_000_000, 400_000)],
      fletes: [],
      esAgenteRetenedor: true,
      uvt: UVT_2026,
    });
    expect(c.base).toBe(1_600_000);
    expect(c.retencionDelIntegrante).toBe(40_000);
    expect(c.netoEsperado).toBe(c.total - 40_000);
  });

  it("por debajo del minimo no retiene", () => {
    const c = armarCuentaQuincenal({
      corte,
      lineas: [linea(1, 100_000, 20_000)],
      fletes: [],
      esAgenteRetenedor: true,
      uvt: UVT_2026,
    });
    expect(c.base).toBe(80_000); // muy por debajo de 27 UVT
    expect(c.retencionDelIntegrante).toBe(0);
  });

  it("quien no es agente retenedor no retiene aunque pase el minimo", () => {
    const c = armarCuentaQuincenal({
      corte,
      lineas: [linea(20, 2_000_000, 400_000)],
      fletes: [],
      esAgenteRetenedor: false,
      uvt: UVT_2026,
    });
    expect(c.retencionDelIntegrante).toBe(0);
  });

  // LA RETENCION NO TOCA EL IVA. Mismo error clasico que ya esta evitado en la liquidacion de la comision.
  it("la retencion se calcula sobre la base, nunca sobre el IVA", () => {
    const c = armarCuentaQuincenal({
      corte,
      lineas: [linea(20, 2_000_000, 400_000)],
      fletes: [50_000],
      esAgenteRetenedor: true,
      uvt: UVT_2026,
    });
    expect(c.retencionDelIntegrante).toBe(Math.round(c.base * 0.025));
    expect(c.retencionDelIntegrante).toBeLessThan(Math.round((c.base + c.iva) * 0.025));
  });
});

describe("el cupo de credito", () => {
  // §4: al alcanzar el tope, el sistema SUSPENDE EL DESPACHO de nuevo inventario.
  it("al alcanzar el cupo se suspenden los despachos, con el motivo", () => {
    const r = puedeDespacharse({ saldoPendiente: 500_000, cupo: 500_000, enMoraDesde: null });
    expect(r.puede).toBe(false);
    expect(r.motivo).toContain("cupo");
  });

  it("por debajo del cupo se despacha", () => {
    expect(puedeDespacharse({ saldoPendiente: 499_999, cupo: 500_000, enMoraDesde: null }).puede).toBe(true);
  });

  // SIN CUPO CONFIGURADO NO SE SUSPENDE: nulo significa "no se ha fijado", no "cero". Tratarlo como cero
  // bloquearia a todos los Integrantes el dia del despliegue, que es peor que no tener el control.
  it("un cupo sin fijar no bloquea a nadie", () => {
    expect(puedeDespacharse({ saldoPendiente: 9_000_000, cupo: null, enMoraDesde: null }).puede).toBe(true);
  });

  it("la mora suspende aunque haya cupo de sobra", () => {
    const r = puedeDespacharse({ saldoPendiente: 0, cupo: 5_000_000, enMoraDesde: "2026-09-20" });
    expect(r.puede).toBe(false);
    expect(r.motivo).toContain("mora");
  });
});

// ═══ EL PRODUCTO DE TERCERO, que es donde la cuenta se puede equivocar callada ═══
//
// En un producto de tercero el residuo de CNV (`cnv_amount`) es MAS CHICO, porque el proveedor se lleva su
// parte. Lo que CNV le factura al Integrante NO es ese residuo: es la base menos SU descuento. Facturar por el
// residuo cobraria de menos, y la diferencia se la comeria CNV sin que nada fallara.
describe("producto de tercero", () => {
  it("se factura por la base menos el descuento del Integrante, no por el residuo de CNV", () => {
    // Base 100.000: integrante 20.000, proveedor 70.000, residuo de CNV 10.000 (el caso de LUVIA, §7.2).
    const p = precioDeFacturacionSellado(100_000, 20_000);
    expect(p.baseDescontada).toBe(80_000);
    expect(p.baseDescontada).not.toBe(10_000);
    expect(p.iva).toBe(15_200);
  });
});

describe("la cuenta sale de lo SELLADO, no del precio de hoy", () => {
  it("una linea vieja conserva su base y su descuento aunque el catalogo haya cambiado", () => {
    // La venta sello base 100.000 y descuento 20.000. Que hoy el producto valga otra cosa no la toca.
    expect(precioDeFacturacionSellado(100_000, 20_000).total).toBe(95_200);
    // Y si el Integrante tenia otra tasa cuando vendio (25%), la cuenta la respeta.
    expect(precioDeFacturacionSellado(100_000, 25_000).baseDescontada).toBe(75_000);
  });
});
