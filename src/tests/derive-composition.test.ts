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
});
