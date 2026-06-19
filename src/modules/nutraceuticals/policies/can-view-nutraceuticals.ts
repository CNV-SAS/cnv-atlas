import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien ve la pagina de nutraceuticos (catalogo + inventario).
// admin, soporte y direccion, espejando la RLS de SELECT de nutraceutical_inventory.
export function canViewNutraceuticals(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte", "direccion"]);
}
