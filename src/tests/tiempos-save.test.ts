import { describe, expect, it } from "vitest";

import { INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { tiemposActivosSignature, tiemposSignature } from "@/modules/treatment/data/protocol-signature";
import type { TiemposSaved } from "@/modules/treatment/data/treatment-view-types";
import { saveTiemposActivosSchema, saveTiemposSchema } from "@/modules/treatment/validations";

// Piezas puras de CP2.2a, POR ALIMENTO (opcion A, ronda P-29): firma orden-independiente (tres partes) y validacion
// estricta del jsonb de tiempos. Todo keyed por alimento (sub), coherente con el intercambio.

const SUB_0 = INTER_TABLA_A[0].sub;

function porciones21(): Record<string, number> {
  const p: Record<string, number> = {};
  for (const r of INTER_TABLA_A) p[r.sub] = 2;
  return p;
}
// Desde el corte del 2026-08-23 los tiempos ACTIVOS viven en su propia columna: aqui solo quedan los
// overrides y el contexto sellado. `base.activos` SI se conserva: es el contexto con el que se calcularon
// esos overrides, no la decision vigente.
function tiemposValido(): TiemposSaved {
  const activos = { desayuno: true, mediasOnces: false, almuerzo: true, algo: false, cena: true, merienda: false };
  return {
    celdas: { [SUB_0]: { desayuno: 3, almuerzo: 5 } },
    base: { porciones: porciones21(), activos: { ...activos } },
  };
}

describe("tiemposSignature: orden-independiente en las tres partes", () => {
  const sig = (t: TiemposSaved | null) => tiemposSignature({ treatmentId: "t-1", tiempos: t });
  const base = tiemposValido();

  it("reordenar las claves (activos/celdas/base) NO mueve la firma", () => {
    const r: TiemposSaved = {
      celdas: { [SUB_0]: Object.fromEntries(Object.entries(base.celdas[SUB_0]).reverse()) },
      base: { porciones: Object.fromEntries(Object.entries(base.base.porciones).reverse()), activos: base.base.activos },
    };
    expect(sig(r)).toBe(sig(base));
  });

  it("una celda o el contexto base mueven la firma (los ACTIVOS ya no: tienen su propia firma)", () => {
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

// Los tiempos ACTIVOS se partieron a su propia columna, accion y firma (2026-08-23). Sus reglas se mudan
// aqui con ellos: no se pierden por el camino.
describe("tiempos ACTIVOS: firma y schema propios", () => {
  const sigA = (a: Record<string, boolean> | null) => tiemposActivosSignature({ treatmentId: "t-1", activos: a });
  const ACTIVOS = { desayuno: true, almuerzo: true, cena: true };
  const parseA = (activos: unknown) =>
    saveTiemposActivosSchema.safeParse({
      evaluationId: "3bfbcc45-0000-4000-8000-000000000001",
      activos,
      baseSignature: "",
    });

  it("reordenar las claves NO mueve la firma", () => {
    expect(sigA(Object.fromEntries(Object.entries(ACTIVOS).reverse()))).toBe(sigA(ACTIVOS));
  });

  it("apagar un tiempo SI la mueve", () => {
    expect(sigA({ ...ACTIVOS, cena: false })).not.toBe(sigA(ACTIVOS));
  });

  it("null y una forma que no es la actual dan §none (el reader normaliza igual)", () => {
    expect(sigA(null)).toBe("t-1§none");
    expect(sigA([] as unknown as Record<string, boolean>)).toBe("t-1§none");
  });

  const sigT = (t: TiemposSaved | null) => tiemposSignature({ treatmentId: "t-1", tiempos: t });
  it("es INDEPENDIENTE de la distribucion: cambiar la tabla no mueve esta firma", () => {
    // Es el punto de haberlos partido: guardar las casillas no se rechaza porque otro toco la tabla.
    const antes = sigA(ACTIVOS);
    const t = tiemposValido();
    t.celdas[SUB_0].desayuno = 99;
    expect(sigT(t)).not.toBe(sigT(tiemposValido()));
    expect(sigA(ACTIVOS)).toBe(antes);
  });

  it("sin NINGUN tiempo activo se RECHAZA (DIV-13)", () => {
    expect(parseA({ desayuno: false, almuerzo: false, cena: false }).success).toBe(false);
  });

  it("un tiempo desconocido se RECHAZA", () => {
    expect(parseA({ ...ACTIVOS, cena_tarde: true }).success).toBe(false);
  });
});
