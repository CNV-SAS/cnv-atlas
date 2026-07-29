import { describe, expect, it } from "vitest";

import { motorProtocolo } from "@/clinical-engine/frozen/atlas-protocolo.js";

// GOLDEN 2 (T2 A3): LINEA BASE DE REGRESION de la ciencia congelada `motorProtocolo`, NO test de
// paridad. DIFF A ya garantiza la fidelidad al fuente (byte a byte); correr el frozen contra el
// frozen no diria nada. Esto protege dos cosas: (1) que entendimos bien la ciencia (derivamos a
// mano de las formulas y comparamos), y (2) la LINEA BASE para el dia que Gildardo entregue una
// version nueva de motorProtocolo (Q14 abierta): ese dia el golden dice que salidas cambiaron.
//
// REGLA DE DISCREPANCIA (distinta a la de GOLDEN 1): si nuestra derivacion a mano != el frozen,
// gana el CODIGO (es la ciencia; nuestra derivacion es una lectura): se corrige el valor esperado
// y se anota que la formula se leyo mal (info util sobre donde la ciencia es contraintuitiva).
// Solo frozen != ATLAS.html dispara el stop, y eso lo cubre DIFF A.
//
// CAVEATS DE ALCANCE (informacion, no falla): (a) la rama de estrategia ['F4','F5']->300 es
// INALCANZABLE para un F4 real: el clasificador fuerza obesidadSarcopenica=true para F1 y F4
// (ATLAS.html:10916), y la rama F1||obSarco->500 gana antes; solo F5 la alcanza, y ese es el caso
// que la ejercita. (b) F7 con imc<18.5 seria inconsistente (F7 es banda de IMC normal), asi que la
// alerta de realimentacion se ancla con F10 (bajo peso), su via consistente.

function proto(o: {
  sexo?: string; peso?: number; talla?: number; imc?: number;
  fenotipo?: string; sector?: string; obSarco?: boolean;
  dx?: string[]; hta?: boolean; iae?: number; iehh?: number; mcaDif?: number; geb?: number;
}) {
  return motorProtocolo(
    {
      sexo: o.sexo ?? "Femenino", peso: o.peso ?? 70, talla: o.talla ?? 165, imc: o.imc ?? 25.7,
      FMI: 8, FFMI: 16, iehh: o.iehh ?? 0, iae: o.iae ?? 0, irc: 0, iscm: 0, FFM: 45,
      MCA_dif: o.mcaDif ?? 0, GEB: o.geb ?? 1500,
    },
    { d5_39: o.dx ?? [], d5_36: o.hta ? "Sí" : "No" },
    { fenotipo: { id: o.fenotipo ?? "F11", nombre: "" }, sectorFR: o.sector ?? "S4", nombreFR: "", obesidadSarcopenica: o.obSarco ?? false },
  );
}
const N = (arr: { nombre: string }[]) => arr.map((x) => x.nombre);

