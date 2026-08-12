import { describe, expect, it } from "vitest";

import { BIODY_COLUMNS } from "@/clinical-engine";
import { deriveMissingComposition } from "@/modules/bis/services/derive-composition";
import { normalizeHeader } from "@/modules/bis/services/header-map";

import zm3 from "./fixtures/clinical-engine/biody-hombre-zm3-anon.json";

// Helper de derivacion de composicion (EA1 checkpoint 2). Prueba dos invariantes que Santiago pidio
// verificar EJECUTANDO: (1) un export COMPLETO no cambia en nada (cero filas derivadas), y (2) sobre un
// export corto (simulado borrando la composicion del ZM3) se reconstruyen los huecos, ancladas contra
// lo que MIDIO el equipo. No pisa lo medido: IR/ACT_MLG que quedan presentes no se reemiten.

// Crudos MEDIDOS por header NORMALIZADO (como se guardan en bis_raw_values).
function measuredFromZm3(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const [k, v] of Object.entries(zm3 as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) m[normalizeHeader(k)] = v;
  }
  return m;
}

// Valor derivado de un campo de contrato (por su header normalizado), o undefined si no se emitio.
function emitted(
  derived: { variableName: string; value: number }[],
  field: string,
): number | undefined {
  const header = normalizeHeader(BIODY_COLUMNS[field].header);
  return derived.find((d) => d.variableName === header)?.value;
}

