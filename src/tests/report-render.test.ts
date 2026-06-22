import { describe, expect, it } from "vitest";

import { type EngineInput, runEngine } from "@/clinical-engine";
import { renderReportPdf } from "@/modules/reports/services/render-report";

function sampleSnapshot() {
  const input: EngineInput = {
    sexo: "F",
    edad: 42,
    bis: {
      Re: 500, Ri: 50, Rinf: 450, C: 2,
      FMI: 8, FFMI: 18, MCA: 30, MCA_ref: 32,
      smmW: 0.4, ASMI: 8, AF: 6, IR: 0.8,
      ECW: 18, ICW: 24, FFM: 60,
      peso: 70, talla: 1.7, imc: 24,
    },
    survey: {},
    model: { version: "ANI-BIS-E placeholder", rulesVersion: "placeholder" },
  };
  return runEngine(input);
}

const meta = {
  patientName: "Paciente Demo",
  documentLabel: "CC 12345",
  evaluationDate: "12/04/2026",
  reportId: "11111111-1111-1111-1111-111111111111",
};

describe("renderReportPdf", () => {
  it("genera un PDF valido (cabecera %PDF) desde el snapshot", async () => {
    const buffer = await renderReportPdf(sampleSnapshot(), meta);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000); // no es un PDF vacio
  });
});
