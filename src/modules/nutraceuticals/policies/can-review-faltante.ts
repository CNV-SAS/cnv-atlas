import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policies del caso de faltante (T3b-3 ST4, regla 3). Segregacion de funciones: admin PROPONE la
// clasificacion (incluido injustificado); direccion CONFIRMA el cargo. Ni un solo administrativo cobra solo.
export function canClassifyFaltante(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
export function canConfirmFaltante(user: CurrentUser): boolean {
  return hasRole(user, "direccion");
}
export function canSeeFaltanteQueue(user: CurrentUser): boolean {
  return hasRole(user, "admin") || hasRole(user, "direccion");
}
