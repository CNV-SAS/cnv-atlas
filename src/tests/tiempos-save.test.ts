import { describe, expect, it } from "vitest";

import { INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { tiemposSignature } from "@/modules/treatment/data/protocol-signature";
import type { TiemposSaved } from "@/modules/treatment/data/treatment-view-types";
import { saveTiemposSchema } from "@/modules/treatment/validations";

// Piezas puras de CP2.2a, POR ALIMENTO (opcion A, ronda P-29): firma orden-independiente (tres partes) y validacion
// estricta del jsonb de tiempos. Todo keyed por alimento (sub), coherente con el intercambio.

const SUB_0 = INTER_TABLA_A[0].sub;

function porciones21(): Record<string, number> {
  const p: Record<string, number> = {};
  for (const r of INTER_TABLA_A) p[r.sub] = 2;
  return p;
}
function tiemposValido(): TiemposSaved {
  const activos = { desayuno: true, mediasOnces: false, almuerzo: true, algo: false, cena: true, merienda: false };
  return {
    activos: { ...activos },
    celdas: { [SUB_0]: { desayuno: 3, almuerzo: 5 } },
    base: { porciones: porciones21(), activos: { ...activos } },
  };
}

describe("tiemposSignature: orden-independiente en las tres partes", () => {
  const sig = (t: TiemposSaved | null) => tiemposSignature({ treatmentId: "t-1", tiempos: t });
  const base = tiemposValido();

  it("reordenar las claves (activos/celdas/base) NO mueve la firma", () => {
    const r: TiemposSaved = {
      activos: Object.fromEntries(Object.entries(base.activos).reverse()),
      celdas: { [SUB_0]: Object.fromEntries(Object.entries(base.celdas[SUB_0]).reverse()) },
      base: { porciones: Object.fromEntries(Object.entries(base.base.porciones).reverse()), activos: base.base.activos },
    };
    expect(sig(r)).toBe(sig(base));
  });

  it("un toggle, una celda o el contexto base mueven la firma", () => {
    const t1 = tiemposValido();
    t1.activos.cena = false;
    expect(sig(t1)).not.toBe(sig(base));
    const t2 = tiemposValido();
    t2.celdas[SUB_0].desayuno = 9;
    expect(sig(t2)).not.toBe(sig(base));
    const t3 = tiemposValido();
    t3.base.porciones[SUB_0] = 99;
    expect(sig(t3)).not.toBe(sig(base));
    const t4 = tiemposValido();
    t4.base.activos.cena = false; // el contexto de activos con el que se hicieron los overrides
    expect(sig(t4)).not.toBe(sig(base));
  });

  it("null y otro tratamiento dan firmas distintas y estables", () => {
    expect(sig(null)).toBe("t-1§none");
    expect(tiemposSignature({ treatmentId: "t-2", tiempos: base })).not.toBe(sig(base));
  });

  // REGRESION (2026-08-22, familia del 500 del intercambio): el writer relee el jsonb crudo; una forma
  // malformada/ajena (sin las tres partes) NO debe reventar la firma -> "none".
  it("una forma malformada/ajena NO revienta: firma == none", () => {
    expect(() => sig({} as unknown as TiemposSaved)).not.toThrow();
    expect(sig({} as unknown as TiemposSaved)).toBe("t-1§none");
    expect(sig({ activos: { desayuno: true } } as unknown as TiemposSaved)).toBe("t-1§none");
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

  it("una celda que referencia un alimento inexistente se RECHAZA", () => {
    const t = tiemposValido();
    t.celdas["Alimento inventado"] = { desayuno: 1 };
    expect(parse(t).success).toBe(false);
  });

  it("una celda con un tiempo desconocido se RECHAZA", () => {
    const t = tiemposValido();
    t.celdas[SUB_0].medianoche = 1;
    expect(parse(t).success).toBe(false);
  });

  it("base.porciones incompleto (falta un alimento) se RECHAZA", () => {
    const t = tiemposValido();
    delete t.base.porciones[INTER_TABLA_A[INTER_TABLA_A.length - 1].sub];
    expect(parse(t).success).toBe(false);
  });
});
