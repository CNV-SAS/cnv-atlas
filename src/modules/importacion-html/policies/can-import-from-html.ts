import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Quien revisa e importa pacientes del HTML de Gildardo: SOLO admin (decision de Santiago, 2026-09-21). El
// legal dice que la importacion la hace CNV; soporte no (regla dura 3: la autorizacion vive en la policy).
export function canImportFromHtml(user: CurrentUser): boolean {
  return hasRole(user, "admin");
}
