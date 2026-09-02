import { describe, expect, it } from "vitest";

import {
  computeProtocoloCalorico,
  type ProtocoloCaloricoInput,
} from "@/clinical-engine/protocolo-calorico";

import { chainVerbatim } from "./fixtures/clinical-engine/protocolo-chain-harness.mjs";

// GOLDEN 1: nuestra cadena calórica contra los BYTES de Gildardo.
//
// ═══ RE-ANCLADO EL 2026-09-02, Y EL MOTIVO ES EL HALLAZGO ═══
//
// El oráculo corría el slice de `ATLAS.html:14124`, que es el bloque de la **fórmula sintética del
// médico**. Ese bloque está DESACTIVADO en su archivo (`false && hasBis`, marcado "OLD MEDICO IIFE
// REMOVED"), y su cadena del plan nutricional **nunca calculó el GEB**: lo LEE de `motorTratNutri`
// (`var gebAuto = _mtn.geb`) desde al menos el 19 de agosto.
//
// O sea que **el oráculo llevaba semanas comparando contra un bloque muerto**, y por eso su verde no vio
// que nuestra cadena calculaba el gasto con un `500 + 22 × FFM` que la suya ya no usaba, y que él acaba
// de declarar mal rotulado (Cunningham es 370 + 21,6 × FFM). Entre esa fórmula y la del motor había hasta
// **205 kcal de diferencia sobre el mismo paciente**.
//
// Es la forma exacta de "un candado anclado a una entrega superada pasa verde por construcción", con el
// agravante de que aquí no estaba anclado a una entrega vieja sino a un BLOQUE MUERTO de la vigente.
//
// ═══ QUÉ COMPARA AHORA, Y QUÉ NO ═══
//
// COMPARA el REPARTO: dado el mismo gasto y los mismos objetivos, que los gramos de proteína, grasa y
// carbohidratos salgan idénticos, con su mismo orden de redondeo.
//
// NO COMPARA de dónde salen los DEFAULTS, y eso es una divergencia REAL que está reportada, no un hueco
// del candado: en su cadena, `kcalObj`, `protGKg` y `fatPct` vienen de `motorTratNutri`; en la nuestra
// salen del snapshot sellado (`max(1000, get − déficit)`, `protMin`, 30 %). El caso del final la fija
// para que no se olvide.

type Fixture = {
  nombre: string;
  prueba: string;
  in: ProtocoloCaloricoInput;
  /** Lo que su cadena lee del motor. En la nuestra son los defaults del snapshot. */
  mtn: { fa: number; kcalObjetivo: number; protKg: number; fatPct: number };
};

const CASOS: Fixture[] = [
  {
    nombre: "1 reparto con déficit negativo (superávit)",
    prueba: "la cadena entera con un objetivo por encima del gasto y proteína alta.",
    in: { ffm: 65.73, pesoN: 73.55, talla: 169, edad: 54, sexoM: false, deficit: -300, protMin: 1.5 },
    mtn: { fa: 1.375, kcalObjetivo: 2976, protKg: 1.5, fatPct: 30 },
  },
  {
    nombre: "2 sin overrides",
    prueba: "la cadena completa cuando el profesional no fijó nada.",
    in: { ffm: 0, pesoN: 60, talla: 165, edad: 40, sexoM: false, deficit: 0, protMin: 0.8 },
    mtn: { fa: 1.375, kcalObjetivo: 1856, protKg: 0.8, fatPct: 30 },
  },
  {
    nombre: "3 todos los overrides",
    prueba: "las cinco ramas de override (geb/pal/kcalObj/protGkg/fatPct) ganan sobre lo sugerido.",
    in: {
      ffm: 70, pesoN: 80, talla: 175, edad: 50, sexoM: true, deficit: 500, protMin: 1.2,
      geb: 1800, pal: 1.55, kcalObj: 2200, protGkg: 1.6, fatPct: 25,
    },
    mtn: { fa: 1.375, kcalObjetivo: 9999, protKg: 9, fatPct: 99 },
  },
  {
    nombre: "4 discriminador de redondeo del peso",
    prueba:
      "protG usa pesoN a precisión COMPLETA: round(1.5*73.66)=110, NO 111 (peso redondeado 73.7). Si el TS redondeara el peso, divergiría del harness.",
    in: { ffm: 66, pesoN: 73.66, talla: 170, edad: 45, sexoM: false, deficit: -300, protMin: 1.5 },
    mtn: { fa: 1.375, kcalObjetivo: 2100, protKg: 1.5, fatPct: 30 },
  },
];

