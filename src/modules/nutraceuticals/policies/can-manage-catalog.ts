import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien puede gestionar el catalogo (crear/editar nutraceuticos).
// Solo admin, espejando la RLS de escritura de nutraceuticals.
export function canManageCatalog(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
