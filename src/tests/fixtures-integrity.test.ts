import { readFileSync } from "node:fs";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import biodyGold from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// Candado de las RAREZAS del export real de Biody que motivan la regla de normalizacion del
// motor: el sexo llega en ingles ("Male", no "Masculino") y ciertos antropometricos llegan
// en null (pecho/biceps/muslos, caso del atleta). Si un dia se "limpia" un fixture y se
// pierden, el borde de normalizacion (normalizeSexo; antropometricos null tolerados) deja de
// estar ejercido. Este test las fija en los DOS fixtures, cada uno con su rol (ver
// fixtures/README.md):
//   - biody_synthetic.xlsx: valores placeholder, protege la ESTRUCTURA para el import (B8).
//   - biody-juan-esteban-anon.json: valores reales, alimenta el MOTOR (golden + golden-path).

const SEX_HEADER = "Género";
const NULL_ANTHRO = ["Chest Size cm", "Biceps Size cm", "Thighs Size cm"];

// Busca un valor por header ignorando espacios sobrantes (los headers de Biody los traen).
function byTrimmedHeader(record: Record<string, unknown>, header: string): unknown {
  const key = Object.keys(record).find((k) => k.trim() === header);
  return key === undefined ? undefined : record[key];
}

describe("integridad de fixtures BIS (rarezas del export real)", () => {
  it("gold real (JSON, alimenta el motor): sexo 'Male' y antropometricos null", () => {
    const gold = biodyGold as Record<string, unknown>;
    expect(byTrimmedHeader(gold, SEX_HEADER)).toBe("Male");
    for (const h of NULL_ANTHRO) {
      expect(byTrimmedHeader(gold, h)).toBeNull();
    }
  });

  it("sintetico (XLSX, prueba el import): sexo 'Male' y antropometricos vacios", async () => {
    const buf = readFileSync(new URL("./fixtures/biody_synthetic.xlsx", import.meta.url));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    const headers = ws.getRow(1).values as ExcelJS.CellValue[];
    const values = ws.getRow(2).values as ExcelJS.CellValue[];
    const record: Record<string, unknown> = {};
    for (let i = 1; i < headers.length; i++) {
      if (headers[i] != null) record[String(headers[i])] = values[i] ?? null;
    }
    expect(byTrimmedHeader(record, SEX_HEADER)).toBe("Male");
    for (const h of NULL_ANTHRO) {
      // En el XLSX una celda vacia llega como null/undefined; ambas cuentan como "sin dato".
      expect(byTrimmedHeader(record, h) ?? null).toBeNull();
    }
  });
});
