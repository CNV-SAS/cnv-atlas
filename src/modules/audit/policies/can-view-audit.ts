import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (SECURITY.md): quien consulta el registro de auditoria clinica. Solo
// admin (espeja la RLS admin-only de clinical_audit_log; regla dura 3).
export function canViewAudit(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
