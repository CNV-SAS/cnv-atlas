import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien ajusta stock. admin y soporte, espejando la RLS de
// escritura de nutraceutical_inventory.
export function canManageInventory(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}
