// Tipos de la vista de respuestas de encuesta. Viven en un modulo NEUTRO (sin `server-only`) porque
// componentes CLIENTE los importan (correct-evaluation-form usa SurveyDomain). Un tipo que cruza la
// frontera cliente/servidor no puede vivir en el reader `server-only`: aunque `import type` se borra en
// compilacion, la arista deja el reader al alcance del boundary de cliente y el bundler de produccion
// puede convertirlo en referencia-cliente, dejando sus funciones undefined en el server. El reader los
// re-exporta para el codigo de servidor.

import type { ComportamientoDelItem } from "./survey-view-types";

export type SurveyAnswerView = {
  questionId: string;
  number: number; // numeracion continua 1..N por el orden (coincide con la del intake); ver survey-answers-reader
  questionText: string;
  questionHint: string | null; // ayuda bajo el enunciado (ejemplos/porciones D1, aclaraciones); display
  questionType: string; // texto | numero | opcion | opcion_multiple | contador | escala
  fieldKey: string | null; // marca si alimenta el motor (no se edita aqui: eso es recomputo)
  usedInDiagnosis: boolean; // si alimenta el DIAGNOSTICO (gatea dfi.complete): a priorizar al completar
  answerValue: string | null; // opcion: option_text; opcion_multiple: JSON array; numeros: string
  options: string[]; // opciones (option_text) ordenadas; vacio para numero/texto/contador/escala
  /**
   * EL NOMBRE COMERCIAL DE CADA PRODUCTO, POR ID. Solo lo traen el S1 y el S2 de la CNV-S
   * (`opcion_por_producto`), cuya respuesta se guarda como {idDelProducto: opcion}.
   *
   * VIENE RESUELTO DEL LECTOR y no se deduce en la pantalla: el id es lo que se guarda (un nombre
   * comercial cambia y la respuesta sellada no), asi que el nombre de hoy solo lo puede poner quien
   * tiene la base delante. Sin esto, las cuatro superficies que escriben la respuesta (la vista del
   * profesional, el SOAP, la historia clinica y el CSV) mostraban el objeto JSON con los ids dentro.
   */
  nombresDeProductos?: Record<string, string>;
  /**
   * QUE HACE ESTE ITEM EN EL INSTRUMENTO (su tabla 3), cuando se sabe.
   *
   * ES OPCIONAL Y NO UN CAMPO MAS: solo lo trae el camino que lee POR INSTRUMENTO (la CNV-S). En la
   * linea base y en las pantallas que arman una pregunta a mano queda `undefined`, y quien lo lee
   * tiene que tratar eso como `repetir`, que es el comportamiento de toda la linea base. Un valor
   * inventado se ve igual que uno bueno, asi que aqui "no se sabe" se dice con la ausencia.
   *
   * HACE FALTA PORQUE LA PANTALLA DE EDICION PRESENTA LO MISMO QUE LA ENCUESTA (2026-11-09): sin el
   * comportamiento no puede saber que un item es `retirar` (no se pregunta, se hereda) ni que es uno
   * de los siete digestivos que su §7.2 puede saltar.
   */
  comportamiento?: ComportamientoDelItem;
};

export type SurveyDomain = { section: string; questions: SurveyAnswerView[] };

// Caracterizacion sociodemografica DEL ENCUENTRO, versionada por evaluacion (columnas de `evaluations`).
// Modulo neutro: la comparten el reader (server) y el display de D8. La etnia solo trae valor si hubo
// autorizacion de investigacion (gate en el writer); si no, null y no aparece esa fila.
export type EvaluationCharacterization = {
  educationLevel: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  socioeconomicStratum: string | null;
  ethnicity: string | null;
  ancestry: string | null;
};
