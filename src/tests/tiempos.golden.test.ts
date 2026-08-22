import { describe, expect, it } from "vitest";

import { INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { computeTiempos, interSplit, TIEMPOS_DEF, tiemposVivos } from "@/clinical-engine/tiempos";

// GOLDEN de la distribucion por tiempos (CP2). Diferencial contra la propia funcion del v8:
//   (1) interSplit (el reparto por mayor resto, el nucleo) reproduce byte-a-byte al del v8 para varios casos,
//       incluidos los que reparten resto (donde un port se desvia).
//   (2) TIEMPOS_DEF byte-identico (los 6 tiempos y sus fracciones).
//   (3) computeTiempos: CUADRA (la suma de porciones por tiempo == las porciones del grupo, ninguna se pierde)
//       y respeta los tiempos ACTIVOS (los apagados no aparecen).

import { interSplit as refSplit, TIEMPOS_DEF as REF_TIEMPOS } from "./fixtures/reference/tiempos-vigente.js";

const ref = refSplit as (total: number, props: number[]) => number[];

describe("tiempos: TIEMPOS_DEF verbatim del v8", () => {
  it("los 6 tiempos y sus fracciones son byte-identicos", () => {
    expect(TIEMPOS_DEF).toEqual(REF_TIEMPOS);
    expect(TIEMPOS_DEF.reduce((s, t) => s + t.p, 0)).toBeCloseTo(1, 10); // suman 1
  });
});

describe("tiempos: interSplit (mayor resto) — diferencial contra el v8", () => {
  const props6 = TIEMPOS_DEF.map((t) => t.p);
  const casos: [number, number[]][] = [
    [10, props6], // reparte con resto
    [3, props6], // pocas porciones, muchos tiempos: casi todo por resto
    [1, props6], // una porcion: la del mayor resto (el mayor %)
    [7, [0.25, 0.3, 0.2]], // 3 tiempos activos
    [4, [0.5, 0.5]], // dos iguales
    [0, props6], // cero: todo cero
  ];
  for (const [total, props] of casos) {
    it(`interSplit(${total}, [${props.length} props]) == v8`, () => {
      const mine = interSplit(total, props);
      expect(mine).toEqual(ref(total, props));
      // cuadre: la suma de las partes == total (ninguna porcion se pierde).
      expect(mine.reduce((a, b) => a + b, 0)).toBe(total);
    });
  }

  it("una sola porcion va al tiempo del MAYOR resto fraccionario (el mayor %)", () => {
    // con 1 porcion y los 6 tiempos, el mayor raw fraccionario es almuerzo (0.30): recibe la unica.
    const parts = interSplit(1, props6);
    const almuerzoIx = TIEMPOS_DEF.findIndex((t) => t.id === "almuerzo");
    expect(parts[almuerzoIx]).toBe(1);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe("tiempos: computeTiempos — cuadre POR ALIMENTO y tiempos activos", () => {
  const TODOS = { desayuno: true, mediasOnces: true, almuerzo: true, algo: true, cena: true, merienda: true };
  // Porciones keyed por ALIMENTO (sub), como las daria CP1. Se toman subs reales de INTER_TABLA_A.
  const SUB_A = INTER_TABLA_A[0].sub; // primer alimento (G1)
  const SUB_B = INTER_TABLA_A[3].sub;
  const SUB_C = INTER_TABLA_A[6].sub;
  const porciones: Record<string, number> = { [SUB_A]: 8, [SUB_B]: 4, [SUB_C]: 2 };

  it("cada alimento con porciones se reparte y CUADRA (suma por tiempo == porciones del alimento)", () => {
    const dist = computeTiempos(porciones, TODOS);
    for (const [sub, n] of Object.entries(porciones)) {
      const row = dist[sub];
      expect(row).toBeDefined();
      const suma = Object.values(row).reduce((a, b) => a + b, 0);
      expect(suma).toBe(n); // ninguna porcion se pierde ni se inventa
    }
  });

  it("un alimento en 0 porciones NO aparece en la distribucion", () => {
    const SUB_CERO = INTER_TABLA_A[10].sub;
    const dist = computeTiempos({ ...porciones, [SUB_CERO]: 0 }, TODOS);
    expect(dist[SUB_CERO]).toBeUndefined();
  });

  it("solo los tiempos ACTIVOS reciben porciones (los apagados no aparecen)", () => {
    const soloTres = { desayuno: true, almuerzo: true, cena: true } as Record<string, boolean>;
    const dist = computeTiempos(porciones, soloTres);
    const vivos = tiemposVivos(soloTres).map((t) => t.id);
    expect(vivos).toEqual(["desayuno", "almuerzo", "cena"]);
    for (const row of Object.values(dist)) {
      expect(Object.keys(row).sort()).toEqual([...vivos].sort()); // solo esos tres tiempos
    }
    // y sigue cuadrando con menos tiempos.
    expect(Object.values(dist[SUB_A]).reduce((a, b) => a + b, 0)).toBe(8);
  });
});
