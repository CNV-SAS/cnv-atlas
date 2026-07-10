import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (SECURITY.md): quien ve el tablero consolidado de direccion. Direccion
// y admin (regla 3). Los datos financieros que lo alimentan estan ademas restringidos por
// RLS a esos roles.
export function canViewDireccion(user: CurrentUser): boolean {
  return hasAnyRole(user, ["direccion", "admin"]);
}
