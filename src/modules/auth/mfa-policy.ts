import { hasAnyRole, type AppRole, type CurrentUser } from "./roles";

// Roles internos de CNV. Sirven para el shell por rol y otras decisiones; NO son ya el set de MFA.
export const INTERNAL_ROLES: AppRole[] = ["admin", "direccion", "soporte", "obbia"];

// MFA OBLIGATORIA (gate Hito 2): internos + PROFESIONAL. Un profesional que pierde su cuenta expone las
// historias clinicas de TODOS sus pacientes; los integrantes son profesionales independientes con sus
// propios equipos, asi que la MFA no puede ser opcional (opcional = casi nadie la activa = no protege).
// Un usuario SIN rol requerido (p. ej. un hipotetico paciente con cuenta) NO se fuerza.
export const MFA_REQUIRED_ROLES: AppRole[] = [...INTERNAL_ROLES, "professional"];

export type MfaRequirement = "ok" | "enroll" | "challenge";

// Decide si el usuario debe configurar MFA, completar el challenge, o ya esta bien. Pura y testeable.
// Solo se fuerza a los roles de MFA_REQUIRED_ROLES; cualquier otro (sin rol o no requerido) queda "ok".
export function mfaRequirement(
  user: CurrentUser,
  hasVerifiedTotp: boolean,
  currentLevel: string | null,
): MfaRequirement {
  if (!hasAnyRole(user, MFA_REQUIRED_ROLES)) return "ok";
  if (!hasVerifiedTotp) return "enroll";
  if (currentLevel !== "aal2") return "challenge";
  return "ok";
}
