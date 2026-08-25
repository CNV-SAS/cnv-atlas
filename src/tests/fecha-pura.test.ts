import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import { formatDate, formatDateOnly, formatDateOnlyShort } from "@/lib/format/date";

// CANDADO DE LAS FECHAS PURAS (2026-08-25). Una columna `date` NO ES UN INSTANTE: no tiene hora ni zona,
// asi que convertirla a una zona es un error de categoria. `new Date("2026-09-04")` se parsea como
// medianoche UTC y en Bogotá (UTC-5) retrocede al 3 de septiembre.
//
// Defecto real del smoke: se agendó la próxima cita el 4/9 y la historia clínica mostraba 3/9.

describe("formato de fechas puras", () => {
  it("NO retrocede un día: es el defecto que corrige", () => {
    expect(formatDateOnly("2026-09-04")).toBe("04/09/2026");
    expect(formatDateOnlyShort("2026-09-04")).toBe("4 sep 2026");
  });

  it("y se deja constancia de que el helper con zona SÍ lo hacía", () => {
    // Este test documenta la causa. Si algún día formatDate dejara de convertir, se puede revisar; hoy
    // convierte a propósito, porque para un TIMESTAMP fijar la zona es lo correcto.
    expect(formatDate("2026-09-04")).toBe("3/9/2026");
  });

  it("el primer día del mes y del año no se caen al anterior", () => {
    expect(formatDateOnly("2026-01-01")).toBe("01/01/2026");
    expect(formatDateOnlyShort("2027-03-01")).toBe("1 mar 2027");
  });

  it("null y vacío dan cadena vacía, no 'Invalid Date'", () => {
    expect(formatDateOnly(null)).toBe("");
    expect(formatDateOnly("")).toBe("");
    expect(formatDateOnlyShort(undefined)).toBe("");
  });

  it("un valor que no es fecha pura se devuelve tal cual, sin inventar", () => {
    expect(formatDateOnly("mañana")).toBe("mañana");
  });

  it("tolera un timestamp completo tomando solo su parte de fecha", () => {
    expect(formatDateOnly("2026-09-04T23:30:00Z")).toBe("04/09/2026");
  });
});

// El PDF del paciente ya lo hacía bien: formatAppointmentDate parsea los componentes con regex y no
// convierte zona. Se blinda para que nadie lo "unifique" con el helper de zona y le meta el defecto a un
// documento que SALE DE LA CLINICA.
const REPO = readFileSync("src/modules/reports/data/reports-repository.ts", "utf8");
const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");

describe("los consumidores de fechas puras", () => {
  it("el PDF del paciente NO convierte zona al fechar la cita", () => {
    const fn = REPO.slice(REPO.indexOf("export function formatAppointmentDate"));
    expect(fn.slice(0, 400)).not.toContain("toLocale");
    expect(fn.slice(0, 400)).not.toContain("new Date");
  });

  it("la historia clínica usa el formato sin zona en las tres fechas puras", () => {
    expect(PAGE).toContain("formatDateOnly(r.referredAt)");
    expect(PAGE).toContain("formatDateOnly(r.returnedAt)");
    expect(PAGE).toContain("formatDateOnly(hcHeader.proximaCita)");
  });
});
