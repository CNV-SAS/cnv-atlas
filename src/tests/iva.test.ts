import { describe, expect, it } from "vitest";

import { baseFromTotal, IVA_RATE, ivaFromTotal } from "../core/iva";

describe("IVA (19%)", () => {
  it("separa base e IVA de un PVP exacto", () => {
    expect(IVA_RATE).toBe(0.19);
    expect(baseFromTotal(119)).toBe(100);
    expect(ivaFromTotal(119)).toBe(19);
  });

  it("base mas IVA reconstruye el total (PVP de 50000)", () => {
    const total = 50000;
    expect(baseFromTotal(total)).toBe(42016.81);
    expect(ivaFromTotal(total)).toBe(7983.19);
    expect(baseFromTotal(total) + ivaFromTotal(total)).toBe(total);
  });

  it("la comision sobre la base es menor que sobre el total con IVA", () => {
    const total = 50000;
    const rate = 0.2;
    const onBase = Math.round(baseFromTotal(total) * rate * 100) / 100;
    expect(onBase).toBe(8403.36); // 42016.81 * 0.2
    expect(onBase).toBeLessThan(total * rate); // 10000 sobre el total con IVA
  });
});
