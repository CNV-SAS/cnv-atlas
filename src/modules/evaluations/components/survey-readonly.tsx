import type { SurveyDomain } from "../data/survey-answers-reader";
import { SurveyAnswerReadonly } from "./survey-widgets";

// Vista de SOLO LECTURA de la encuesta del paciente para el profesional (pestana Evaluacion).
// Agrupa por dominio (D1-D8) y muestra cada pregunta con su respuesta reusando la presentacion de
// los widgets (SurveyAnswerReadonly). NO hay edicion: editar una respuesta del motor dispara
// recomputo, que es el flujo de correccion (bloque futuro). Presentacion pura desde el reader (RLS).
export function SurveyReadonly({ domains }: { domains: SurveyDomain[] }) {
  if (domains.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta evaluacion aun no tiene respuestas de encuesta.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {domains.map((d) => (
        <section key={d.section} className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-foreground">{d.section}</h3>
          <div className="flex flex-col gap-4">
            {d.questions.map((q) => (
              <div key={q.questionId} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">{q.questionText}</p>
                <SurveyAnswerReadonly
                  questionType={q.questionType}
                  answerValue={q.answerValue}
                  options={q.options}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
