import { createHash } from "node:crypto";

import { CONSENT_TEXT_V1_5, CONSENT_VERSION } from "./text/consent-v1.5";

// Calculo reproducible de patient_consents.document_hash (regla C1 de DELTA.md).
//
// El hash identifica la VERSION del texto del consentimiento, no la instancia
// firmada por un paciente concreto: por eso se calcula sobre el texto canonico con
// los placeholders intactos (sin rellenar con el profesional). Dos pacientes que
// aceptan la misma version comparten el mismo document_hash; el profesional y el
// momento de la firma se registran aparte.

// Normalizacion fija antes de hashear: saltos de linea LF y sin espacios en blanco
// al final de cada linea. Idempotente: el texto vendorizado ya viene normalizado,
// pero la funcion no asume nada de su entrada.
export function normalizeConsentText(text: string): string {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

// SHA-256 (hex) del texto normalizado, codificado UTF-8.
export function computeConsentHash(text: string): string {
  return createHash("sha256").update(normalizeConsentText(text), "utf8").digest("hex");
}

// Hash vigente del consentimiento v1.5. Se computa desde el texto canonico, no se
// fija como literal: el test ancla el valor esperado para que cualquier cambio del
// texto rompa la prueba (protege la trazabilidad legal).
export const CONSENT_DOCUMENT_HASH = computeConsentHash(CONSENT_TEXT_V1_5);

export { CONSENT_VERSION };
