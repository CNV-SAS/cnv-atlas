import { hasRole, type CurrentUser } from "../roles";

// Policy contextual (SECURITY.md): quien puede crear/gestionar usuarios.
export function canManageUsers(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
