import ExcelJS from "exceljs";

import { appError, err, ok, type Result } from "@/core/errors";

import type { CellValue, ParsedRow, ParsedSheet } from "../types";

// Parser del export XLSX de Biody Manager, aislado tras esta interfaz para poder
// cambiar de libreria sin tocar la logica de validacion ni de persistencia. Solo
// lee: nunca renderiza una celda como HTML (la celda es entrada no confiable).
//
// Reparto de responsabilidades con la validacion: aqui solo se decide si el archivo
// es ESTRUCTURALMENTE un export de la hoja "Measures" (fallo -> parse_failed). La
// calidad de los datos (rangos, fecha, una sola medicion) la juzga import-schema
// (fallo -> validation_failed).

export const BIS_SHEET_NAME = "Measures";

// Reduce cualquier forma de celda de exceljs (numero, texto, fecha, formula, rich
// text, hipervinculo, error) al valor neutral CellValue. Defensivo: nunca lanza.
function normalizeCellValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return null; // booleanos no son datos clinicos
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as unknown as Record<string, unknown>;
    if ("error" in obj) return null; // celda en error (#REF!, #DIV/0!, ...)
    if ("result" in obj) return normalizeCellValue(obj.result as ExcelJS.CellValue); // formula
    if (typeof obj.text === "string") return obj.text; // hipervinculo
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text?: string }[]).map((t) => t.text ?? "").join("");
    }
  }
  return null;
}

function cellToHeader(value: ExcelJS.CellValue): string {
  const v = normalizeCellValue(value);
  if (v === null) return "";
  return typeof v === "string" ? v : String(v);
}

export async function parseBisXlsx(input: Buffer | ArrayBuffer): Promise<Result<ParsedSheet>> {
  const workbook = new ExcelJS.Workbook();
  try {
    // load acepta Buffer o ArrayBuffer; casteamos al tipo exacto del parametro porque
    // el Buffer empacado de exceljs no coincide con el generico de @types/node.
    await workbook.xlsx.load(input as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    return err(appError("validation", "El archivo no se pudo leer como un XLSX valido."));
  }

  const worksheet = workbook.getWorksheet(BIS_SHEET_NAME);
  if (!worksheet) {
    return err(appError("validation", `El archivo no contiene la hoja "${BIS_SHEET_NAME}".`));
  }

  // getRow(n).values es un arreglo 1-based con [0] vacio. Construimos los encabezados
  // preservando la posicion para alinear despues cada celda con su columna.
  const headerValues = worksheet.getRow(1).values as ExcelJS.CellValue[];
  const headers: string[] = [];
  for (let i = 1; i < headerValues.length; i++) {
    headers.push(cellToHeader(headerValues[i]));
  }
  if (headers.length === 0 || headers.every((h) => h === "")) {
    return err(appError("validation", "El archivo no tiene fila de encabezados."));
  }

  const dataRows: ParsedRow[] = [];
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const rowValues = worksheet.getRow(r).values as ExcelJS.CellValue[];
    const cells = headers.map((header, idx) => ({
      header,
      value: normalizeCellValue(rowValues[idx + 1]),
    }));
    if (cells.every((c) => c.value === null)) continue; // omite filas vacias
    dataRows.push({ rowNumber: r, cells });
  }
  if (dataRows.length === 0) {
    return err(appError("validation", "El archivo no contiene filas de datos."));
  }

  return ok({ sheetName: worksheet.name, headers, dataRows });
}
