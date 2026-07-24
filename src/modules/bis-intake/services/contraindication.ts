import type { BisCondition, BisConditionAnswers } from "../types";

// Compuerta de seguridad del import BIS. contraindicated = true SOLO si alguna condicion de tipo
// 'contraindicacion' (hoy unicamente el marcapasos) fue respondida con booleano ESTRICTO true.
//
// El `=== true` es deliberado, no un truthy: el modelo de respuesta admite numeros (la semana del
// ciclo) y texto, y un truthy dejaria que semana_ciclo = 3 o un texto no vacio dispararan el
// bloqueo. Es una compuerta fisica (la corriente de la BIA puede danar el dispositivo), asi que la
// condicion se evalua explicita y estricta.
export function computeContraindicated(
  conditions: BisCondition[],
  answers: BisConditionAnswers,
): boolean {
  return conditions.some(
    (c) => c.kind === "contraindicacion" && answers[c.key]?.value === true,
  );
}

// Advertencias activas (hoy el embarazo): condiciones 'advertencia' respondidas con true. NO
// bloquean la medicion, pero exigen el reconocimiento explicito del profesional antes de continuar
// (el permiso del comite de etica es requisito de procedimiento). Devuelve las condiciones para que
// el llamador exija su reconocimiento y lo selle.
export function activeWarnings(
  conditions: BisCondition[],
  answers: BisConditionAnswers,
): BisCondition[] {
  return conditions.filter(
    (c) => c.kind === "advertencia" && answers[c.key]?.value === true,
  );
}
