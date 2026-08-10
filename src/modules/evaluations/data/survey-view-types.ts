// Tipos NEUTROS (sin server-only) de la encuesta activa para el intake. Viven aparte del reader
// server-only para que los componentes cliente (form y widgets) los importen sin arrastrar el reader al
// boundary de cliente (hazard RSC latente; ver client-import-server-only-rompe-prod). El reader los reexporta.
export type SurveyOptionView = { id: string; text: string };
export type SurveyQuestionView = {
  id: string;
  number: number; // numeracion continua 1..N derivada del orden (no del texto); ver survey-reader
  text: string;
  type: string; // texto, numero, opcion, opcion_multiple
  section: string | null; // dominio para agrupar en el intake (B7.1)
  options: SurveyOptionView[];
};
export type ActiveSurvey = {
  surveyVersionId: string;
  questions: SurveyQuestionView[];
};
