import { isAnswered } from "@/modules/clinical-pipeline/services/survey-completeness";

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
        Esta evaluación aún no tiene respuestas de encuesta.
      </p>
    );
  }
  // Faltantes con EL MISMO predicado que el gate y el modo edicion (isAnswered): asi la previsualizacion no
  // dice una cosa y el boton de generar otra (Santiago 2026-08-20 §3). Cuenta la "Otra" pelada como hueco.
  const totalMissing = domains.reduce(
    (acc, d) => acc + d.questions.filter((q) => !isAnswered(q.answerValue)).length,
    0,
  );
  return (
    <div className="flex flex-col gap-6">
      {totalMissing > 0 ? (
        <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          {totalMissing === 1 ? "Falta 1 pregunta" : `Faltan ${totalMissing} preguntas`} por responder.
          Edita y completa la encuesta con el paciente antes de generar el diagnóstico.
        </div>
      ) : null}
      {domains.map((d) => (
        <section key={d.section} className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-foreground">{d.section}</h3>
          <div className="flex flex-col gap-4">
            {d.questions.map((q) => (
              <div key={q.questionId} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">
                  <span className="text-muted-foreground">{q.number}.</span> {q.questionText}
                </p>
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
