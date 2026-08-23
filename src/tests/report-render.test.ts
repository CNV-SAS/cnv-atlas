import { describe, expect, it } from "vitest";

import { type EngineInput, runEngine } from "@/clinical-engine";
import { INDICATOR_LABELS } from "@/modules/reports/pdf/report-document";
import { renderReportPdf } from "@/modules/reports/services/render-report";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

function sampleSnapshot() {
  // Fila cruda real (anonimizada) del Biody: pasa la puerta dura del motor. Sin encuesta
  // el DFI corre degradado (el output lo marca), lo cual el PDF debe renderizar bien.
  const input: EngineInput = {
    sexo: "M",
    edad: 54,
    bisRow: biody as Record<string, unknown>,
    survey: {},
    expectedFieldKeys: ["d2_19"],
    model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  };
  return runEngine(input);
}

const meta = {
  patientName: "Paciente Demo",
  documentLabel: "CC 12345",
  evaluationDate: "12/04/2026",
  reportId: "11111111-1111-1111-1111-111111111111",
};

const isPdf = (b: Buffer) =>
  Buffer.isBuffer(b) && b.subarray(0, 5).toString("latin1") === "%PDF-" && b.length > 1000;

// renderReportPdf hace render REAL con @react-pdf/renderer (CPU-pesado): aislado ~2s, pero bajo la carga
// paralela del resto del suite un solo test puede pasar de los 5s del default de vitest y truena por TIMEOUT
// (no por contencion de estado, distinto del grupo serial de BD: aqui no hay estado compartido, solo trabajo
// lento). Se les da un timeout holgado (20s), como el proyecto "db" para lo suyo. Flake cazado 3 veces.
const RENDER_TIMEOUT = 20000;

describe("renderReportPdf", () => {
  it(
    "genera un PDF valido (cabecera %PDF) desde el snapshot",
    async () => {
      expect(isPdf(await renderReportPdf(sampleSnapshot(), meta))).toBe(true);
    },
    RENDER_TIMEOUT,
  );

  it(
    "rinde en los tres modos (atlas, notas, ambos) con notas del profesional",
    async () => {
      const snap = sampleSnapshot();
      const notes = "Interpretacion del profesional para el paciente.";
      for (const mode of ["atlas", "notas", "ambos"] as const) {
        const buf = await renderReportPdf(snap, meta, { mode, professionalNotes: notes });
        expect(isPdf(buf)).toBe(true);
      }
    },
    RENDER_TIMEOUT,
  );

  // GATE (Hito 3, P0): el reporte del PACIENTE nunca muestra la cifra de EB-BIS ni la de IAE. Gildardo
  // decidio que ninguna se comunica al paciente (la de EB porque es no comunicable, la de IAE porque
  // = EB - edad y revela el constructo). El profesional SI las ve, en la vista interna.
  it("el reporte del paciente NO incluye EB ni IAE (P0, gate del Hito 3)", () => {
    const keys = INDICATOR_LABELS.map((i) => i.key);
    expect(keys).not.toContain("eb");
    expect(keys).not.toContain("iae");
    // guarda de que los demas si siguen (no se vacio la tabla por error)
    expect(keys).toContain("ifc");
    expect(keys.length).toBe(10);
  });
});
