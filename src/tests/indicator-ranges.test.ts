import { describe, expect, it } from "vitest";

import type { EngineIndicators } from "@/clinical-engine";
import { indicatorRange } from "@/modules/diagnoses/data/indicator-ranges";

// Rangos de referencia (verbatim del HTML) + DELTA unificada de Gildardo (CA-2, opcion B): Δ = valor −
// referencia de normalidad (promedio del rango si dos bordes; el corte si uno). Ancla los casos
// representativos y, abajo, la REGRESION que Gildardo pide antes de publicar: el antes (HTML) y el
// despues (CA-2) sobre el donante golden Juan Esteban, para dejar por escrito que Δ cambian.

const ind = {
  ifc: 5.3651,
  irc: 1.8218,
  pabu: 1.9925,
  icaBis: 0.3745,
  iscm: -2.072,
  iehh: 0.5,
  iae: -17.6,
  eb: 36.4,
  FMI: 6.369,
  FFMI: 21.1,
  AF: 5.8,
  IR: 0.798,
} as unknown as EngineIndicators;

describe("indicatorRange (referencia verbatim + Δ unificada CA-2)", () => {
  it("AF (M) 5,8: rango '6.5–7.0°', Δ contra el PROMEDIO (6.75) = -0.95 (CA-2)", () => {
    expect(indicatorRange("AF", ind, true)).toEqual({ reference: "6.5–7.0°", delta: "-0.95" });
  });

  it("IR (M) 0,798: un solo limite '<0.78', Δ contra el corte = 0.018 (sin cambio)", () => {
    expect(indicatorRange("IR", ind, true)).toEqual({ reference: "<0.78", delta: "0.018" });
  });

  it("IFC/IRC/FMI: null (su referencia del HTML sale de dXXX, inconsistente con nuestro cXXX; Q20)", () => {
    expect(indicatorRange("IFC", ind, true)).toBeNull();
    expect(indicatorRange("IRC", ind, true)).toBeNull();
    expect(indicatorRange("FMI", ind, true)).toBeNull();
  });

  it("ICA-BIS: referencia de coherencia 0, Δ = el valor mismo (sin cambio)", () => {
    expect(indicatorRange("ICA-BIS", ind, true)).toEqual({ reference: "φ = 1.618", delta: "0.3745" });
  });

  it("EB: referencia '—' (edad no sellada en el snapshot), Δ = IAE", () => {
    expect(indicatorRange("EB", ind, true)).toEqual({ reference: "—", delta: "-17.6" });
  });
});

// REGRESION CA-2 (Gildardo la pide antes de publicar): sobre el donante golden, qué Δ cambian al pasar
// del comportamiento del HTML (borde clinicamente relevante por indicador) a la regla unificada
// (valor − referencia de normalidad). Se deja el ANTES en el nombre del caso y se assertan los valores
// NUEVOS. Cambian AF, ISCM y FFMI; el resto no (su referencia de normalidad ya coincidia).
describe("CA-2 · regresion Δ sobre el donante golden (antes HTML → despues CA-2)", () => {
  it("AF: -0.70 (borde inferior 6.5) → -0.95 (promedio 6.75)", () => {
    expect(indicatorRange("AF", ind, true)?.delta).toBe("-0.95");
  });

  it("ISCM: -2.07 (valor crudo, ref implicita 0) → -1.07 (corte -1)", () => {
    expect(indicatorRange("ISCM", ind, true)).toEqual({ reference: "≤−1", delta: "-1.07" });
  });

  it("FFMI: 4.10 (borde inferior 17) → 0.10 (promedio 21)", () => {
    expect(indicatorRange("FFMI", ind, true)).toEqual({ reference: "17–25", delta: "0.10" });
  });

  it("sin cambio: IR 0.018, ICA-BIS 0.3745, PABU 0.3745, IEHH 0.500, IAE -17.6", () => {
    expect(indicatorRange("IR", ind, true)?.delta).toBe("0.018");
    expect(indicatorRange("ICA-BIS", ind, true)?.delta).toBe("0.3745");
    expect(indicatorRange("PABU", ind, true)?.delta).toBe("0.3745");
    expect(indicatorRange("IEHH", ind, true)?.delta).toBe("0.500");
    expect(indicatorRange("IAE", ind, true)?.delta).toBe("-17.6");
  });
});