type Norm = {
  geb: number; get: number; kcalObj: number; protGKg: number; protG: number;
  protKcal: number; fatPct: number; fatG: number; fatKcal: number; choKcal: number; choG: number;
  choPct: number;
};

function normTs(o: ReturnType<typeof computeProtocoloCalorico>): Norm {
  return {
    geb: o.geb, get: o.get, kcalObj: o.kcalObj, protGKg: o.protGKg,
    protG: o.protG, protKcal: o.protKcal, fatPct: o.fatPct, fatG: o.fatG, fatKcal: o.fatKcal,
    choKcal: o.choKcal, choG: o.choG, choPct: o.choPct,
  };
}
function normHarness(o: ReturnType<typeof chainVerbatim>): Norm {
  return {
    geb: o.gebN, get: o.getN, kcalObj: o.kcalObj, protGKg: o.protGKg,
    protG: o.protG, protKcal: o.protKcal, fatPct: o.fatPct, fatG: o.fatG, fatKcal: o.fatKcal,
    choKcal: o.choKcal, choG: o.choG, choPct: o.choPct,
  };
}

describe("GOLDEN 1: el REPARTO de nuestra cadena == los bytes de su cadena del plan nutricional", () => {
  for (const c of CASOS) {
    it(`${c.nombre}: TS coincide con el harness`, () => {
      const ts = computeProtocoloCalorico(c.in);
      // Al harness se le pasan los MISMOS valores de entrada que la cadena TS resolvió, porque en su
      // cadena esos valores vienen del motor. Lo que se compara es lo que hace la cadena CON ellos.
      const suyo = chainVerbatim(
        ts.gebAuto,
        c.in.pesoN,
        {
          geb: c.in.geb,
          pal: c.in.pal,
          kcal_obj: c.in.kcalObj,
          prot_gkg: c.in.protGkg,
          fat_pct: c.in.fatPct,
        },
        { fa: ts.pal, kcalObjetivo: ts.kcalObj, protKg: ts.protGKg, fatPct: ts.fatPct },
      );
      expect(normTs(ts)).toEqual(normHarness(suyo));
    });
  }

  it("caso 4: protG usa el peso a precisión completa (110, no 111)", () => {
    expect(computeProtocoloCalorico(CASOS[3].in).protG).toBe(110);
  });
});

describe("LA DIVERGENCIA QUE QUEDA, fijada para que no se olvide", () => {
  it("sus defaults salen de motorTratNutri; los nuestros, del snapshot sellado", () => {
    // ESTO NO ES UN FALLO DEL CANDADO: es una diferencia REAL de arquitectura, reportada en la ronda.
    //
    // En su cadena, el objetivo calórico, la proteína por kilo y el porcentaje de grasa se LEEN de
    // `motorTratNutri`. En la nuestra salen del snapshot SELLADO, porque `computeProtocoloEfectivo` corre
    // sobre lo sellado y no puede llamar al motor (necesita la encuesta).
    //
    // Mientras las dos den lo mismo no hay problema; el día que el motor cambie un default, se separan.
    // Este caso deja la diferencia ESCRITA y ejecutable, que es lo contrario de dejarla en un comentario.
    const i: ProtocoloCaloricoInput = {
      ffm: 0, pesoN: 70, talla: 170, edad: 40, sexoM: true, deficit: 0, protMin: 0.8,
    };
    const ts = computeProtocoloCalorico(i);
    // El nuestro: objetivo = gasto − déficit, proteína = protMin, grasa 30 %.
    expect(ts.kcalObj).toBe(ts.get);
    expect(ts.protGKg).toBe(0.8);
    expect(ts.fatPct).toBe(30);

    // El suyo, con un motor que prescribiera otra cosa: la cadena tomaría ESO, no lo nuestro.
    const suyo = chainVerbatim(ts.gebAuto, i.pesoN, {}, {
      fa: 1.375, kcalObjetivo: 1800, protKg: 1, fatPct: 27,
    });
    expect(suyo.kcalObj).toBe(1800);
    expect(suyo.protGKg).toBe(1);
    expect(suyo.fatPct).toBe(27);
    // Y por eso el reparto sale distinto: es la divergencia, medida.
    expect(suyo.protG).not.toBe(ts.protG);
  });
});
