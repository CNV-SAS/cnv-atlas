import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien puede ver el inventario y los comodatos en su conjunto.
// admin y soporte (espeja la RLS de SELECT de devices). El profesional ve solo
// sus asignaciones, pero eso lo resuelve la RLS, no esta vista de inventario.
export function canViewComodato(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}
