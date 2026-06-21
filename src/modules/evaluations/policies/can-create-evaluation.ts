import { type ConsentType, NECESSARY_CONSENT_TYPES } from "@/modules/consent/validations";

// Gate de consentimiento (regla dura 15). Es el unico hogar de la regla: no se crea
// ninguna evaluacion sin las 3 autorizaciones necesarias vigentes (servicio,
// datos_sensibles, internacional_ia; revoked_at IS NULL). Aplica al intake inicial
// y al de seguimiento. Se verifica ANTES de insertar la evaluacion, nunca despues.

export type ConsentGateResult = { ok: true } | { ok: false; missing: ConsentType[] };

// activeConsentTypes: los consent_type del paciente con revoked_at IS NULL.
export function canCreateEvaluation(
  activeConsentTypes: readonly ConsentType[],
): ConsentGateResult {
  const active = new Set(activeConsentTypes);
  const missing = NECESSARY_CONSENT_TYPES.filter((t) => !active.has(t));
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}
