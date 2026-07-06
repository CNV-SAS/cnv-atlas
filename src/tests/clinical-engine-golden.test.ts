// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN TESTS del motor clinico ANI-BIS-E (B11, regla dura 6). Candado de paridad:
// anclan la cadena (import Biody -> normalizacion -> ciencia CONGELADA) a los valores
// del export REAL de Juan Esteban. Portados de las 3 suites de Gildardo; corren en la
// suite normal (src/**). El fixture del Biody esta ANONIMIZADO (sin PII): el motor solo
// usa columnas numericas + Género, asi que el oro es identico.
//
// Tolerancia 1e-3 (definida por Gildardo, aceptada tal cual).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";

import {
  analizarDesdeBiody,
  analizarDFI,
  calcLE8,
  ClinicalInputError,
  normalizeSexo,
  RUTA_COND,
  rutasPorCondicion,
} from "@/clinical-engine/analysis";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import encJson from "./fixtures/clinical-engine/encuesta-sintetica.json";
import goldenJson from "./fixtures/clinical-engine/dfi-golden.json";

const biody = biodyJson as Record<string, unknown>;
const enc = encJson as Record<string, unknown>;
const golden = goldenJson as {
  le8: number;
  dominios: Array<{ id: string; sev: number }>;
  riesgo: { l: string; score: number };
  veto: boolean;
  rutas: string[];
};
const sexoBiody = biody["Género "];

const near = (a: number | null, b: number, eps = 1e-3) =>
  a != null && Math.abs(a - b) <= eps;

describe("ANI-BIS-E · Golden Juan Esteban (export real, anonimizado)", () => {
  const r = analizarDesdeBiody(biody, sexoBiody);

  it('normaliza el sexo del Biody ("Male") a canonico', () => {
    expect(r.sexo).toBe("M");
  });

  it("indices BIS coinciden con la ciencia congelada", () => {
    expect(near(r.indices.IFC, 5.3651)).toBe(true);
    expect(near(r.indices.IRC, 1.8218)).toBe(true);
    expect(near(r.indices.PABU, 1.9925)).toBe(true);
    expect(near(r.indices.FMI, 6.369)).toBe(true);
    expect(near(r.indices.FFMI, 21.1)).toBe(true);
  });

  it("clasificaciones clinicas correctas", () => {
    expect(r.clases.IFC.l).toBe("Alerta funcional");
    expect(r.clases.IRC.l).toBe("Riesgo moderado");
    expect(r.clases.PABU.l).toBe("Desviación leve");
    expect(r.clases.FMI.l).toBe("Alto SS");
    expect(r.clases.FFMI.l).toBe("Normal");
  });

  it("fenotipo EFR y recomendacion bloqueados", () => {
    expect(r.fenotipoEFR.key).toBe("N_N_N_A");
    expect(r.fenotipoEFR.dx).toBe(
      "Composición saludable con grasa alta → riesgo de progresión",
    );
    expect(r.fenotipoEFR.nutraceuticos).toBe(
      "BERBERINA METABO, OMEGA COMPLEX, MULTI-CELL BASE",
    );
  });
});

describe("ANI-BIS-E · fallar en voz alta (proteccion anti-caos)", () => {
  it("rechaza sexo desconocido en vez de adivinar", () => {
    expect(() => normalizeSexo("X")).toThrow(ClinicalInputError);
  });

  it("rechaza un Excel al que le falta una columna del motor", () => {
    const roto = { ...biody };
    delete roto["Infinite resistance "]; // Rinf: sin el, IFC seria basura
    expect(() => analizarDesdeBiody(roto, "Male")).toThrow(ClinicalInputError);
  });
});

describe("ANI-BIS-E fase 2 · indices secundarios (datos reales)", () => {
  const sin = analizarDesdeBiody(biody, sexoBiody);
  const con = analizarDesdeBiody(biody, sexoBiody, { icec: 58.578, edad: 54.628 });

  it("ISCM-BIS anclado al Excel real (con el FIX de FMI: -2.072, no -1.568)", () => {
    expect(near(sin.indices.ISCM, -2.072)).toBe(true);
    expect(sin.clases.ISCM?.l).toBe("ISCM-1 Bajo riesgo");
  });

  it("IEHH anclado al Excel real", () => {
    expect(near(sin.indices.IEHH, 0.151)).toBe(true);
    expect(sin.clases.IEHH?.l).toBe("Leve");
  });

  it("EB-BIS/IAE = null sin encuesta (no se inventa edad biologica)", () => {
    expect(sin.indices.EB_BIS).toBeNull();
    expect(sin.indices.IAE).toBeNull();
  });

  it("EB-BIS/IAE con ICEC sintetico documentado (media 58.578)", () => {
    expect(near(con.indices.EB_BIS, 42.7)).toBe(true);
    expect(near(con.indices.IAE, -11.9)).toBe(true);
    expect(con.clases.IAE?.l).toBe("Desacelerado");
  });
});

describe("ANI-BIS-E fase 2 · condiciones de ruta (predicados)", () => {
  it("R2 se activa por composicion/antropometria aunque ISCM sea bajo", () => {
    const d = {
      ifc: 5.3651,
      IRC: 1.8218,
      FMI: 6.369,
      FFMI: 21.1,
      ISCM: -2.072,
      sexo: "M",
      ICC: 0.933,
      ICT: 0.544,
      IR: 0.798,
      iae: 0,
    };
    expect(RUTA_COND.R2(d)).toBe(true);
    expect(rutasPorCondicion(d)).toContain("R2");
  });

  it("R1 exige IFC bajo + IRC alto + IAE acelerado simultaneos", () => {
    expect(RUTA_COND.R1({ ifc: 3.0, IRC: 4.0, iae: 8 })).toBe(true);
    expect(RUTA_COND.R1({ ifc: 3.0, IRC: 4.0, iae: 0 })).toBe(false);
  });

  it("R3 (TCA) es puramente de ENCUESTA", () => {
    expect(RUTA_COND.R3({ d2_21: ["Vómito"] })).toBe(true);
    expect(RUTA_COND.R3({ d2_20: "Muy insatisfecho/a" })).toBe(true);
    expect(RUTA_COND.R3({ d2_21: [] })).toBe(false);
  });
});

describe("ANI-BIS-E fase 2b · DFI (BIS real + encuesta sintetica)", () => {
  const r = analizarDFI(biody, enc);

  it("LE8/ICEC reproduce el golden", () => {
    expect(r.le8.total).toBe(golden.le8);
    expect(calcLE8(enc).total).toBe(golden.le8);
  });

  it("severidad de los 5 dominios bloqueada", () => {
    const sev = r.domains.map((d) => ({ id: d.id, sev: d.sev }));
    expect(sev).toEqual(golden.dominios);
  });

  it("riesgo integrado y veto bloqueados", () => {
    expect(r.riesgo.l).toBe(golden.riesgo.l);
    expect(r.riesgo.score).toBe(golden.riesgo.score);
    expect(r.veto).toBe(golden.veto);
  });

  it("rutas AUTORITATIVAS (del DFI, no del predicado suelto) bloqueadas", () => {
    expect(r.rutas).toEqual(golden.rutas);
  });
});
