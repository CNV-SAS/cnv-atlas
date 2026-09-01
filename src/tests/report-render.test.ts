import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type EngineInput, runEngine } from "@/clinical-engine";
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
    fuerzaPrensil: null,
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

  // ═══ EL CANDADO VA SOBRE EL DOCUMENTO, NO SOBRE UNA LISTA ═══
  //
  // ANTES miraba la constante `INDICATOR_LABELS`, y por eso NO SE PUSO ROJO cuando se retiró el bloque
  // entero de indicadores: la lista seguía existiendo, ya sin nadie que la renderizara. Un candado sobre
  // el insumo no dice nada sobre lo que el documento IMPRIME, que es lo único que le llega al paciente.
  //
  // AHORA mira el código del documento. Su instrucción (§7.1, 2026-08-26), literal:
  //
  //   "lo que hoy le mandan -IFC, IRC, PABU, ICA-BIS, ISCM, IEHH y el código N_N_N_A- NO DEBE SALIR ASÍ.
  //    Ningún índice del modelo va al paciente. Eso es el documento del profesional."
  //
  // Y el gate del Hito 3 (P0) sigue dentro, reforzado: la EB-BIS y el IAE no solo no están en una lista,
  // es que el documento NO RECIBE el objeto donde viven.
  describe("el documento del paciente no lleva NADA del modelo (Gildardo §7.1)", () => {
    const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
    // Sin comentarios: el comentario del documento CITA los nombres prohibidos para explicar por qué no
    // están. Ya nos pasó dos veces que un detector cace su propia documentación.
    const CODIGO = DOC.replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\/[^\n]*/g, "");

    it("no desestructura del snapshot lo que no puede imprimir", () => {
      // Si el documento no TIENE el dato, no puede filtrarlo por descuido. Es más fuerte que prohibir
      // cada nombre uno por uno, porque cubre también los que nadie pensó en prohibir.
      for (const campo of ["indicators", "efrPhenotype", "structural", "frSector"]) {
        expect(CODIGO, `el documento del paciente volvió a recibir ${campo} del snapshot`).not.toContain(
          campo,
        );
      }
    });

    it("no nombra ninguno de los índices que él prohibió", () => {
      for (const idx of ["IFC", "IRC", "PABU", "ICA-BIS", "ISCM", "IEHH", "FFMI", "FMI"]) {
        expect(CODIGO, `${idx} volvió al documento del paciente`).not.toContain(`"${idx}"`);
      }
    });

    it("no lleva el código de estado EFR ni el sector funcional", () => {
      expect(CODIGO).not.toContain("stateNumber");
      expect(CODIGO).not.toContain("Sector funcional");
    });

    it("el DFI no sale con el lenguaje del modelo (riesgo, score, severidades)", () => {
      // Su versión para el paciente REESCRIBE ese lenguaje (BAJO/CRÍTICO a Óptimo/Prioritario, y el
      // dominio conductual sin mencionar TCA). Es decisión clínica suya, no simplificación nuestra: hasta
      // que responda si portamos su mapa, el bloque no va. `dfi.complete` sí se usa, para gatear la banda.
      expect(CODIGO).not.toContain("dfi.riesgo");
      expect(CODIGO).not.toContain("dfi.domains");
      expect(CODIGO).not.toContain("dfi.rutas");
      expect(CODIGO).toContain("dfi.complete");
    });

    it("la EB-BIS y el IAE siguen fuera (gate del Hito 3, P0)", () => {
      expect(CODIGO).not.toContain('"eb"');
      expect(CODIGO).not.toContain('"iae"');
    });

    it("y SÍ lleva lo que es del paciente: el cambio, los nutracéuticos, las notas y su derecho", () => {
      // CONTROL. Sin esto, todo lo de arriba pasaría verde también con el documento vacío, que sería
      // haberlo roto en vez de haber retirado lo que sobraba.
      expect(CODIGO).toContain("bandText");
      expect(CODIGO).toContain("nutraceuticos");
      expect(CODIGO).toContain("professionalNotes");
      expect(DOC).toContain("Puedes solicitar tu historia clínica completa a tu profesional tratante.");
    });

    it("el derecho a la historia clínica va en los TRES modos de envío", () => {
      // No puede colgar de `showAtlas` ni de `showNotes`: un derecho que aparece según el modo de envío es
      // un derecho que a veces no existe. Se comprueba que la línea no quede dentro de un condicional.
      const i = DOC.indexOf("Puedes solicitar tu historia clínica completa");
      const antes = DOC.slice(0, i);
      const ultimoCondicional = Math.max(
        antes.lastIndexOf("{showAtlas ?"),
        antes.lastIndexOf("{showNotes ?"),
      );
      const ultimoCierre = antes.lastIndexOf(") : null}");
      expect(
        ultimoCierre,
        "la línea del derecho a la historia clínica quedó dentro de un bloque condicional",
      ).toBeGreaterThan(ultimoCondicional);
    });
  });
});
