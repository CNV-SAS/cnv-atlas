import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// Policies de gestion de evaluaciones por sesion (regla 3). El alcance fino por
// paciente (is_patient_professional) lo impone la RLS al leer/escribir; estas solo
// gobiernan el rol.

// Confirmar identidad: el profesional del paciente o un admin.
export function canConfirmIdentity(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}

// Emitir link de seguimiento: el profesional (dueno del link) o un admin. El
// professional_id del link es el del profesional asignado al paciente; cuando lo
// emite un admin se resuelve a ese profesional (mismo patron que el checkout de B6).
// La RLS (survey_links_insert) ya admite ambos: el profesional dueno y admin.
export function canEmitFollowupLink(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}

// Gestionar el link base (inicial reusable) de consultorio del profesional. Es del
// propio profesional; la accion resuelve el professional_id del usuario autenticado.
export function canManageBaseSurveyLink(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
