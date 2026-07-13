import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla dura 3): quien puede SOLICITAR un grant de acceso a las notas. Solo los
// roles internos operativos sin relacion clinica directa: admin y soporte. El profesional
// ya ve a sus pacientes por la via normal; direccion y obbia no acceden a contenido
// clinico. El rol aprobador de cada solicitud lo fija computeApproverRole (grant-rules).
export function canRequestAccess(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}
