import { describe, expect, it } from "vitest";

import { computeIntercambio, INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { computeValidacion, INTER_NUTS, type ValidacionEntrada } from "@/clinical-engine/validacion";

// GOLDEN de la validacion nutricional (CP3). Diferencial contra la propia funcion del v8 (interNeed/interTot/
// interCob/interICN): para el mismo plan, cada nutriente da obtenido/requerido/%cubrimiento/ICN byte-identico.
// CUIDADO CLAVE (un numero mal portado en la tabla de nutrientes se lee como dato clinico, no como error): el
// candado de transcripcion de INTER_TABLA_A (CP1, intercambio.golden) cubre los 27 nutrientes de cada fila; ESTA
// validacion consume 16 de ellos, asi que el candado sigue protegiendo lo que CP3 usa. Se re-verifica aqui.

import { computeValidacionRef } from "./fixtures/reference/validacion-vigente.js";

const ref = computeValidacionRef as (
  interCounts: Record<string, number>,
  kcalObj: number,
  protG: number,
  choG: number,
  fatG: number,
  sexoM: boolean,
  edad: number,
) => { k: string; obtenido: number; requerido: number; cob: number; icn: number | null }[];

// Porciones por sub (alimento) desde un intercambio real (computeIntercambio -> por grupo {sub, porciones}).
function porcionesPorSub(objetivo: number): Record<string, number> {
  const m: Record<string, number> = {};
  for (const g of computeIntercambio(objetivo)) m[g.sub] = g.porciones;
  return m;
}

describe("validacion: golden diferencial contra la funcion del v8", () => {
  // Varios objetivos + macros + sexo/edad; el diferencial asegura que interNeed (targets DRI) y el reparto de
  // nutrientes coinciden con el v8 en todas las ramas (sexo/edad cambian los micros).
  const casos: [string, ValidacionEntrada][] = [
    [
      "M 40, 2500 kcal",
      { porcionesPorSub: porcionesPorSub(2500), kcalObj: 2500, protG: 120, choG: 300, fatG: 80, sexoM: true, edad: 40 },
    ],
    [
      "F 60, 1800 kcal (rama edad>=51 del calcio y hierro)",
      { porcionesPorSub: porcionesPorSub(1800), kcalObj: 1800, protG: 90, choG: 210, fatG: 60, sexoM: false, edad: 60 },
    ],
    [
      "M 75, 3000 kcal (rama edad>70 del calcio)",
      { porcionesPorSub: porcionesPorSub(3000), kcalObj: 3000, protG: 150, choG: 360, fatG: 95, sexoM: true, edad: 75 },
    ],
  ];

  for (const [nombre, e] of casos) {
    it(`${nombre}: los 16 nutrientes coinciden (obtenido/requerido/cob/icn)`, () => {
      const mine = computeValidacion(e);
      const refOut = ref(e.porcionesPorSub, e.kcalObj, e.protG, e.choG, e.fatG, e.sexoM, e.edad);
      expect(mine.length).toBe(refOut.length);
      for (let i = 0; i < mine.length; i++) {
        expect(mine[i].k).toBe(refOut[i].k);
        expect(mine[i].obtenido).toBeCloseTo(refOut[i].obtenido, 8);
        expect(mine[i].requerido).toBe(refOut[i].requerido);
        expect(mine[i].cob).toBeCloseTo(refOut[i].cob, 8);
        if (refOut[i].icn === null) expect(mine[i].icn).toBeNull();
        else expect(mine[i].icn).toBeCloseTo(refOut[i].icn as number, 8);
      }
    });
  }
});

describe("validacion: el candado de transcripcion cubre los nutrientes que CP3 consume (cuidado clave)", () => {
  it("cada nutriente sumado por la validacion existe en TODAS las filas de INTER_TABLA_A", () => {
    // Si una fila de la tabla no trajera uno de estos campos, interTot lo leeria como 0 y el % de cubrimiento
    // saldria mal SIN avisar. El candado de CP1 (toEqual + 29 claves por fila) lo garantiza; esto lo re-asserta
    // para los campos que ESTA pieza consume.
    const consumidos = INTER_NUTS.map((n) => n.k);
    for (const r of INTER_TABLA_A) {
      const row = r as unknown as Record<string, unknown>;
      for (const k of consumidos) {
        expect(typeof row[k]).toBe("number"); // presente y numerico en cada fila
      }
    }
  });
});
