import { encabezadoAntesDe } from "@/clinical-engine/encabezados-frecuencia";
import { isAnswered } from "@/modules/clinical-pipeline/services/survey-completeness";

import { Panel } from "@/components/shared/panel";

import type { SurveyDomain } from "../data/survey-answers-reader";
import { EncabezadoDeFrecuencia } from "./encabezado-frecuencia";
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
    <div className="flex flex-col gap-4">
      {totalMissing > 0 ? (
        <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          {totalMissing === 1 ? "Falta 1 pregunta" : `Faltan ${totalMissing} preguntas`} por responder.
          Edita y completa la encuesta con el paciente antes de generar el diagnóstico.
        </div>
      ) : null}
      {/* CADA DOMINIO EN SU PANEL: sobre el fondo gris, las secciones sueltas se leian como texto flotando.
          Y de paso el dominio deja de ser solo un titulo mas grande: es un bloque que se puede recorrer. */}
      {domains.map((d) => (
        <Panel key={d.section} titulo={d.section}>
          <div className="flex flex-col gap-4">
            {/* LOS ENCABEZADOS DE CATEGORIA VIVEN AQUI, no en la encuesta del paciente (Santiago,
                2026-08-31): al profesional le dicen contra que agrupa el modelo, y a esta altura ya no
                pueden sesgar una respuesta, porque ya esta dada. Se derivan de la categoria de la pregunta
                anterior, nunca de una posicion escrita a mano. */}
            {d.questions.map((q, i) => {
              const encabezado = encabezadoAntesDe(q.fieldKey, d.questions[i - 1]?.fieldKey ?? null);
              return (
                <div key={q.questionId} className="flex flex-col gap-2">
                  {encabezado ? <EncabezadoDeFrecuencia encabezado={encabezado} /> : null}
                  <p className="text-sm font-medium text-foreground">
                    <span className="text-muted-foreground">{q.number}.</span> {q.questionText}
                  </p>
                  <SurveyAnswerReadonly
                    questionType={q.questionType}
                    answerValue={q.answerValue}
                    options={q.options}
                  />
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}
