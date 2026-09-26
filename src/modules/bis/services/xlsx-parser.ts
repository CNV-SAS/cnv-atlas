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

// ═══ LA HOJA DE MEDIDAS SE ELIGE POR SU CONTENIDO, NO POR SU NOMBRE (Santiago, 2026-09-25) ═══
//
// EL BIODY MANAGER EXPORTA DE TRES FORMAS, y hasta hoy Atlas solo aceptaba una. Al mirar los tres archivos:
//
//   1 · "Exportar medidas"                -> una hoja `Measures` con 117 columnas. La que funcionaba.
//   2 · "Exportar datos del paciente"     -> una hoja `Patients` con 28 columnas y NINGUNA medicion. No sirve,
//                                            y no es cosa nuestra: el archivo no trae los datos.
//   3 · Las dos juntas                    -> `Patients` + una segunda hoja con las MISMAS 117 columnas... pero
//                                            LLAMADA CON EL NOMBRE DEL PACIENTE ("Nicolas Granada Ramirez").
//
// O sea que el archivo 3 SIEMPRE fue utilizable y lo rechazabamos por el nombre de la hoja. Buscarla por
// nombre no tiene arreglo posible (el nombre es el del paciente, distinto en cada archivo), asi que se busca
// por su HUELLA: las columnas de bioimpedancia, que la hoja de pacientes no tiene ni puede tener.
//
// LA HUELLA SON POCAS Y DE LAS QUE NO SE VAN A IR: la fecha de la medicion (sin ella no hay medicion) y dos
// columnas de impedancia (sin ellas no hay bioimpedancia). No se usa la lista entera de columnas requeridas a
// proposito: si el motor pide una columna mas, eso NO debe cambiar que hojas se reconocen, solo si la medicion
// esta completa, y eso lo juzga la validacion despues con su propio mensaje.
const HUELLA_DE_LA_HOJA_DE_MEDIDAS = ["Measurement date", "Z50 Ohm", "Resistencia a 50khz Ohm"];

/** Nombre de la hoja de PACIENTES del Biody. Sirve para decir con precision por que un archivo no sirve. */
const HOJA_DE_PACIENTES = "Patients";

const encabezadosDe = (ws: ExcelJS.Worksheet): string[] => {
  const fila = ws.getRow(1).values as ExcelJS.CellValue[];
  const out: string[] = [];
  for (let i = 1; i < fila.length; i++) out.push(cellToHeader(fila[i]).trim());
  return out;
};

const pareceHojaDeMedidas = (ws: ExcelJS.Worksheet): boolean => {
  const encabezados = new Set(encabezadosDe(ws));
  return HUELLA_DE_LA_HOJA_DE_MEDIDAS.every((h) => encabezados.has(h));
};

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
    return err(appError("validation", "El archivo no se pudo leer como un XLSX válido."));
  }

  // Primero por nombre (el caso normal y el mas barato), y si no, por huella.
  const worksheet =
    workbook.getWorksheet(BIS_SHEET_NAME) ?? workbook.worksheets.find((ws) => pareceHojaDeMedidas(ws));

  if (!worksheet) {
    // EL MENSAJE DICE QUE ARCHIVO ES ESTE Y CUAL HACE FALTA. Antes decia 'no contiene la hoja "Measures"', que
    // le pide al profesional que sepa como se llaman las hojas de un archivo que no abrio: no hay nada que
    // pueda hacer con esa frase. Ahora, cuando el archivo es el de datos del paciente, se le nombra.
    const soloPacientes = workbook.worksheets.some((ws) => ws.name === HOJA_DE_PACIENTES);
    return err(
      appError(
        "validation",
        soloPacientes
          ? "Este archivo es el de “Exportar datos del paciente”, y no trae ninguna medición. Vuelve al Biody Manager y exporta con “Exportar medidas” marcada (sola o junto con los datos del paciente); ese archivo sí sirve."
          : "El archivo no trae una hoja con mediciones de bioimpedancia. Tiene que ser un export de medidas del Biody Manager.",
      ),
    );
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
