import { hasRole, type CurrentUser } from "../roles";

// Policy contextual (SECURITY.md): quien puede entrar a la administracion.
export function canAccessAdmin(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
