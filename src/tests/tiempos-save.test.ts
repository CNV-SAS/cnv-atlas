import { describe, expect, it } from "vitest";

import { INTER_GRUPOS } from "@/clinical-engine/intercambio";
import { tiemposSignature } from "@/modules/treatment/data/protocol-signature";
import type { TiemposSaved } from "@/modules/treatment/data/treatment-view-types";
import { saveTiemposSchema } from "@/modules/treatment/validations";

// Piezas puras de CP2.2a: firma orden-independiente (tres partes) y validacion estricta del jsonb de tiempos.

function porciones12(): Record<string, number> {
  const p: Record<string, number> = {};
  for (const g of INTER_GRUPOS) p[g.id] = 2;
  return p;
}
function tiemposValido(): TiemposSaved {
  const activos = { desayuno: true, mediasOnces: false, almuerzo: true, algo: false, cena: true, merienda: false };
  return {
    activos: { ...activos },
    celdas: { G1: { desayuno: 3, almuerzo: 5 } },
    base: { porciones: porciones12(), activos: { ...activos } },
  };
}

describe("tiemposSignature: orden-independiente en las tres partes", () => {
  const sig = (t: TiemposSaved | null) => tiemposSignature({ treatmentId: "t-1", tiempos: t });
  const base = tiemposValido();

  it("reordenar las claves (activos/celdas/base) NO mueve la firma", () => {
    const r: TiemposSaved = {
      activos: Object.fromEntries(Object.entries(base.activos).reverse()),
      celdas: { G1: Object.fromEntries(Object.entries(base.celdas.G1).reverse()) },
      base: { porciones: Object.fromEntries(Object.entries(base.base.porciones).reverse()), activos: base.base.activos },
    };
    expect(sig(r)).toBe(sig(base));
  });

  it("un toggle, una celda o el contexto base mueven la firma", () => {
    const t1 = tiemposValido();
    t1.activos.cena = false;
    expect(sig(t1)).not.toBe(sig(base));
    const t2 = tiemposValido();
    t2.celdas.G1.desayuno = 9;
    expect(sig(t2)).not.toBe(sig(base));
    const t3 = tiemposValido();
    t3.base.porciones.G1 = 99;
    expect(sig(t3)).not.toBe(sig(base));
    const t4 = tiemposValido();
    t4.base.activos.cena = false; // el contexto de activos con el que se hicieron los overrides
    expect(sig(t4)).not.toBe(sig(base));
  });

  it("null y otro tratamiento dan firmas distintas y estables", () => {
    expect(sig(null)).toBe("t-1§none");
    expect(tiemposSignature({ treatmentId: "t-2", tiempos: base })).not.toBe(sig(base));
  });
});

describe("saveTiemposSchema: validacion estricta (tres partes, >=1 activo)", () => {
  const parse = (tiempos: unknown) =>
    saveTiemposSchema.safeParse({ evaluationId: "00000000-0000-0000-0000-000000000000", tiempos, baseSignature: "" });

  it("un tiempos valido PASA", () => {
    expect(parse(tiemposValido()).success).toBe(true);
  });

  it("sin NINGUN tiempo activo se RECHAZA (cuidado b)", () => {
    const t = tiemposValido();
    for (const k of Object.keys(t.activos)) t.activos[k] = false;
    expect(parse(t).success).toBe(false);
  });

  it("un tiempo desconocido en activos se RECHAZA", () => {
    const t = tiemposValido();
    (t.activos as Record<string, boolean>).cena_tarde = true;
    expect(parse(t).success).toBe(false);
  });

  it("una celda que referencia un grupo inexistente se RECHAZA", () => {
    const t = tiemposValido();
    t.celdas.G99 = { desayuno: 1 };
    expect(parse(t).success).toBe(false);
  });

  it("una celda con un tiempo desconocido se RECHAZA", () => {
    const t = tiemposValido();
    t.celdas.G1.medianoche = 1;
    expect(parse(t).success).toBe(false);
  });

  it("base.porciones incompleto (falta un grupo) se RECHAZA", () => {
    const t = tiemposValido();
    delete t.base.porciones.G12;
    expect(parse(t).success).toBe(false);
  });
});
