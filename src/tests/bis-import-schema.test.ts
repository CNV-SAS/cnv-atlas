import { describe, expect, it } from "vitest";

import {
  MEASUREMENT_DATE_HEADER,
  parseBiodyDate,
  PHYSIOLOGICAL_RANGES,
  validateBisMeasurement,
} from "@/modules/bis/validations/import-schema";
import type { CellValue, ParsedSheet } from "@/modules/bis/types";

// Construye una hoja parseada de una sola fila a partir de pares [header, value].
function sheet(cells: [string, CellValue][], rows = 1): ParsedSheet {
  const headers = cells.map((c) => c[0]);
  const dataRows = Array.from({ length: rows }, (_, k) => ({
    rowNumber: k + 2,
    cells: cells.map(([header, value]) => ({ header, value })),
  }));
  return { sheetName: "Measures", headers, dataRows };
}

// Base valida: fecha + suficientes variables en rango (supera MIN_VARIABLE_COLUMNS).
function validCells(): [string, CellValue][] {
  const base: [string, CellValue][] = [
    [MEASUREMENT_DATE_HEADER, "12-04-2026 19:18"],
    ["Paciente ", "PACIENTE SINTETICO"],
    ["Fecha de nacimiento ", "01-01-1990 00:00"],
    ["Peso kg", 70],
    ["Altura cm", 170],
    ["Ángulo de fase a 50 kHz °", 6.2],
  ];
  for (let i = 0; i < 12; i++) base.push([`Var ${i} u`, 10 + i]);
  return base;
}

describe("parseBiodyDate", () => {
  it("parsea DD-MM-YYYY HH:MM en UTC", () => {
    const d = parseBiodyDate("12-04-2026 19:18");
    expect(d?.toISOString()).toBe("2026-04-12T19:18:00.000Z");
  });

  it("parsea DD-MM-YYYY sin hora", () => {
    expect(parseBiodyDate("01-01-1990")?.toISOString()).toBe("1990-01-01T00:00:00.000Z");
  });

  it("rechaza fechas incoherentes y basura", () => {
    expect(parseBiodyDate("31-02-2026 00:00")).toBeNull(); // 31 de febrero no existe
    expect(parseBiodyDate("no es fecha")).toBeNull();
  });
});

describe("validateBisMeasurement", () => {
  it("extrae fecha y valores numericos, excluyendo PII", () => {
    const res = validateBisMeasurement(sheet(validCells()));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.measurementDate.toISOString()).toBe("2026-04-12T19:18:00.000Z");
    const names = res.value.values.map((v) => v.variableName);
    expect(names).toContain("Peso kg");
    expect(names).not.toContain("Paciente");
    expect(names).not.toContain("Fecha de nacimiento");
    expect(names).not.toContain(MEASUREMENT_DATE_HEADER);
  });

  it("omite celdas vacias y valores no numericos en columnas-variable", () => {
    const cells = validCells();
    cells.push(["Var texto u", "N/A"]); // no numerico: se omite
    cells.push(["Var vacia u", null]); // vacia: se omite
    const res = validateBisMeasurement(sheet(cells));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const names = res.value.values.map((v) => v.variableName);
    expect(names).not.toContain("Var texto u");
    expect(names).not.toContain("Var vacia u");
  });

  it("rechaza con detalle por variable cuando un valor sale del rango fisiologico", () => {
    // Peso imposible (9999 kg): fuera del rango curado [1, 500].
    const bad = validCells().map((c) =>
      c[0] === "Peso kg" ? (["Peso kg", 9999] as [string, CellValue]) : c,
    );
    const res = validateBisMeasurement(sheet(bad));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("validation");
    expect(res.error.fields?.["Peso kg"]).toBeDefined();
  });

  it("rechaza valores no finitos o absurdos via el limite global", () => {
    const bad = validCells().map((c) =>
      c[0] === "Var 0 u" ? (["Var 0 u", 5_000_000] as [string, CellValue]) : c,
    );
    const res = validateBisMeasurement(sheet(bad));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.fields?.["Var 0 u"]).toBeDefined();
  });

  it("exige la columna de fecha de medicion", () => {
    const noDate = validCells().filter((c) => c[0] !== MEASUREMENT_DATE_HEADER);
    const res = validateBisMeasurement(sheet(noDate));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain(MEASUREMENT_DATE_HEADER);
  });

  it("rechaza una fecha de medicion invalida", () => {
    const bad = validCells().map((c) =>
      c[0] === MEASUREMENT_DATE_HEADER ? ([MEASUREMENT_DATE_HEADER, "basura"] as [string, CellValue]) : c,
    );
    const res = validateBisMeasurement(sheet(bad));
    expect(res.ok).toBe(false);
  });

  it("rechaza si no hay exactamente una fila de medicion", () => {
    const res = validateBisMeasurement(sheet(validCells(), 2));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain("unica fila");
  });

  it("rechaza un archivo con muy pocas columnas de variables", () => {
    const few: [string, CellValue][] = [
      [MEASUREMENT_DATE_HEADER, "12-04-2026 19:18"],
      ["Peso kg", 70],
    ];
    const res = validateBisMeasurement(sheet(few));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain("pocas columnas");
  });

  it("los rangos curados son un subconjunto documentado (provisional)", () => {
    expect(Object.keys(PHYSIOLOGICAL_RANGES).length).toBeGreaterThan(0);
    expect(PHYSIOLOGICAL_RANGES["Peso kg"]).toEqual({ min: 1, max: 500 });
  });
});
