import { describe, expect, it } from "vitest";

import {
  computeProtocoloCalorico,
  type ProtocoloCaloricoInput,
} from "@/clinical-engine/protocolo-calorico";

import { chainVerbatim } from "./fixtures/clinical-engine/protocolo-chain-harness.mjs";

// GOLDEN 1 (T2 A3): la transcripcion TS de la cadena calorica (protocolo-calorico.ts) contra el
// harness Via C (los bytes VERBATIM de ATLAS.html:14124-14137, protegidos por DIFF B). Que cubre
// y que NO, declarado a proposito (un golden que dice "verificado" cuando verifica la mitad es
// peor que uno que declara su brecha):
//
//   CUBIERTO: la transcripcion TS es fiel a los bytes de Gildardo para TODA la cadena, incluida
//     la rama Cunningham, para cualquier FFM (cada caso: TS == harness). Verifica que
//     transcribimos bien.
//   CUBIERTO: que Cunningham produzca el GEB de la PANTALLA (1946) a partir de la FFM REAL, y toda
//     la cadena en adelante (GET 2676 / obj 2976 / protG 110 / fatG 99 / choG 411 / 55%), caso 1.
//     BRECHA CERRADA (2026-07-30): la FFM real es 65.73 (no 65.75, que era redondeo de display), y
//     round(500 + 22*65.73) = round(1946.06) = 1946 EXACTO. El 65.75 daba 1946.5 -> 1947, un
//     artefacto de redondeo del display, no una divergencia. Ademas Mifflin femenino sobre esta
//     paciente (110/169) topa en 1895 a edad 20 y baja con la edad: NO puede producir 1946 a
//     ninguna edad, asi que la pantalla necesariamente calcula Cunningham. El caso 1 ya NO usa geb
//     como override: la cadena computa gebAuto=1946 desde la FFM real y reproduce la captura entera.

type Fixture = {
  nombre: string;
  prueba: string; // que verifica este caso
  noPrueba?: string; // que NO verifica
  in: ProtocoloCaloricoInput;
};

const CASOS: Fixture[] = [
  {
    nombre: "1 ANCLA (captura)",
    prueba: "Cunningham desde la FFM REAL (65.73) computa gebAuto=1946 (sin override) y reproduce la pantalla entera (2676/2976/110/99/411/55%). Cierra la brecha: la FFM real es 65.73, el 65.75 era redondeo de display.",
    in: { ffm: 65.73, pesoN: 73.55, talla: 169, edad: 54, sexoM: false, deficit: -300, protMin: 1.5 },
  },
  {
    nombre: "2 Mifflin (sin FFM)",
    prueba: "la rama Mifflin del GEB (ffm=0) y la cadena completa sin overrides.",
    in: { ffm: 0, pesoN: 60, talla: 165, edad: 40, sexoM: false, deficit: 0, protMin: 0.8 },
  },
  {
    nombre: "3 todos los overrides",
    prueba: "las cinco ramas de override (geb/pal/kcalObj/protGkg/fatPct) ganan sobre lo sugerido.",
    in: { ffm: 70, pesoN: 80, talla: 175, edad: 50, sexoM: true, deficit: 500, protMin: 1.2, geb: 1800, pal: 1.55, kcalObj: 2200, protGkg: 1.6, fatPct: 25 },
  },
  {
    nombre: "4 discriminador de redondeo del peso",
    prueba: "protG usa pesoN a precision COMPLETA: round(1.5*73.66)=110, NO 111 (peso redondeado 73.7). Si el TS redondeara el peso, divergiria del harness.",
    in: { ffm: 66, pesoN: 73.66, talla: 170, edad: 45, sexoM: false, deficit: -300, protMin: 1.5 },
  },
  {
    nombre: "5 Cunningham round half-up (borde .5)",
    prueba: "el redondeo half-up de la rama Cunningham en un borde .5: round(500+22*65.75)=round(1946.5)=1947.",
    noPrueba: "NO es la captura (esa es 65.73 -> 1946, caso 1): 65.75 se usa aqui SOLO porque cae en .5 y discrimina el modo de redondeo.",
    in: { ffm: 65.75, pesoN: 73, talla: 169, edad: 54, sexoM: false, deficit: 0, protMin: 1.0 },
  },
];

// Normaliza ambas salidas (TS y harness usan nombres distintos: geb/gebN, get/getN) a una forma
// comun para comparar valor a valor.
type Norm = {
  gebAuto: number; geb: number; get: number; kcalObj: number; protGKg: number; protG: number;
  protKcal: number; fatPct: number; fatG: number; fatKcal: number; choKcal: number; choG: number;
  choPct: number;
};
function normTs(o: ReturnType<typeof computeProtocoloCalorico>): Norm {
  return {
    gebAuto: o.gebAuto, geb: o.geb, get: o.get, kcalObj: o.kcalObj, protGKg: o.protGKg,
    protG: o.protG, protKcal: o.protKcal, fatPct: o.fatPct, fatG: o.fatG, fatKcal: o.fatKcal,
    choKcal: o.choKcal, choG: o.choG, choPct: o.choPct,
  };
}
function normHarness(o: ReturnType<typeof chainVerbatim>): Norm {
  return {
    gebAuto: o.gebAuto, geb: o.gebN, get: o.getN, kcalObj: o.kcalObj, protGKg: o.protGKg,
    protG: o.protG, protKcal: o.protKcal, fatPct: o.fatPct, fatG: o.fatG, fatKcal: o.fatKcal,
    choKcal: o.choKcal, choG: o.choG, choPct: o.choPct,
  };
}
function runHarness(i: ProtocoloCaloricoInput) {
  return chainVerbatim(
    i.ffm, i.sexoM, i.pesoN, i.talla, i.edad,
    { geb: i.geb, pal: i.pal },
    { kcal_obj: i.kcalObj, prot_gkg: i.protGkg, fat_pct: i.fatPct },
    { estrategia: { deficit: i.deficit }, protMin: i.protMin },
  );
}

describe("GOLDEN 1: cadena calorica TS == harness Via C (bytes de Gildardo)", () => {
  for (const c of CASOS) {
    it(`${c.nombre}: TS coincide con el harness`, () => {
      expect(normTs(computeProtocoloCalorico(c.in))).toEqual(normHarness(runHarness(c.in)));
    });
  }

  it("ancla (caso 1): Cunningham desde la FFM real (65.73) da gebAuto 1946 y reproduce la captura", () => {
    const o = computeProtocoloCalorico(CASOS[0].in);
    expect(o.gebAuto).toBe(1946); // round(500+22*65.73)=round(1946.06); brecha cerrada, sin override
    expect(o.geb).toBe(1946);
    expect(o.get).toBe(2676);
    expect(o.kcalObj).toBe(2976);
    expect(o.protG).toBe(110);
    expect(o.fatG).toBe(99);
    expect(o.choG).toBe(411);
    expect(o.choPct).toBe(55);
  });

  it("caso 4: protG usa el peso a precision completa (110, no 111)", () => {
    expect(computeProtocoloCalorico(CASOS[3].in).protG).toBe(110);
  });

  it("caso 5: Cunningham redondea half-up (gebAuto 1947)", () => {
    expect(computeProtocoloCalorico(CASOS[4].in).gebAuto).toBe(1947);
  });
});
