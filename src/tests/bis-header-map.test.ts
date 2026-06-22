import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";

import { classifyHeaders, normalizeHeader } from "@/modules/bis/services/header-map";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "biody_synthetic.xlsx");

describe("normalizeHeader", () => {
  it("recorta y colapsa espacios", () => {
    expect(normalizeHeader("  Peso   kg ")).toBe("Peso kg");
  });

  it("traduce los tokens internos de BiodyLife a sufijos legibles", () => {
    expect(normalizeHeader("Masa magra measurementDetails.VALEURCALCULEEEXPORT kg")).toBe(
      "Masa magra valor kg",
    );
    expect(normalizeHeader("Masa magra measurementDetails.REFERENCEESTIMEEEXPORT kg")).toBe(
      "Masa magra referencia kg",
    );
    expect(normalizeHeader("Masa magra measurementDetails.ECARTTHEORIQUEEXPORT kg")).toBe(
      "Masa magra desviacion kg",
    );
  });

  it("no colapsa columnas que solo difieren por el token (preserva la distincion)", () => {
    const a = normalizeHeader("Agua total measurementDetails.VALEURCALCULEEEXPORT L");
    const b = normalizeHeader("Agua total measurementDetails.REFERENCEESTIMEEEXPORT L");
    expect(a).not.toBe(b);
  });
});

describe("classifyHeader (roles)", () => {
  it("excluye PII dura: nombre y fecha de nacimiento", () => {
    const [nombre, fnac] = classifyHeaders(["Paciente ", "Fecha de nacimiento "]);
    expect(nombre.role).toBe("pii");
    expect(nombre.variableName).toBeNull();
    expect(fnac.role).toBe("pii");
  });

  it("marca metadata no clinica e ids tecnicos", () => {
    const roles = classifyHeaders([
      "# ",
      "Identifiant de la mesure ",
      "Género ",
      "Estatus ",
      "Nombre de la aplicación ",
    ]).map((c) => c.role);
    expect(roles.every((r) => r === "metadata")).toBe(true);
  });

  it("identifica la fecha de medicion", () => {
    const [d] = classifyHeaders(["Measurement date "]);
    expect(d.role).toBe("measurement_date");
  });

  it("clasifica las clinicas numericas como variable con nombre provisional", () => {
    const [r] = classifyHeaders(["Resistencia a 50khz Ohm"]);
    expect(r.role).toBe("variable");
    expect(r.variableName).toBe("Resistencia a 50khz Ohm");
  });

  it("trata el encabezado vacio como metadata (se ignora)", () => {
    const [empty] = classifyHeaders([""]);
    expect(empty.role).toBe("metadata");
  });
});

describe("clasificacion sobre la estructura real (fixture sintetico)", () => {
  let headers: string[];

  beforeAll(async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(FIXTURE);
    const ws = wb.getWorksheet("Measures")!;
    const values = ws.getRow(1).values as (string | undefined)[];
    headers = [];
    for (let i = 1; i < values.length; i++) headers.push(String(values[i] ?? ""));
  });

  it("el fixture trae los 180 encabezados", () => {
    expect(headers).toHaveLength(180);
  });

  it("excluye el nombre y la fecha de nacimiento de las variables", () => {
    const classes = classifyHeaders(headers);
    const variableHeaders = classes
      .filter((c) => c.role === "variable")
      .map((c) => c.normalized);
    expect(variableHeaders).not.toContain("Paciente");
    expect(variableHeaders).not.toContain("Fecha de nacimiento");
    expect(classes.some((c) => c.role === "pii")).toBe(true);
  });

  it("produce nombres de variable unicos (sin colisiones que pierdan datos)", () => {
    const names = classifyHeaders(headers)
      .filter((c) => c.role === "variable")
      .map((c) => c.variableName as string);
    expect(names.length).toBeGreaterThan(50); // el export trae decenas de variables
    expect(new Set(names).size).toBe(names.length);
  });
});
