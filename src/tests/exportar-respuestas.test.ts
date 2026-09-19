import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  nombreDelArchivo,
  respuestasACsv,
  type ProcedenciaDelExport,
} from "@/modules/evaluations/services/exportar-respuestas";
import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";

// ═══ DESCARGAR LAS RESPUESTAS DE LA ENCUESTA (observación f de Gildardo) ═══
//
// PARA QUIEN, que es lo que la desbloqueó (Santiago, 2026-09-18): para que cada profesional conserve las
// respuestas de SUS pacientes. No va hacia un tercero ni hacia otro sistema.
//
// LO QUE SE BLINDA AQUÍ son las tres formas conocidas de que una exportación salga y no sirva: que una
// coma parta la fila, que las tildes se rompan al abrirla en Excel, y que el archivo no diga de quién es.

const PROCEDENCIA: ProcedenciaDelExport = {
  paciente: "Ana Pérez",
  documento: "CC 1.020.304",
  fecha: "12/09/2026",
  profesional: "Profesional Demo",
  evaluationId: "ev-1",
};

const DOMINIOS: SurveyDomain[] = [
  {
    section: "D1 · Alimentación",
    questions: [
      {
        number: 1,
        questionId: "q1",
        questionText: "¿Cuántas comidas al día?",
        hint: null,
        questionType: "contador",
        fieldKey: "d1_1",
        usedInDiagnosis: true,
        answerValue: 3,
        options: [],
      },
      {
        number: 2,
        questionId: "q2",
        questionText: "¿Qué frutas consumes, y con qué frecuencia?",
        hint: null,
        questionType: "multiple",
        fieldKey: "d1_2",
        usedInDiagnosis: true,
        answerValue: ["Manzana, verde", "Banano"],
        options: [],
      },
      {
        number: 3,
        questionId: "q3",
        questionText: "¿Tomas café?",
        hint: null,
        questionType: "unica",
        fieldKey: "d1_3",
        usedInDiagnosis: false,
        answerValue: null,
        options: [],
      },
    ],
  },
] as unknown as SurveyDomain[];

describe("el CSV de las respuestas", () => {
  const csv = respuestasACsv(DOMINIOS, PROCEDENCIA);

  it("dice de QUIÉN es y de cuándo, antes de la tabla", () => {
    // Un archivo suelto sin procedencia es, dentro de seis meses, un archivo que nadie puede usar.
    expect(csv).toContain("Paciente,Ana Pérez");
    expect(csv).toContain("Fecha de la consulta,12/09/2026");
    expect(csv).toContain("Profesional,Profesional Demo");
    // El documento lleva puntos, no comas: va tal cual y no rompe la fila.
    expect(csv).toContain("CC 1.020.304");
  });

  it("una respuesta con COMA no parte la fila", () => {
    // Es el defecto clásico de un CSV escrito a mano: una respuesta de texto libre con una coma corre
    // todas las columnas siguientes y el archivo se abre torcido, sin que nada avise.
    expect(csv).toContain('"Manzana, verde | Banano"');
    const filas = csv.trim().split("\r\n");
    const fila = filas.find((f) => f.includes("Manzana"));
    expect(fila).toBeDefined();
    // Cuatro columnas: dominio, número, pregunta, respuesta. Se cuentan las comas FUERA de comillas.
    const comasFuera = (fila ?? "")
      .split('"')
      .filter((_, i) => i % 2 === 0)
      .join("")
      .split(",").length - 1;
    expect(comasFuera, "la coma de la respuesta corrió las columnas").toBe(3);
  });

  it("y una pregunta con comillas tampoco", () => {
    const conComillas = respuestasACsv(
      [
        {
          ...DOMINIOS[0],
          questions: [{ ...DOMINIOS[0].questions[0], questionText: 'Le dicen "desayuno fuerte"' }],
        },
      ] as unknown as SurveyDomain[],
      PROCEDENCIA,
    );
    expect(conComillas).toContain('"Le dicen ""desayuno fuerte"""');
  });

  it("lo SIN RESPONDER se dice, no se deja en blanco", () => {
    // Una celda vacía se confunde con un dato perdido en la exportación. Aquí la ausencia es información.
    expect(csv).toContain("(sin responder)");
  });

  it("abre bien en Excel: lleva BOM y saltos CRLF", () => {
    // Sin BOM, Excel en Windows lee el UTF-8 como Latin-1 y las tildes salen rotas. Es lo que decide si
    // el archivo se puede usar o hay que arreglarlo a mano.
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
  });

  it("el nombre del archivo se puede buscar en una carpeta", () => {
    expect(nombreDelArchivo(PROCEDENCIA)).toBe("encuesta-CC-1.020.304-12-09-2026.csv");
  });

  it("NO lleva nada del modelo: es el instrumento respondido, no una interpretación", () => {
    for (const idx of ["IFC", "IRC", "PABU", "DFI", "EB-BIS"]) {
      expect(csv, `${idx} no tiene nada que hacer en la exportación de respuestas`).not.toContain(idx);
    }
  });
});

describe("la descarga no se lleva nada sin dejar rastro", () => {
  const RUTA = readFileSync("src/app/(app)/ani-bis-e/[id]/encuesta/csv/route.ts", "utf8");

  it("exige sesión y policy, y la RLS pone el alcance", () => {
    expect(RUTA).toContain("requireUser()");
    expect(RUTA).toContain("canViewPatients(user)");
  });

  it("y AUDITA quién se llevó una copia (regla 8)", () => {
    // No basta con poder descargar: un archivo con las respuestas de un paciente que sale sin rastro es
    // justo lo que la auditoría clínica existe para impedir.
    expect(RUTA).toContain('event: "survey.answers_exported"');
    expect(RUTA).toContain("recordAudit(tx");
  });

  it("se descarga, no se abre: attachment y sin caché", () => {
    expect(RUTA).toContain("attachment; filename=");
    expect(RUTA).toContain('"Cache-Control": "private, no-store"');
  });

  it("una evaluación ajena es indistinguible de una que no existe", () => {
    expect(RUTA).toContain("Evaluación no disponible");
  });
});
