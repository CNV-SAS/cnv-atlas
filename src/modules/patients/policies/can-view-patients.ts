import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (regla 3): quien ve la seccion de pacientes. Profesional y admin.
// Soporte NO entra aqui: por RLS no ve patient_profiles (nombres), su acceso a dato de
// paciente es seudonimizado. El alcance real de los datos lo impone RLS
// (is_patient_professional): el profesional ve solo sus pacientes, admin todos.
export function canViewPatients(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "professional"]);
}
