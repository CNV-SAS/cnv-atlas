// D-007 Fase A (PURA, sin server-only ni BD): los dominios de encuesta que ALIMENTAN el diagnostico y
// quedaron incompletos, derivados de dfi.missingFieldKeys (sellado en el snapshot) + la seccion de cada
// pregunta (versionada). Devueltos en el ORDEN de dominios de la encuesta. NO sella nada nuevo: es
// reconstruible de lo que ya esta sellado (missingFieldKeys + survey_version_id). Solo INFORMA; la
// suspension real de EB-BIS/ICEC/rutas es la Fase B (plan-review, decision de dependencia de Gildardo).

// Forma minima que necesita (estructural, para no acoplar a survey-answers-reader ni arrastrar
// server-only a este modulo puro).
type DomainLike = { section: string; questions: { fieldKey: string | null }[] };

export function missingDomainsFrom(
  missingFieldKeys: string[] | undefined | null,
  surveyDomains: DomainLike[] | null | undefined,
): string[] {
  const missing = missingFieldKeys ?? [];
  if (!surveyDomains || missing.length === 0) return [];
  const sectionByField = new Map<string, string>();
  for (const d of surveyDomains) {
    for (const q of d.questions) if (q.fieldKey) sectionByField.set(q.fieldKey, d.section);
  }
  const missingSections = new Set(
    missing.map((fk) => sectionByField.get(fk)).filter((s): s is string => Boolean(s)),
  );
  // En el orden de la encuesta, sin duplicados.
  return surveyDomains.map((d) => d.section).filter((s) => missingSections.has(s));
}
