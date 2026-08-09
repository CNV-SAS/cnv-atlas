// Tipos de la vista de respuestas de encuesta. Viven en un modulo NEUTRO (sin `server-only`) porque
// componentes CLIENTE los importan (correct-evaluation-form usa SurveyDomain). Un tipo que cruza la
// frontera cliente/servidor no puede vivir en el reader `server-only`: aunque `import type` se borra en
// compilacion, la arista deja el reader al alcance del boundary de cliente y el bundler de produccion
// puede convertirlo en referencia-cliente, dejando sus funciones undefined en el server. El reader los
// re-exporta para el codigo de servidor.

export type SurveyAnswerView = {
  questionId: string;
  questionText: string;
  questionType: string; // texto | numero | opcion | opcion_multiple | contador | escala
  fieldKey: string | null; // marca si alimenta el motor (no se edita aqui: eso es recomputo)
  usedInDiagnosis: boolean; // si alimenta el DIAGNOSTICO (gatea dfi.complete): a priorizar al completar
  answerValue: string | null; // opcion: option_text; opcion_multiple: JSON array; numeros: string
  options: string[]; // opciones (option_text) ordenadas; vacio para numero/texto/contador/escala
};

export type SurveyDomain = { section: string; questions: SurveyAnswerView[] };
