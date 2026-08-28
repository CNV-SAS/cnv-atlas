import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (regla 3): quien puede registrar la revocacion de una autorizacion del paciente.
//
// LAS DOS VIAS NO LAS DECIDIMOS NOSOTROS: estan en el texto que el paciente FIRMA. `CONSENT_ATLAS.md`
// seccion 10: "Puede revocar esta autorizacion en cualquier momento ante el profesional de salud O
// escribiendo a protecciondatos@cnvsystem.com". De ahi salen exactamente dos actores:
//   - PROFESIONAL: a peticion del paciente en consulta.
//   - ADMIN: el canal de proteccion de datos (`DATA_GOVERNANCE.md`, Derechos del titular; en MVP la
//     atencion de ese canal es manual, y esto es el instrumento que le faltaba).
//
// SOPORTE NO ENTRA: no ve PII de paciente, y esto es un acto sobre la relacion con una persona concreta.
//
// NO HAY VIA DIRECTA DEL PACIENTE, y es deliberado: el documento firmado no la promete, y darsela exigiria
// autenticarlo (el paciente no tiene sesion en Atlas). Construirla seria construir de mas.
//
// EL ALCANCE REAL LO IMPONE RLS, no esto: `patient_consents_update` deja escribir solo al profesional del
// paciente (is_patient_professional) o a admin. Esta policy decide si la SUPERFICIE se ofrece.
export function canRevokeConsent(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "professional"]);
}
