import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// Policy de import BIS por sesion (regla dura 3). Gobierna el rol; el alcance fino
// (que la evaluacion sea de un paciente del profesional) lo impone la RLS al leer la
// evaluacion en el action (getEvaluationOwnership) antes de escribir por owner.
export function canImportBis(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
