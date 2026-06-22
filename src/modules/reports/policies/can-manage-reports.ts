import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// Policy de gestion de reportes por sesion (regla dura 3). Gobierna el rol; el alcance
// fino (que el reporte sea de un paciente del profesional) lo impone la RLS al leer el
// reporte (getReportDispatch) antes de aprobar/enviar.
export function canManageReports(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
