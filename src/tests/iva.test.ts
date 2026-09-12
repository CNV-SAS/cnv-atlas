import { describe, expect, it } from "vitest";

import { baseFromTotal, IVA_RATE, ivaFromTotal, totalFromBase } from "../core/iva";

// ═══ LA POLITICA DE REDONDEO, Y POR QUE CAMBIO (2026-09-12) ═══
//
// Estos helpers redondeaban a DOS decimales. Con LUVIA eso daba base 75.630,25 en Atlas contra 75.630 en
// el item de Alegra: veinticinco centavos por unidad que no significan nada y que, con volumen, aparecen
// como un descuadre sin causa entre dos sistemas que dicen lo mismo. Se cerro antes de que hubiera
// volumen, que es cuando cuesta barato.
//
// LA REGLA: todo en pesos enteros; se redondean la BASE y el IVA, y el total es su suma.

describe("IVA (19%), en pesos enteros", () => {
  it("separa base e IVA de un PVP exacto", () => {
    expect(IVA_RATE).toBe(0.19);
    expect(baseFromTotal(119)).toBe(100);
    expect(ivaFromTotal(119)).toBe(19);
  });

  it("los CINCO precios del catálogo dan exactamente las cifras que tiene Alegra", () => {
    // No son ejemplos: son los cinco PVP reales contra las cinco bases que Santiago tecleó en el sandbox.
    // Si esto se pone rojo, los dos catálogos dejaron de decir lo mismo.
    const CATALOGO: [string, number, number, number][] = [
      // producto, PVP, base en Alegra, IVA resultante
      ["MULTICELL BASE", 107100, 90000, 17100],
      ["OMEGA COMPLEX", 107100, 90000, 17100],
      ["CURCUMIN BIOACTIV", 107100, 90000, 17100],
      ["D3-K2 OSTEO", 166600, 140000, 26600],
      // El único donde el IVA no es el 19% exacto de la base: 19% de 75.630 son 14.369,70. La diferencia
      // de 0,30 cae en el IVA, redondeada al peso, y NO en el total, para que el paciente pague un número
      // redondo y la factura diga ese mismo número.
      ["LUVIA", 90000, 75630, 14370],
    ];
    for (const [nombre, pvp, base, iva] of CATALOGO) {
      expect(baseFromTotal(pvp), `${nombre}: base`).toBe(base);
      expect(ivaFromTotal(pvp), `${nombre}: IVA`).toBe(iva);
      expect(totalFromBase(base), `${nombre}: el camino inverso no vuelve al PVP`).toBe(pvp);
    }
  });

  it("ningún importe lleva centavos", () => {
    for (const pvp of [119, 50000, 90000, 107100, 166600, 33333, 1]) {
      expect(Number.isInteger(baseFromTotal(pvp)), `base de ${pvp}`).toBe(true);
      expect(Number.isInteger(ivaFromTotal(pvp)), `IVA de ${pvp}`).toBe(true);
    }
  });

  it("base + IVA reconstruye el total SIEMPRE, barrido sobre un rango grande", () => {
    // Tres ejemplos no prueban una identidad. Si esto se rompiera, Atlas cobraría una cifra y facturaría
    // otra, y el pago registrado no cuadraría con la factura: el descuadre más caro de diagnosticar,
    // porque cada venta suelta se ve bien.
    const rotos: number[] = [];
    for (let pvp = 1; pvp <= 300000; pvp += 7) {
      if (baseFromTotal(pvp) + ivaFromTotal(pvp) !== pvp) rotos.push(pvp);
    }
    expect(rotos.slice(0, 10), `base + IVA deja de dar el total en ${rotos.length} casos`).toEqual([]);
  });

  it("y el camino inverso vuelve al mismo PVP en casi todo el rango", () => {
    // Esta identidad NO es exacta y no se finge que lo sea: hay PVP que no son alcanzables desde ninguna
    // base entera (la base salta de peso en peso y el total salta de 1,19 en 1,19). Lo que sí se exige es
    // que los precios que USAMOS sean de los alcanzables, que es lo que comprueba el caso del catálogo.
    let inalcanzables = 0;
    for (let base = 1000; base <= 200000; base += 13) {
      if (baseFromTotal(totalFromBase(base)) !== base) inalcanzables++;
    }
    // Se fija el número observado: si cambia, la política de redondeo cambió y hay que volver a mirarla.
    expect(inalcanzables).toBe(0);
  });

  it("la comisión sobre la base es menor que sobre el total con IVA", () => {
    const total = 50000;
    const onBase = Math.round(baseFromTotal(total) * 0.2);
    expect(onBase).toBe(8403); // 42.017 * 0,2
    expect(onBase).toBeLessThan(total * 0.2);
  });
});
