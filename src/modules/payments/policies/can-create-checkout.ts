import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien crea un checkout de nutraceuticos. El profesional (que le
// vende a su paciente) y el admin (operativo). La comision se sella al profesional
// que cree el checkout, o al profesional asignado al paciente si lo crea un admin.
export function canCreateCheckout(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
