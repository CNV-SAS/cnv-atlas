// Tipos NEUTROS (sin server-only) de la encuesta activa para el intake. Viven aparte del reader
// server-only para que los componentes cliente (form y widgets) los importen sin arrastrar el reader al
// boundary de cliente (hazard RSC latente; ver client-import-server-only-rompe-prod). El reader los reexporta.
export type SurveyOptionView = { id: string; text: string };
export type SurveyQuestionView = {
  id: string;
  number: number; // numeracion continua 1..N derivada del orden (no del texto); ver survey-reader
  text: string;
  hint: string | null; // ayuda bajo el enunciado (ejemplos + ancla de porcion en D1, o aclaracion de item)
  type: string; // texto, numero, opcion, opcion_multiple
  section: string | null; // dominio para agrupar en el intake (B7.1)
  fieldKey: string | null; // clave del prototipo (d1_1_i, d2_21...). El intake la usa para saber que
  // preguntas forman la matriz de frecuencia y de que categoria clinica es cada una. Se ancla en la
  // CLAVE y no en la posicion ni en el texto: un orden se desincroniza en cuanto se inserta algo.
  options: SurveyOptionView[];
};

/** Los cinco comportamientos de su tabla 3. `propio` es el Modulo S, que no existe en la linea base. */
export type ComportamientoDelItem =
  | "repetir"
  | "repetir_con_filtro"
  | "confirmar"
  | "retirar"
  | "propio";

/**
 * UNA PREGUNTA **DENTRO DE UN INSTRUMENTO**: lo que se pinta, más qué hace aquí (0240, su tabla 3).
 *
 * ES UN TIPO APARTE Y NO DOS CAMPOS MAS EN `SurveyQuestionView`, y la razón es concreta: hay dos
 * pantallas (la corrección de una evaluación y la edición de la encuesta por el profesional) que arman
 * una pregunta a mano para pintar su widget, y ahí el comportamiento no significa nada. Metidos en el
 * tipo común, esas dos tendrían que inventarse un valor, y un valor inventado se ve igual que uno bueno.
 *
 * El formulario de la CNV-S, en cambio, NO puede recibir una pregunta sin comportamiento: es lo que
 * decide si se presenta, se confirma o se salta.
 */
export type SurveyItemView = SurveyQuestionView & {
  comportamiento: ComportamientoDelItem;
  /** La pregunta filtro, cuando `comportamiento` es `repetir_con_filtro`. Su §7.2. */
  filtroQuestionId: string | null;
};

export type ActiveSurvey = {
  surveyVersionId: string;
  /**
   * EL INSTRUMENTO con el que se esta aplicando. Viaja con la encuesta porque es lo que se guarda en la
   * respuesta: sin el, una respuesta no dice bajo que reglas se recogio.
   */
  instrumento: { id: string; codigo: string; nombre: string };
  questions: SurveyItemView[];
};
