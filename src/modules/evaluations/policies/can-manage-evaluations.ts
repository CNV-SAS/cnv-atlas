import { type CurrentUser, hasAnyRole, hasRole } from "@/modules/auth/roles";

// Policies de gestion de evaluaciones por sesion (regla 3). El alcance fino por
// paciente (is_patient_professional) lo impone la RLS al leer/escribir; estas solo
// gobiernan el rol.

// Confirmar identidad: el profesional del paciente o un admin.
export function canConfirmIdentity(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}

// Emitir link de seguimiento: el profesional (es quien queda como dueno del link;
// la RLS valida que el professional_id sea el suyo). El caso admin se difiere.
export function canEmitFollowupLink(user: CurrentUser): boolean {
  return hasRole(user, "professional");
}
