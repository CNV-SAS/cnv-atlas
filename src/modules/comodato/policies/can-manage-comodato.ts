import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien puede gestionar el comodato (crear equipos, cambiar su
// estado, asignar y registrar devoluciones). Solo admin, espejando la RLS de
// escritura de devices/device_assignments. Nunca por role=== suelto fuera de aqui.
export function canManageComodato(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
