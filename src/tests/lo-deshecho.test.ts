import { describe, expect, it } from "vitest";

import { NOMBRE_DE_CLASE, tasaDeReversion } from "@/modules/payments/lo-deshecho";

// CANDADO DE LA TASA DE REVERSION.
//
// Lo que protege es una sola decision, y es la que distingue una cifra honesta de una que miente por
// omision: SIN VENTAS NO HAY TASA, y eso no es cero. Cero por ciento AFIRMA que no se deshace nada, que es
// una conclusion; "no hay con que compararlo" es la verdad. La pantalla puede decir las dos cosas, pero solo
// si el modulo se las distingue.
describe("la tasa de reversion", () => {
  it("sin ventas pagadas no hay tasa, y no es cero", () => {
    expect(tasaDeReversion(0, 0)).toBeNull();
    expect(tasaDeReversion(3, 0)).toBeNull();
  });

  it("es el porcentaje sobre lo pagado, con un decimal", () => {
    expect(tasaDeReversion(3, 100)).toBe(3);
    expect(tasaDeReversion(1, 300)).toBe(0.3);
    expect(tasaDeReversion(1, 3)).toBe(33.3);
  });

  it("y cada clase tiene nombre propio en pantalla", () => {
    // UN CONTRACARGO NO ES UNA DEVOLUCION: uno lo pelea el banco y el otro lo trae el paciente. Ensenar
    // "contracargo" y "devolucion" con el mismo rotulo juntaria dos hechos que se atienden distinto.
    expect(new Set(Object.values(NOMBRE_DE_CLASE)).size).toBe(Object.keys(NOMBRE_DE_CLASE).length);
  });
});
