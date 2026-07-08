import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// Policy de gestion del protocolo de tratamiento por sesion (regla dura 3). Gobierna el
// rol; el alcance fino (que el tratamiento sea de un paciente del profesional) lo impone
// la RLS al leer el tratamiento (treatment-reader) antes de escribir. El gate clinico
// adicional (diagnostico confirmado) se verifica en el reader y se re-chequea en el writer.
export function canManageTreatment(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
