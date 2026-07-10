import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (SECURITY.md): quien administra la IA (proveedor/modelo activos y los
// prompts versionados). Solo admin (regla dura 3: la autorizacion vive en la policy).
export function canManageAi(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
