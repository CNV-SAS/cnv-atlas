import type { SurveyAnswerView, SurveyDomain } from "../data/survey-answers-types";
import { textoDeLaRespuesta } from "../respuesta-en-texto";

// ═══ LAS RESPUESTAS DE LA ENCUESTA, EN UN ARCHIVO (observación f de Gildardo) ═══
//
// PARA QUE Y PARA QUIEN (Santiago, 2026-09-18): para que cada profesional pueda conservar las respuestas
// de SUS pacientes. No es una exportación de datos hacia un tercero ni hacia otro sistema, y por eso la
// pregunta legal que la tenía frenada no aplica: el titular de la relación clínica es quien descarga.
//
// LO QUE LLEVA Y LO QUE NO. Lleva la pregunta y la respuesta, tal como se dieron. NO lleva nada del
// modelo (ni índices, ni clasificaciones, ni el diagnóstico): esto es el INSTRUMENTO respondido, no una
// interpretación. Y lleva la PROCEDENCIA en las primeras líneas, porque un archivo suelto sin decir de
// quién y de cuándo es, dentro de seis meses, un archivo que nadie puede usar.
//
// CSV Y NO XLSX, a propósito: se abre en Excel, en Numbers, en Sheets y en cualquier editor de texto, y
// no añade una dependencia para escribir una tabla de dos columnas.
//
// PURO: recibe lo ya leído y devuelve el texto. La autorización, la lectura bajo RLS y la auditoría viven
// en la ruta que lo llama (regla dura 2: la lógica no vive en el route handler, y el acceso no se decide
// aquí).

export type ProcedenciaDelExport = {
  paciente: string;
  documento: string;
  /** Fecha de la consulta, ya formateada. */
  fecha: string;
  profesional: string;
  evaluationId: string;
};

/**
 * Una celda de CSV, con las comillas de RFC 4180: si el texto trae coma, comilla o salto de línea, va
 * entrecomillado y las comillas internas se duplican. Sin esto, una respuesta de texto libre con una coma
 * parte la fila y el archivo se abre torcido, que es la forma silenciosa de corromper una exportación.
 */
function celda(valor: string | null | undefined): string {
  const texto = (valor ?? "").replace(/\r?\n/g, " ").trim();
  return /[",;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * El valor de una respuesta como texto plano, con LA LECTURA COMPARTIDA (`respuesta-en-texto`).
 *
 * Las múltiples se unen con " | ", que no choca con el CSV. Aquí vivía otra copia del parseo, así que
 * el S1 de la CNV-S se habría exportado como el objeto JSON con los ids de los productos dentro: un
 * archivo para analizar que obliga a resolver identificadores a mano.
 */
function respuesta(valor: string | null | undefined, q?: SurveyAnswerView): string {
  return textoDeLaRespuesta(valor, {
    tipo: q?.questionType,
    nombres: q?.nombresDeProductos,
    separador: " | ",
  });
}

export function respuestasACsv(domains: SurveyDomain[], procedencia: ProcedenciaDelExport): string {
  const lineas: string[] = [];

  // PROCEDENCIA ARRIBA, en filas de dos celdas: se lee igual de bien en una hoja de cálculo que en un
  // editor de texto, y no obliga a mirar el nombre del archivo para saber de quién es.
  lineas.push(`${celda("Paciente")},${celda(procedencia.paciente)}`);
  lineas.push(`${celda("Documento")},${celda(procedencia.documento)}`);
  lineas.push(`${celda("Fecha de la consulta")},${celda(procedencia.fecha)}`);
  lineas.push(`${celda("Profesional")},${celda(procedencia.profesional)}`);
  lineas.push(`${celda("Evaluación")},${celda(procedencia.evaluationId)}`);
  lineas.push("");

  lineas.push(["Dominio", "N", "Pregunta", "Respuesta"].map(celda).join(","));
  for (const dominio of domains) {
    for (const q of dominio.questions) {
      lineas.push(
        [
          celda(dominio.section),
          celda(String(q.number)),
          celda(q.questionText),
          // SIN RESPONDER SE DICE, no se deja en blanco: una celda vacía se confunde con un dato perdido
          // en la exportación, y aquí la ausencia es información (el paciente no contestó).
          celda(respuesta(q.answerValue, q) || "(sin responder)"),
        ].join(","),
      );
    }
  }

  // BOM AL PRINCIPIO: sin él, Excel en Windows abre el UTF-8 como Latin-1 y las tildes salen rotas. Es el
  // detalle que decide si el archivo se puede usar o hay que arreglarlo a mano.
  return `﻿${lineas.join("\r\n")}\r\n`;
}

/** Nombre del archivo: documento del paciente y fecha, que es como se busca después en una carpeta. */
export function nombreDelArchivo(procedencia: ProcedenciaDelExport): string {
  const limpio = (s: string) => s.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `encuesta-${limpio(procedencia.documento) || "paciente"}-${limpio(procedencia.fecha)}.csv`;
}
