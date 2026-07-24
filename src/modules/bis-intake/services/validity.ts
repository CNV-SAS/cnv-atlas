import type { BisCondition, BisConditionAnswers } from "../types";

// Caveats de VALIDEZ: condiciones que comprometen la validez del resultado y fueron respondidas
// "si". Se sellan en el snapshot del diagnostico (inmutable, regla 7) para que la reserva
// sobreviva; leerlas en vivo del intake no basta porque el intake es upsert-mutable. Data-driven
// por compromisesValidity (lo llevan las condiciones kind='validez' y el embarazo: el modelo no
// esta validado en gestacion). NO bloquean la medicion; solo advierten que el resultado se
// interpreta con reserva.
export type ValidityCaveat = { key: string; label: string };

// Acepta cualquier fila con estas 3 propiedades (catalogo completo o proyeccion del reader).
export function buildValidityCaveats(
  conditions: Pick<BisCondition, "key" | "label" | "compromisesValidity">[],
  answers: BisConditionAnswers,
): ValidityCaveat[] {
  return conditions
    .filter((c) => c.compromisesValidity && answers[c.key]?.value === true)
    .map((c) => ({ key: c.key, label: c.label }));
}