describe("GOLDEN 2: motorProtocolo (linea base de regresion)", () => {
  it("1 F1 obesidad+obSarco: +500, protMin 1.2/1.5, peso ajustado, AGS+Ultra, VitD3+Leucina, Prealbumina", () => {
    const o = proto({ fenotipo: "F1", obSarco: true, peso: 82, talla: 160, imc: 32.03 });
    expect(o.estrategia.deficit).toBe(500);
    expect([o.protMin, o.protMax]).toEqual([1.2, 1.5]);
    expect(o.pesoCalculoLabel).toContain("obesidad");
    expect(o.pesoCalculo).toBeCloseTo(62.5, 5);
    expect(N(o.restricciones)).toEqual(expect.arrayContaining(["AGS", "Ultraprocesados"]));
    expect(N(o.suplementacion)).toEqual(expect.arrayContaining(["Vitamina D3", "Leucina/BCAA"]));
    expect(N(o.examenes)).toContain("Prealbúmina");
  });

  it("2 F2 obesidad: +600, protMin 0.8/1.2, peso ajustado, AGS+Ultra, VitD3", () => {
    const o = proto({ fenotipo: "F2", peso: 79, talla: 160, imc: 30.86 });
    expect(o.estrategia.deficit).toBe(600);
    expect([o.protMin, o.protMax]).toEqual([0.8, 1.2]);
    expect(o.pesoCalculoLabel).toContain("obesidad");
    expect(N(o.restricciones)).toEqual(expect.arrayContaining(["AGS", "Ultraprocesados"]));
    expect(N(o.suplementacion)).toContain("Vitamina D3");
  });

  it("3 F5 (F4/F5 -> 300; F4 real es inalcanzable, ver caveat): +300, protMin 0.8", () => {
    const o = proto({ fenotipo: "F5", obSarco: false, peso: 69, talla: 160, imc: 27 });
    expect(o.estrategia.deficit).toBe(300);
    expect(o.protMin).toBe(0.8);
    expect(o.pesoCalculoLabel).toContain("obesidad");
    expect(N(o.restricciones)).toEqual(expect.arrayContaining(["AGS", "Ultraprocesados"]));
  });

  it("4 F7 consistente (imc 22): -300, protMin 1.5/2.0, peso actual, examen de realimentacion", () => {
    const o = proto({ fenotipo: "F7", peso: 57, talla: 160, imc: 22 });
    expect(o.estrategia.deficit).toBe(-300);
    expect([o.protMin, o.protMax]).toEqual([1.5, 2.0]);
    expect(o.pesoCalculoLabel).toContain("IMC normal");
    expect(N(o.examenes)).toContain("Fósforo, potasio, magnesio, tiamina");
    expect(N(o.restricciones)).not.toContain("AGS");
  });

  it("5 F11: mantenimiento 0, protMin 0.8, peso actual", () => {
    const o = proto({ fenotipo: "F11", peso: 51, talla: 160, imc: 20 });
    expect(o.estrategia.deficit).toBe(0);
    expect(o.protMin).toBe(0.8);
    expect(o.pesoCalculoLabel).toContain("IMC normal");
  });

  it("6 F8 (default): mantenimiento 0, protMin 0.8", () => {
    const o = proto({ fenotipo: "F8", peso: 59, talla: 160, imc: 23 });
    expect(o.estrategia.deficit).toBe(0);
    expect(o.protMin).toBe(0.8);
  });

  it("7 cancer (override): -300, protMin 1.5, pesoCalculo = peso (rama cancer)", () => {
    const o = proto({ fenotipo: "F8", dx: ["Cáncer de mama"], peso: 72, talla: 160, imc: 28 });
    expect(o.tieneCancer).toBe(true);
    expect(o.estrategia.deficit).toBe(-300);
    expect(o.protMin).toBe(1.5);
    expect(o.pesoCalculoLabel).toContain("IRC/Cáncer");
  });

  it("8 obSarco (F6): +500, protMin 1.2, Prealbumina + Leucina", () => {
    const o = proto({ fenotipo: "F6", obSarco: true, peso: 84, talla: 160, imc: 33 });
    expect(o.estrategia.deficit).toBe(500);
    expect(o.protMin).toBe(1.2);
    expect(N(o.examenes)).toContain("Prealbúmina");
    expect(N(o.suplementacion)).toContain("Leucina/BCAA");
  });

  it("9 IRC PRECEDE (sobre el fenotipo): protMin 0.6/0.8, peso actual, restr+examenes renales", () => {
    const o = proto({ fenotipo: "F2", dx: ["Enfermedad renal crónica"], peso: 77, talla: 160, imc: 30 });
    expect(o.tieneIRC).toBe(true);
    expect([o.protMin, o.protMax]).toEqual([0.6, 0.8]); // IRC gana sobre F2 (habria sido 0.8/1.2)
    expect(o.pesoCalculoLabel).toContain("IRC/Cáncer");
    expect(N(o.restricciones)).toEqual(expect.arrayContaining(["Proteína", "Fósforo", "Potasio"]));
    expect(N(o.examenes)).toEqual(expect.arrayContaining(["Creatinina sérica", "TFG estimada", "BUN"]));
  });

  it("10 HTA + DM: restr Sodio + CHO simples, HbA1c prioridad alta", () => {
    const o = proto({ fenotipo: "F8", hta: true, dx: ["Diabetes tipo 2"], imc: 24 });
    expect([o.tieneHTA, o.tieneDM]).toEqual([true, true]);
    expect(N(o.restricciones)).toEqual(expect.arrayContaining(["Sodio", "CHO simples"]));
    expect(o.examenes.find((e) => e.nombre === "HbA1c")?.prioridad).toBe("alta");
  });

  it("11 iae>5: examen Telomeros + suplemento CoQ10", () => {
    const o = proto({ fenotipo: "F8", iae: 6, imc: 23 });
    expect(N(o.examenes)).toContain("Telómeros/estrés oxidativo");
    expect(N(o.suplementacion)).toContain("Coenzima Q10");
  });

  it("12 MCA_dif<-1 + iehh>1: suplemento Zinc + Omega-3", () => {
    const o = proto({ fenotipo: "F8", mcaDif: -2, iehh: 1.5, imc: 24 });
    expect(N(o.suplementacion)).toEqual(expect.arrayContaining(["Zinc", "Omega-3"]));
  });

  it("13 sector S9: suplemento Omega-3 (el otro disparador del mismo item)", () => {
    const o = proto({ fenotipo: "F8", sector: "S9", imc: 24 });
    expect(N(o.suplementacion)).toContain("Omega-3");
  });

  // Alerta de realimentacion: la de mayor peso clinico. Positivo + 3 negativos (cada uno con un
  // solo factor fuera de rango), para que un falso positivo cronico tampoco pase.
  it("14 realimentacion POSITIVO: F10 + GEB 1100 + imc 17 -> alerta true", () => {
    expect(proto({ fenotipo: "F10", peso: 44, talla: 160, imc: 17, geb: 1100 }).alertaSindRealim).toBe(true);
  });
  it("14b negativo (solo GEB alto): F10 + GEB 1300 + imc 17 -> false", () => {
    expect(proto({ fenotipo: "F10", peso: 44, talla: 160, imc: 17, geb: 1300 }).alertaSindRealim).toBe(false);
  });
  it("14c negativo (solo imc alto): F10 + GEB 1100 + imc 19 -> false", () => {
    expect(proto({ fenotipo: "F10", peso: 49, talla: 160, imc: 19, geb: 1100 }).alertaSindRealim).toBe(false);
  });
  it("14d negativo (solo fenotipo): F11 + GEB 1100 + imc 17 -> false", () => {
    expect(proto({ fenotipo: "F11", peso: 44, talla: 160, imc: 17, geb: 1100 }).alertaSindRealim).toBe(false);
  });
});
