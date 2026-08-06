import "server-only";

import * as Sentry from "@sentry/nextjs";

import { PATRON_FIELD_KEYS, resolvePatron, type PatronResolution } from "@/clinical-engine";
import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-reader";

// Adapta las respuestas de encuesta ya leidas (entrySurvey, SurveyDomain[]) al reader del patron y
// devuelve su estado. NO hace query propia: reusa lo que la pagina ya trajo (display compute-at-view-
// time, no se sella). El estado `ilegible` es un DEFECTO del sistema: se registra en Sentry aca (ruidoso
// en monitoreo) ademas de mostrarse en pantalla, para que alguien lo arregle; el profesional no debe
// intentar interpretarlo.

const PATRON_SET = new Set(PATRON_FIELD_KEYS);

export function resolvePatronView(domains: SurveyDomain[]): PatronResolution {
  const patronQuestions = domains
    .flatMap((d) => d.questions)
    .filter((q) => q.fieldKey != null && PATRON_SET.has(q.fieldKey));

  const declaredPatronKeys = patronQuestions.map((q) => q.fieldKey as string);
  const answers = patronQuestions.map((q) => ({ fieldKey: q.fieldKey as string, answerValue: q.answerValue }));

  const resolution = resolvePatron(declaredPatronKeys, answers);

  if (resolution.status === "ilegible") {
    Sentry.captureMessage("patron alimentario: respuesta ilegible (acoplamiento encuesta-frozen)", {
      level: "error",
      tags: { area: "patron-reader" },
      extra: { offenders: resolution.offenders },
    });
  }

  return resolution;
}
