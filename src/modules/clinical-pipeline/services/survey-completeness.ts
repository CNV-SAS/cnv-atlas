// Completitud de la encuesta COMPLETA (las 64 preguntas de la version, no solo las 13 del diagnostico).
// Gildardo §1 (2026-08-13): "el profesional no puede atender a ningun paciente si la encuesta no esta
// completa", y §7 del 12: "todas las variables se requieren, no hay poda". El gate al GENERAR/REGENERAR
// exige que TODA pregunta de la version tenga respuesta (no solo `used_in_diagnosis`). Dentro de la
// encuesta no hay preguntas opcionales por diseno (los sociodemograficos/etnia viven FUERA, en el perfil,
// y son opcionales aparte); toda pregunta se le muestra a todo paciente y tiene respuesta valida ("No se",
// "Ninguna", 0). Este modulo es PURO (sin BD): lo alimentan el reader (generar) y correct-evaluation
// (regenerar) con la misma nocion de "respondida".

// Token de texto libre "otra/otro/otras/otros" PELADO (sin ": texto"). Cubre LAS CUATRO flexiones (no
// solo otra/otros): un "Otras" verbatim de Gildardo ya se colo una vez como no-match latente (d6_43), y
// "Otro" masculino (motivo) es de la misma familia. Coherente con el intake (survey-widgets `isOtherOption`
// y `splitOther`); los tres se mantienen en sync. Un elemento asi = eligio "otra" pero no escribio el texto.
const isBareFreeTextOther = (el: string): boolean => /^otr[oa]s?$/i.test(el.trim());

// Una respuesta cuenta como COMPLETA para el gate si tiene valor real. Distingue AUSENTE de VACIO:
// null/""/"[]" (multi sin marcar) es SIN RESPONDER; "0" (contador tocado en cero) SI es respuesta.
// Ademas: una multi que eligio "otra" SIN escribir el texto ("Otra" pelado, no "Otra: <texto>") NO
// cuenta como completa (misma familia "ausencia disfrazada de dato" que el contador en 0; si eligio
// "otra" es porque tiene algo que decir). El INTAKE lo permite (patient-facing); el gate lo exige.
export function isAnswered(value: string | null | undefined): boolean {
  if (value == null) return false;
  const s = value.trim();
  if (s === "" || s === "[]") return false;
  if (s.startsWith("[")) {
    let arr: unknown;
    try {
      arr = JSON.parse(s);
    } catch {
      return true; // no parseable: conservador, no inventa un hueco
    }
    if (Array.isArray(arr)) {
      if (arr.length === 0) return false;
      // "otra" elegida sin texto -> incompleta, aunque el arreglo no este vacio.
      if (arr.some((el) => typeof el === "string" && isBareFreeTextOther(el))) return false;
    }
  }
  return true;
}

export type SurveyGap = { section: string; missing: number };

type QuestionAnswer = { section: string | null; orderIndex: number; answerValue: string | null };

// Huecos por dominio, en el ORDEN de la encuesta (orderIndex). Solo los dominios con faltantes. El
// dominio sin etiqueta cae en "Otras". El orden permite enlazar "al primero que falta".
export function computeSurveyGaps(questions: QuestionAnswer[]): SurveyGap[] {
  const ordered = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const bySection = new Map<string, number>(); // section -> faltantes, en orden de aparicion
  for (const q of ordered) {
    if (isAnswered(q.answerValue)) continue;
    const section = q.section ?? "Otras";
    bySection.set(section, (bySection.get(section) ?? 0) + 1);
  }
  return [...bySection.entries()].map(([section, missing]) => ({ section, missing }));
}

export function totalMissing(gaps: SurveyGap[]): number {
  return gaps.reduce((sum, g) => sum + g.missing, 0);
}

// Mensaje para el profesional: dice CUANTAS faltan en total y POR DOMINIO (util con muchas: sabe por
// donde empezar). Espanol correcto (lo ve un profesional).
export function formatIncompleteSurveyMessage(
  gaps: SurveyGap[],
  action: "generar" | "regenerar" = "generar",
): string {
  const total = totalMissing(gaps);
  const porDominio = gaps.map((g) => `${g.section} (${g.missing})`).join(", ");
  const plural = total === 1 ? "falta 1 respuesta" : `faltan ${total} respuestas`;
  return `La encuesta está incompleta: ${plural}. Por dominio: ${porDominio}. Complétala con el paciente antes de ${action} el diagnóstico.`;
}
