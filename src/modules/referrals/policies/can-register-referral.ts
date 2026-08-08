import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien registra una remision o marca el retorno. Es el PROFESIONAL que atiende al
// paciente. La pertenencia al paciente (que sea SU paciente) la impone la RLS (`is_patient_professional`),
// no un role=== suelto: por eso esta policy solo gatea el rol, y el "sobre SU paciente" lo verifica el
// reader RLS antes de escribir. Cualquier profesional asignado al paciente puede marcar el retorno, no solo
// el que registro la remision (pueden haber pasado meses y ser otro el que atiende cuando el paciente vuelve).
export function canRegisterReferral(user: CurrentUser): boolean {
  return hasRole(user, "professional");
}
