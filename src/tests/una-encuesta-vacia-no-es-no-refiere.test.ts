import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ UNA ENCUESTA VACIA NO ES "NO REFIERE" (Santiago, 2026-10-12) ═══
//
// ── EL ARREGLO QUE ESTE CANDADO VIGILA, Y LA TENTACION QUE TRAIA ───────────────────────────────────
//
// Las 15 consultas del lote del HTML entraron sin ninguna respuesta de encuesta, y por eso sin fila de
// `survey_responses`. La pantalla de completar rendia un formulario SIN NINGUNA PREGUNTA, asi que la unica
// salida que la puerta del diagnostico ofrecia ("Completar la encuesta con el paciente") no resolvia nada.
//
// LA FORMA FACIL DE ARREGLARLO ERA LA PELIGROSA: hacer que `getSurveyAnswersForEvaluation` devolviera el
// instrumento completo con las respuestas en nulo, en vez de null. Una linea, y arreglaba la pantalla.
//
// PERO ESE null LO LEEN SIETE SITIOS, y tres de ellos son documentos clinicos: el encabezado de la historia
// clinica, la seccion S del SOAP, los antecedentes y las alertas. Para esos, "la lista llego vacia" y "la
// lista trae 64 preguntas sin responder" son lo MISMO al recorrerla, y el resultado es que una encuesta que
// nadie contesto se imprimiria como un paciente que NO REFIERE nada: sin antecedentes, sin alergias, sin
// alertas. Es una afirmacion clinica falsa sobre una persona, firmada por un profesional.
//
// Es la misma distincion que el D8 ya cuida ("no respondio" vs "evaluacion anterior al registro") y la
// misma familia que el sexo que se adivinaba: el dato que falta no se rellena con el valor por defecto mas
// comodo, porque el valor por defecto se lee igual que un dato bueno.
//
// POR ESO EL ARREGLO FUE UNA FUNCION APARTE, y por eso este candado existe: para que la de aparte no se
// coma a la compartida en el proximo barrido de "dos funciones que hacen casi lo mismo".

const leer = (p: string): string => readFileSync(p, "utf8");

// Los sitios que leen la encuesta para DECIR algo clinico. Cada uno con lo que se perderia si pasara a
// recibir el instrumento en blanco en vez de null.
const DOCUMENTOS_CLINICOS: [string, string][] = [
  [
    "src/modules/reports/data/hc-documento-reader.ts",
    "el encabezado de la historia clinica imprimiria un paciente sin antecedentes en vez de uno sin encuesta",
  ],
  [
    "src/modules/reports/data/hc-soap-reader.ts",
    'la seccion S dice "lo que el paciente refiere": sin encuesta no refirio nada, no refirio que no',
  ],
  [
    "src/app/(app)/ani-bis-e/[id]/page.tsx",
    "los antecedentes y las alertas clinicas saldrian en blanco como si estuvieran descartadas",
  ],
];

describe("una encuesta vacia no se puede leer como una encuesta contestada", () => {
  it("la pantalla de COMPLETAR pide el instrumento, exista o no la respuesta", () => {
    const page = sinComentarios(leer("src/app/(app)/ani-bis-e/[id]/encuesta/editar/page.tsx"));
    expect(
      page,
      "sin esto el formulario se rinde sin ninguna pregunta y la salida del diagnostico no resuelve nada",
    ).toMatch(/getSurveyFormForEvaluation\s*\(/);
    expect(
      page,
      "si vuelve al lector de respuestas, vuelve el formulario vacio de las 15 consultas del lote",
    ).not.toMatch(/getSurveyAnswersForEvaluation\s*\(/);
  });

  it("y NINGUN documento clinico lo usa: ellos tienen que seguir distinguiendo el hueco", () => {
    for (const [archivo, loQueSePierde] of DOCUMENTOS_CLINICOS) {
      const src = sinComentarios(leer(archivo));
      expect(src, `${archivo}: ${loQueSePierde}`).not.toMatch(/getSurveyFormForEvaluation\s*\(/);
      expect(
        src,
        `${archivo} dejo de leer la encuesta por el lector que devuelve null; si cambio de fuente, ` +
          "hay que revisar que la nueva tambien distinga sin-encuesta de sin-respuestas",
      ).toMatch(/getSurveyAnswersForEvaluation\s*\(/);
    }
  });

  it("y el lector compartido sigue devolviendo null cuando no hay encuesta", () => {
    const reader = sinComentarios(
      leer("src/modules/evaluations/data/survey-answers-reader.ts"),
    );
    // LA LINEA ENTERA, no solo "return null": lo que importa es que el null salga de NO ENCONTRAR la fila
    // de respuesta, que es el unico hecho que distingue "esta evaluacion no tiene encuesta".
    expect(
      reader,
      "ese null es lo que los documentos clinicos leen para saber que no hubo encuesta",
    ).toMatch(/if\s*\(!resp\)\s*return null/);
  });

  it("y la fila que se crea al completarla sella quien pregunto y con que version", () => {
    const writer = sinComentarios(leer("src/modules/evaluations/data/survey-edit-writer.ts"));
    // capturedBy: nulo significa "la autodiligencio el paciente". Crear la fila sin esto atribuiria al
    // paciente una encuesta que contesto el profesional preguntandosela, que no es la misma evidencia.
    expect(writer, "sin capturedBy la encuesta queda como autodiligenciada por el paciente").toMatch(
      /capturedBy:\s*input\.actorId/,
    );
    // surveyVersionId: regla dura 7. Sin la version no se puede reconstruir contra que lista de field_key
    // se midio la completitud, asi que un dfi.complete sellado deja de ser verificable.
    expect(writer, "regla dura 7: la constelacion de versiones no es opcional").toMatch(
      /surveyVersionId:\s*version\.id/,
    );
    // Y QUE NO SE INVENTE EL LOTE: estas respuestas no las trajo el archivo.
    expect(
      writer,
      "marcarlas con un importBatchId las haria pasar por importadas, y se borrarian al deshacer el lote",
    ).not.toMatch(/importBatchId/);
  });
});
