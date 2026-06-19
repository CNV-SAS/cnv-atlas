import { hasAnyRole, type AppRole, type CurrentUser } from "./roles";

// Roles internos de CNV: MFA obligatoria en MVP. professional queda fuera (Post-MVP).
export const INTERNAL_ROLES: AppRole[] = ["admin", "direccion", "soporte", "obbia"];

export type MfaRequirement = "ok" | "enroll" | "challenge";

// Decide si el usuario debe configurar MFA, completar el challenge, o ya esta bien.
// Pura y testeable. professional (y cualquier no-interno) nunca se fuerza.
export function mfaRequirement(
  user: CurrentUser,
  hasVerifiedTotp: boolean,
  currentLevel: string | null,
): MfaRequirement {
  if (!hasAnyRole(user, INTERNAL_ROLES)) return "ok";
  if (!hasVerifiedTotp) return "enroll";
  if (currentLevel !== "aal2") return "challenge";
  return "ok";
}
