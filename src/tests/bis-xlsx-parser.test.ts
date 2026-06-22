import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { BIS_SHEET_NAME, parseBisXlsx } from "@/modules/bis/services/xlsx-parser";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "biody_synthetic.xlsx");

async function readFixtureBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FIXTURE);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

// Construye un xlsx en memoria con la hoja y filas indicadas, para los casos negativos.
async function makeWorkbookBuffer(
  sheetName: string,
  rows: (string | number)[][],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("parseBisXlsx", () => {
  it("parsea el export sintetico: hoja Measures, 180 encabezados, una fila de datos", async () => {
    const res = await parseBisXlsx(await readFixtureBuffer());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.sheetName).toBe(BIS_SHEET_NAME);
    expect(res.value.headers).toHaveLength(180);
    expect(res.value.dataRows).toHaveLength(1);
    // las celdas quedan alineadas a sus encabezados
    const peso = res.value.dataRows[0].cells.find((c) => c.header.trim() === "Peso kg");
    expect(peso?.value).toBe(70);
  });

  it("rechaza bytes que no son un XLSX (parse_failed)", async () => {
    const res = await parseBisXlsx(Buffer.from("esto no es un xlsx"));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe("validation");
    expect(res.error.message).toContain("XLSX");
  });

  it("rechaza un archivo sin la hoja Measures", async () => {
    const buf = await makeWorkbookBuffer("Otra", [["a", "b"], [1, 2]]);
    const res = await parseBisXlsx(buf);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain(BIS_SHEET_NAME);
  });

  it("rechaza una hoja Measures sin filas de datos (solo encabezados)", async () => {
    const buf = await makeWorkbookBuffer(BIS_SHEET_NAME, [["Measurement date ", "Peso kg"]]);
    const res = await parseBisXlsx(buf);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.message).toContain("filas de datos");
  });
});
