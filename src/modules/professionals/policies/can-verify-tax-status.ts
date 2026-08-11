import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// Quién puede VER el RUT de un integrante y verificar/rechazar su estado tributario (A2). Es trabajo
// OPERATIVO recurrente (leer un PDF, llenar tres campos), no gobernanza; por eso admin y SOPORTE (el rol
// operativo), no dirección. Decidido en la sub-tarea 5.
export function canVerifyTaxStatus(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}
