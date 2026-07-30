import { describe, expect, it } from "vitest";

import type { EngineIndicators } from "@/clinical-engine";
import { indicatorRange } from "@/modules/diagnoses/data/indicator-ranges";

// Rangos de referencia + delta transcritos verbatim del HTML de Gildardo (2026-07-30). Ancla los
// casos representativos: rango de dos limites (AF), un solo limite (IR), delta = valor (ICA-BIS), y
// EB (referencia "-" porque la edad no se sella; delta = IAE). Valores del donante golden Juan Esteban.

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

describe("indicatorRange (transcripcion verbatim del HTML)", () => {
  it("AF (M) 5,8: rango de dos limites '6.5–7.0°', delta contra el borde inferior", () => {
    expect(indicatorRange("AF", ind, true)).toEqual({ reference: "6.5–7.0°", delta: "-0.70" });
  });

  it("IR (M) 0,798: un solo limite '<0.78' (no se inventa el otro extremo)", () => {
    expect(indicatorRange("IR", ind, true)).toEqual({ reference: "<0.78", delta: "0.018" });
  });

  it("IFC 5,3651: delta contra el borde inferior 3.5", () => {
    expect(indicatorRange("IFC", ind, true)?.delta).toBe("1.87");
  });

  it("ICA-BIS: referencia de punto 'φ = 1.618', delta = el valor mismo", () => {
    expect(indicatorRange("ICA-BIS", ind, true)).toEqual({ reference: "φ = 1.618", delta: "0.3745" });
  });

  it("EB: referencia '—' (edad no sellada en el snapshot), delta = IAE", () => {
    expect(indicatorRange("EB", ind, true)).toEqual({ reference: "—", delta: "-17.6" });
  });
});
