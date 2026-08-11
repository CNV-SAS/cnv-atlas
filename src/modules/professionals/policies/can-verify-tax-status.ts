import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// Quién puede VER el RUT de un integrante y verificar su estado tributario (A2). Es trabajo OPERATIVO
// recurrente (leer un PDF, llenar tres campos), no gobernanza; por eso admin, no dirección. Pendiente de
// decisión al construir la superficie de verificación (sub-tarea 5): si el rol operativo (soporte) también
// debería poder, es exactamente el tipo de tarea que le corresponde. Por ahora, admin.
export function canVerifyTaxStatus(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin"]);
}
