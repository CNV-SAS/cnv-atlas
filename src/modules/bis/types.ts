// Tipos del modulo BIS (bioimpedancia). El import del export XLSX de Biody Manager
// es la frontera de confianza critica (SECURITY.md): el parseo produce estructuras
// neutrales y la validacion decide que se persiste. El motor clinico no vive aqui.

// Valor de celda ya normalizado por el parser: numero, texto o ausente. exceljs
// puede devolver formulas, rich text, hipervinculos o fechas; todo se reduce a esto.
export type CellValue = number | string | null;

// Una fila de datos del export, con sus celdas alineadas a los encabezados.
export type ParsedRow = {
  rowNumber: number; // fila real en la hoja (>=2; la 1 son encabezados)
  cells: { header: string; value: CellValue }[];
};

// La hoja "Measures" ya leida y normalizada, antes de validar.
export type ParsedSheet = {
  sheetName: string;
  headers: string[];
  dataRows: ParsedRow[];
};

// Rol de un encabezado (header-map). Decide el destino del dato:
// - pii: identifica a la persona; NUNCA se persiste ni sale del servidor.
// - metadata: ruido no clinico (ids, app, estatus, categoricos); se ignora.
// - measurement_date: alimenta bis_measurements.measurement_date.
// - variable: variable clinica numerica; va a bis_raw_values (nombre+valor).
export type HeaderRole = "pii" | "metadata" | "measurement_date" | "variable";

export type HeaderClassification = {
  rawHeader: string;
  normalized: string;
  role: HeaderRole;
  // Nombre canonico PROVISIONAL (= encabezado normalizado) para las variables; null
  // en los demas roles. El mapeo canonico definitivo llega con el motor (B11).
  variableName: string | null;
};

// Una variable clinica lista para persistir como par nombre+valor.
export type BisRawValue = { variableName: string; value: number };

// Resultado de validar y extraer una medicion del export.
export type ExtractedMeasurement = {
  measurementDate: Date;
  values: BisRawValue[];
  /**
   * CUANTAS MEDICIONES TRAIA EL ARCHIVO, y cual se tomo (2026-10-06).
   *
   * Existe porque el export de "paciente + mediciones" del Biody Manager trae UNA FILA POR MEDICION, y antes
   * se rechazaba el archivo entero pidiendole al Integrante que borrara filas a mano. Ahora se toma la mas
   * reciente, Y SE DICE: la fecha de la medicion es un dato del registro clinico, no un detalle de la carga,
   * asi que no puede quedarse en un aviso que se va.
   *
   * `filasEnElArchivo` vale 1 en el caso normal, y entonces no hay nada que contar.
   */
  filasEnElArchivo: number;
  /** Las fechas de TODAS las mediciones del archivo (AAAA-MM-DD), de la mas reciente a la mas vieja. */
  fechasDisponibles: string[];
};