describe("deriveMissingComposition", () => {
  it("export COMPLETO (ZM3): no deriva nada, no cambia ni una fila", () => {
    const derived = deriveMissingComposition(measuredFromZm3());
    expect(derived).toEqual([]);
  });

  describe("export corto (ZM3 sin la composicion derivable)", () => {
    // Campos que el export corto omite (los reconstruye la derivacion). IR y ACT_MLG se DEJAN presentes
    // a proposito, para probar que un valor medido no se reemite.
    const DERIVABLES = [
      "FFW",
      "ECW_sg",
      "ICW_sg",
      "MCA",
      "protActiva",
      "hidSG",
      "smmW",
      "ECM_BCM",
      "icc",
      "ict",
    ];
    const full = measuredFromZm3();
    const short: Record<string, number> = { ...full };
    for (const f of DERIVABLES) delete short[normalizeHeader(BIODY_COLUMNS[f].header)];
    const derived = deriveMissingComposition(short);

    it("reconstruye cada hueco de composicion", () => {
      for (const f of DERIVABLES) {
        expect(emitted(derived, f), `${f} derivado`).toBeTypeOf("number");
      }
    });

    it("cada valor derivado coincide con lo que midio el equipo (paridad, tol 0,5%)", () => {
      for (const f of DERIVABLES) {
        const der = emitted(derived, f) as number;
        const med = full[normalizeHeader(BIODY_COLUMNS[f].header)];
        const rel = Math.abs(der - med) / Math.max(1e-9, Math.abs(med));
        expect(rel, `${f}: derivado ${der} vs medido ${med} (rel ${rel.toFixed(5)})`).toBeLessThan(
          0.005,
        );
      }
    });

    it("icc = cintura/cadera, ict = cintura/talla (de las circunferencias medidas)", () => {
      // ZM3 hombre: cintura 124, cadera 120, talla 169. icc=1.0333, ict=0.7337.
      expect(emitted(derived, "icc")).toBeCloseTo(124 / 120, 3);
      expect(emitted(derived, "ict")).toBeCloseTo(124 / 169, 3);
    });

    it("no pisa lo medido: IR y ACT_MLG (presentes) no se reemiten", () => {
      expect(emitted(derived, "IR")).toBeUndefined();
      expect(emitted(derived, "ACT_MLG")).toBeUndefined();
    });

    it("no persiste indices sin columna de contrato (ei, aec_mca, ECM)", () => {
      const headers = new Set(derived.map((d) => d.variableName));
      // Estos los calcula el frozen pero no tienen header en BIODY_COLUMNS: no deben aparecer.
      expect(headers.has("ei")).toBe(false);
      expect(headers.has("aec_mca")).toBe(false);
      expect(headers.has("ECM")).toBe(false);
    });
  });

  describe("referencias poblacionales (§9): MCA_ref, hidSG_ref, MCA_dif", () => {
    it("export COMPLETO (ZM3) con sexo: no deriva referencias (el equipo ya las trajo)", () => {
      // care (a): un export completo trae MCA_ref/hidSG_ref/MCA_dif como medidos, no se derivan.
      expect(deriveMissingComposition(measuredFromZm3(), "M")).toEqual([]);
    });

    it("sin sexo no deriva referencias (quedan ausentes, ISCM null honesto)", () => {
      const full = measuredFromZm3();
      const short: Record<string, number> = { ...full };
      for (const f of ["MCA_ref", "hidSG_ref", "MCA_dif", "MCA"]) {
        delete short[normalizeHeader(BIODY_COLUMNS[f].header)];
      }
      const derived = deriveMissingComposition(short); // sin sexo
      expect(emitted(derived, "MCA_ref")).toBeUndefined();
      expect(emitted(derived, "hidSG_ref")).toBeUndefined();
    });

    it("con sexo y referencias ausentes: MCA_ref = 52,4% de la MLG de REFERENCIA (peso x %grasa-ref)", () => {
      const full = measuredFromZm3();
      const short: Record<string, number> = { ...full };
      for (const f of ["MCA_ref", "hidSG_ref", "MCA_dif"]) {
        delete short[normalizeHeader(BIODY_COLUMNS[f].header)];
      }
      const peso = short[normalizeHeader(BIODY_COLUMNS.peso.header)];
      const derived = deriveMissingComposition(short, "M");
      const ffmRef = (peso * (100 - 17.5)) / 100; // hombre: 17,5% grasa de referencia
      const mcaRefEsperado = parseFloat((ffmRef * 52.4 / 100).toFixed(2));
      expect(emitted(derived, "MCA_ref")).toBeCloseTo(mcaRefEsperado, 2);
      expect(emitted(derived, "hidSG_ref")).toBe(73.2);
    });

    it("coherencia de Gildardo: MLG de referencia 58,5 kg -> MCA_ref 30,65 kg (52,4%)", () => {
      // 58,5 = peso x (100-17,5)/100  ->  peso = 58,5 / 0,825 = 70,909...
      const peso = 58.5 / 0.825;
      const short: Record<string, number> = {
        [normalizeHeader(BIODY_COLUMNS.peso.header)]: peso,
      };
      const derived = deriveMissingComposition(short, "M");
      expect(emitted(derived, "MCA_ref")).toBeCloseTo(30.65, 2);
    });

    it("MCA_dif puede ser NEGATIVO (deficit celular real): no se descarta como no-fisico", () => {
      // Peso alto (MLG_ref alta -> MCA_ref alta) con MCA medida baja: MCA - MCA_ref < 0. Debe emitirse.
      const short: Record<string, number> = {
        [normalizeHeader(BIODY_COLUMNS.peso.header)]: 90,
        [normalizeHeader(BIODY_COLUMNS.MCA.header)]: 20, // MCA baja frente a su referencia
      };
      const derived = deriveMissingComposition(short, "M");
      const mcaDif = emitted(derived, "MCA_dif");
      expect(mcaDif).toBeTypeOf("number");
      expect(mcaDif as number).toBeLessThan(0);
    });
  });

  it("no persiste un derivado no-fisico (negativo): mejor vacio que basura", () => {
    // FFW = ACT - 0,15*FM. Con FM enorme y ACT minima, la identidad da negativo: no debe emitirse.
    const measured: Record<string, number> = {
      [normalizeHeader(BIODY_COLUMNS.TBW.header)]: 1, // ACT
      [normalizeHeader(BIODY_COLUMNS.FM.header)]: 100, // FM -> FFW = 1 - 15 = -14
    };
    const derived = deriveMissingComposition(measured);
    expect(emitted(derived, "FFW")).toBeUndefined();
  });
});
