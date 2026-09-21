import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type EngineInput, dfiParaPaciente, runEngine } from "@/clinical-engine";
import { RadarDelPaciente } from "@/modules/reports/pdf/radar-del-paciente";
import { renderReportPdf } from "@/modules/reports/services/render-report";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO DEL RADAR DEL PACIENTE (Santiago, 2026-09-20) ═══
//
// EL PEDIDO: "¿no pueden proponer una forma de mostrar la diana sin mencionar índices?". La Diana no se
// puede (sus ejes SON los índices y su lectura es el código de estado), y la prueba de que la prohibición
// del §7.1 cubre el CONCEPTO y no solo la sigla es que Gildardo retiró hasta "Sector funcional (FyR)".
//
// EL RADAR SI: sus ejes son los cinco dominios con el nombre que su propio `informePaciente` ya le manda
// al paciente, y la escala son sus cuatro etiquetas de paciente. Este candado guarda las dos cosas que
// pueden romperse en silencio:
//
//   1. Que se cuele un índice del modelo en el dibujo. Es lo que ya pasó una vez, por el campo `urgencia`
//      de una remisión ("recomendada si IAE > 10 años"), y no se vio hasta que se leyó el PDF.
//   2. Que el documento deje de renderizarse. Un PDF que revienta no falla en un test de tipos: falla el
//      día que el profesional pulsa "enviar", delante del paciente.

const CANON = [
  "d2_19", "d2_20", "d2_21", "d2_22",
  "d3_23", "d3_24", "d3_26", "d3_30",
  "d5_36", "d5_38", "d5_39",
  "d8_61", "d8_62",
  "d7_agua",
  ...Array.from({ length: 15 }, (_, i) => `d1_${i + 1}_i`),
];
const ENCUESTA_COMPLETA = {
  ...Object.fromEntries(CANON.map((k) => [k, "1"])),
  d5_39: ["Ninguna"] as string[],
};

function entrada(): EngineInput {
  return {
    sexo: "M",
    edad: 54,
    bisRow: biody as Record<string, unknown>,
    survey: ENCUESTA_COMPLETA,
    expectedFieldKeys: CANON,
    fuerzaPrensil: null,
    model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  };
}

const snapshot = runEngine(entrada());
const dfiPac = dfiParaPaciente(snapshot);

describe("el radar habla el idioma del paciente", () => {
  it("cada eje es un dominio con su etiqueta de paciente", () => {
    expect(dfiPac).not.toBeNull();
    const dominios = dfiPac!.dominios;
    expect(dominios.length).toBeGreaterThanOrEqual(3);
    // Las cuatro son las suyas (`_SEVPAC`), no las del profesional (Óptimo/Leve/Moderado/Alto).
    for (const d of dominios) {
      if (d.nivel == null) continue;
      expect(["En equilibrio", "A vigilar", "A trabajar", "Prioritario"]).toContain(d.nivel);
    }
  });

  it("no dibuja nada con menos de tres dominios medidos", () => {
    // Dos puntos son una raya, y una raya no dice nada de la forma. Mejor no dibujar que insinuar.
    expect(RadarDelPaciente({ dominios: [] })).toBeNull();
    const dos = (dfiPac!.dominios ?? []).slice(0, 2);
    expect(RadarDelPaciente({ dominios: dos })).toBeNull();
  });

  it("su código no nombra ningún índice del modelo", () => {
    // SIN COMENTARIOS: el comentario de cabecera CITA los terminos prohibidos para explicar por que lo
    // estan, y sin esto el candado se caza a si mismo (por eso existe este ayudante).
    const fuente = sinComentarios(readFileSync("src/modules/reports/pdf/radar-del-paciente.tsx", "utf8"));
    // Los nombres de los indices, en sigla y en su forma larga. La leccion del campo `urgencia`: el
    // filtro tiene que mirar TODO el texto que llega al paciente, no solo el que parece clinico.
    // LAS SIGLAS COMO PALABRA ENTERA Y EN MAYUSCULA: buscadas como subcadena sin mayusculas, "IRC" aparece
    // dentro de "Circle" y el candado se pone rojo por el nombre de un componente de dibujo.
    const SIGLAS = ["IFC", "IRC", "FFMI", "FMI", "PABU", "ICA-BIS", "ISCM", "IEHH", "IAE", "EB-BIS"];
    for (const sigla of SIGLAS) {
      // `\\b` y no `\b`: dentro de una plantilla, `\b` es un RETROCESO, y la expresion no cazaria nunca nada.
      expect(new RegExp(`\\b${sigla}\\b`).test(fuente), `el radar nombra "${sigla}"`).toBe(false);
    }
    // El control: la expresion SI caza una sigla cuando esta, para que el verde de arriba signifique algo.
    expect(new RegExp(`\\bIRC\\b`).test('label="IRC"')).toBe(true);
    expect(new RegExp(`\\bIRC\\b`).test("<Circle />")).toBe(false);
    // Los nombres largos, sin importar mayusculas: son la forma en que el concepto se cuela en llano.
    const LARGOS = ["edad biológica", "edad bioeléctrica", "función celular", "riesgo celular", "Sector funcional"];
    for (const termino of LARGOS) {
      expect(fuente.toLowerCase(), `el radar nombra "${termino}"`).not.toContain(termino.toLowerCase());
    }
  });
});

describe("el informe con radar se renderiza de verdad", () => {
  it("produce un PDF sin reventar", async () => {
    // RENDER REAL, no un test de tipos: `@react-pdf` acepta un subconjunto de SVG, y un elemento que no
    // soporta no falla al compilar, falla al generar. Este es el unico sitio donde eso se ve antes de que
    // lo vea un paciente.
    const pdf = await renderReportPdf(snapshot, {
      patientName: "Paciente de prueba",
      documentLabel: "CC 0",
      evaluationDate: "2026-09-20",
      reportId: "00000000-0000-0000-0000-000000000000",
    });
    expect(pdf.length).toBeGreaterThan(1000);
  }, 30000);
});

describe("una sola figura, dos vocabularios: los colores son los de la pantalla", () => {
  // Un PDF no lee variables CSS, así que los hexadecimales van escritos en el radar del informe. Este
  // bloque los compara con los tokens de la capa clínica: si alguien cambia uno en `globals.css`, el
  // paciente y su profesional dejarían de mirar el mismo dibujo, y nada lo avisaría.
  const css = readFileSync("src/app/globals.css", "utf8");
  const token = (nombre: string): string => {
    const m = new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
    if (!m) throw new Error(`no aparece --${nombre} en globals.css`);
    return m[1].toLowerCase();
  };

  it("los anillos, del centro al borde, son los del radar de Atlas", async () => {
    const { ANILLO_RADAR } = await import("@/modules/reports/pdf/radar-del-paciente");
    expect(ANILLO_RADAR).toEqual(
      ["clinical-excellent", "clinical-optimal", "clinical-warning", "clinical-critical"].map(token),
    );
  });

  it("y las etiquetas llevan el color de su severidad, el mismo de los badges", async () => {
    const { COLOR_SEVERIDAD } = await import("@/modules/reports/pdf/radar-del-paciente");
    expect(COLOR_SEVERIDAD).toEqual(
      ["clinical-optimal", "clinical-warning", "clinical-moderate", "clinical-critical"].map(token),
    );
  });
});
