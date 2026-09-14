import { describe, expect, it } from "vitest";

import { cierreDelBimestre, plazoDeRevision } from "@/modules/payments/plazo-de-revision";

// El plazo de contabilidad para resolver un pago en revision: 5 dias habiles, y antes del cierre del bimestre.

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("plazoDeRevision", () => {
  it("cinco dias habiles: abierta el lunes 14 de septiembre, vence el lunes 21", () => {
    const p = plazoDeRevision(new Date("2026-09-14T15:00:00Z"), new Date("2026-09-14T16:00:00Z"));
    expect(ymd(p.limite)).toBe("2026-09-21");
    expect(p.porCierreDeBimestre).toBe(false);
    expect(p.estado).toBe("a_tiempo");
    expect(p.diasHabilesRestantes).toBe(5);
  });

  it("los festivos no cuentan: abierta el miercoles 28 de octubre, el cierre del bimestre (31) llega antes", () => {
    const p = plazoDeRevision(new Date("2026-10-28T15:00:00Z"), new Date("2026-10-28T16:00:00Z"));
    expect(ymd(p.limite)).toBe("2026-10-31");
    expect(p.porCierreDeBimestre).toBe(true);
  });

  it("un festivo en medio no cuenta: abierta el viernes 4 de diciembre, vence el lunes 14 y no el viernes 11", () => {
    // El martes 8 de diciembre (Inmaculada Concepcion) es festivo: los cinco habiles son 7, 9, 10, 11 y 14.
    const p = plazoDeRevision(new Date("2026-12-04T15:00:00Z"), new Date("2026-12-04T16:00:00Z"));
    expect(ymd(p.limite)).toBe("2026-12-14");
    expect(p.porCierreDeBimestre).toBe(false);
  });

  it("la hora de Colombia manda: un pago de las 8 p. m. del domingo sigue siendo domingo", () => {
    // 2026-09-14T01:00Z es domingo 13 a las 8 p. m. en Bogota. Contado desde el domingo, vence el viernes 18.
    const p = plazoDeRevision(new Date("2026-09-14T01:00:00Z"), new Date("2026-09-14T02:00:00Z"));
    expect(ymd(p.limite)).toBe("2026-09-18");
  });

  it("por vencer el ultimo dia habil, y vencido despues", () => {
    const abierta = new Date("2026-09-14T15:00:00Z");
    expect(plazoDeRevision(abierta, new Date("2026-09-21T15:00:00Z")).estado).toBe("por_vencer");
    expect(plazoDeRevision(abierta, new Date("2026-09-22T15:00:00Z")).estado).toBe("vencido");
  });

  it("el cierre del bimestre de IVA: febrero, abril, ... diciembre", () => {
    expect(ymd(cierreDelBimestre(new Date(2026, 0, 10, 12)))).toBe("2026-02-28");
    expect(ymd(cierreDelBimestre(new Date(2026, 8, 14, 12)))).toBe("2026-10-31");
    expect(ymd(cierreDelBimestre(new Date(2026, 11, 3, 12)))).toBe("2026-12-31");
  });
});
