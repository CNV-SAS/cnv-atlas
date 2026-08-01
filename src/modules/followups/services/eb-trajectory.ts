// P0 Parte 2: el CAMBIO de la EB-BIS entre mediciones, mostrado al PACIENTE en tres bandas (mejoró /
// sin cambio / empeoró), NO el nivel ni la cifra. Núcleo PURO y testeable; el cableado a datos (elegir
// la previa comparable) y al reporte va aparte.
//
// DISENO CLAVE (requisito de Santiago): la banda es un DATO disponible ANTES de generar el reporte, no
// algo que aparece dentro del PDF ya armado. Asi, si Gildardo decide que "empeoró" exige que el
// profesional lo RECONOZCA antes de aprobar el reporte (como el ack de restricciones del menú o la
// confirmación del diagnóstico), ese gate se cablea sin rehacer nada: la banda ya es un valor que el
// flujo de aprobación puede mirar. Query registrada para Gildardo.
//
// REDACCION (de cara al paciente) = AUTORIA DE GILDARDO, no nuestra. Los textos de abajo son
// PLACEHOLDERS deliberadamente neutros, marcados provisionales, hasta que él los redacte. En especial
// "empeoró": NUNCA comunica un juicio (dirige al profesional), porque comunicar un empeoramiento sin
// su redacción es la comunicación más delicada del sistema.

// Corte de banda en años. OPERATIVO/PROVISIONAL (decisión de Gildardo, P0): se reemplaza por el
// "cambio mínimo detectable" cuando exista. Vive aquí, en TS, NO en la ciencia congelada: cambiable
// sin tocar el motor. Se SELLA junto a la banda al finalizar el reporte (ver 3a), para poder
// reconstruir por qué ese reporte dijo lo que dijo.
export const EB_CHANGE_BAND_YEARS = 2;

// Intervalo mínimo entre mediciones comparables (decisión de Gildardo, P0).
export const MIN_COMPARABLE_WEEKS = 12;

export type EbBand = "mejoro" | "sin_cambio" | "empeoro";

// EB más BAJA = más joven = mejor. delta = EB actual − EB previa: negativo = mejoró, positivo = empeoró.
export function ebBand(ebDelta: number, cutYears: number = EB_CHANGE_BAND_YEARS): EbBand {
  if (ebDelta <= -cutYears) return "mejoro";
  if (ebDelta >= cutYears) return "empeoro";
  return "sin_cambio";
}

// Texto de cara al PACIENTE por banda. PLACEHOLDER PROVISIONAL: la redacción final es de Gildardo
// (ver GILDARDO_QUERIES). No revela el constructo (no dice "edad bioeléctrica") ni el nivel ni la cifra.
export const BAND_TEXT_PLACEHOLDER: Record<EbBand, string> = {
  mejoro: "Tu estado funcional muestra una mejora respecto a tu evaluación anterior.",
  // OJO (query): con el corte ±2 provisional, un cambio de 1.9 años cae aquí; "se mantuvo estable"
  // afirma algo que el modelo aún no sostiene. Redacción prudente pendiente de Gildardo.
  sin_cambio: "Tu estado funcional se mantuvo estable respecto a tu evaluación anterior.",
  // NEUTRO A PROPOSITO: no comunica el empeoramiento; dirige al profesional. La redacción real (y qué
  // la acompaña) es autoría de Gildardo.
  empeoro: "Tu evaluación muestra cambios que tu profesional revisará contigo.",
};

export type EbTrajectory = {
  band: EbBand;
  ebDelta: number;
  cutYears: number; // el corte con el que se calculó la banda (se sella junto a la banda)
  comparedToEvaluationId: string;
  comparedToDate: string; // fecha de la medición comparable
  intervalWeeks: number;
  provisional: true; // hoy siempre: la calibración de la EB-BIS es provisional (P0)
};

// Candidato: una evaluación anterior del paciente con diagnóstico compatible (EB sellada) y su fecha.
export type PriorEvaluation = { evaluationId: string; date: string; eb: number | null };

// Semanas entre dos fechas ISO (>=0). Puro; el caller pasa las fechas selladas.
export function weeksBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return ms / (1000 * 60 * 60 * 24 * 7);
}

// Elige la PREVIA COMPARABLE (3b): la anterior MAS RECIENTE cuyo intervalo a la actual sea >=12
// semanas, con EB sellada. Gate sobre el INTERVALO, no la posición: si la inmediata anterior esta a
// <12 semanas pero una mas vieja califica, se usa la mas vieja. `priors` debe venir ordenada de mas
// reciente a mas antigua. Devuelve null si ninguna califica (=> el paciente ve la lectura funcional,
// como en la 1a medicion; comportamiento provisional para <12 semanas, aprobado).
export function pickComparablePrior(
  currentDate: string,
  currentEb: number | null,
  priors: PriorEvaluation[],
): EbTrajectory | null {
  if (currentEb == null) return null;
  for (const p of priors) {
    if (p.eb == null) continue;
    const weeks = weeksBetween(p.date, currentDate);
    if (weeks < MIN_COMPARABLE_WEEKS) continue; // no comparable: intervalo corto
    const ebDelta = parseFloat((currentEb - p.eb).toFixed(1));
    return {
      band: ebBand(ebDelta),
      ebDelta,
      cutYears: EB_CHANGE_BAND_YEARS,
      comparedToEvaluationId: p.evaluationId,
      comparedToDate: p.date,
      intervalWeeks: Math.round(weeks),
      provisional: true,
    };
  }
  return null;
}
