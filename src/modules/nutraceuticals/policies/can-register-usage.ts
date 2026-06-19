import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien puede registrar uso de nutraceuticos. El rol es
// professional; la RLS acota ademas a que sea el profesional del paciente del
// tratamiento. Sin UI en B5 (el registro vive en el flujo de tratamiento, B12).
export function canRegisterUsage(user: CurrentUser): boolean {
  return hasRole(user, "professional");
}
