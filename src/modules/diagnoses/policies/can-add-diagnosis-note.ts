import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// Policy para agregar una nota de criterio del profesional a un diagnostico (regla dura 3).
// Gobierna el rol; el alcance fino (que el diagnostico sea de un paciente del profesional) lo
// impone la RLS al resolver el diagnostico en el reader antes de escribir.
export function canAddDiagnosisNote(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
