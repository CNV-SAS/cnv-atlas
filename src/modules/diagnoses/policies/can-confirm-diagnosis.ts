import { type CurrentUser, hasRole } from "@/modules/auth/roles";

// Confirmar el diagnostico es su FIRMA CLINICA: da por bueno el analisis y habilita prescribir sobre
// el (las cinco operaciones de tratamiento exigen diagnostico confirmado). PROFESIONAL-SOLO, admin NO
// (mismo criterio que approveProtocol: un rol operativo de CNV no ejecuta actos clinicos; ver
// can-edit-protocol). El alcance fino (que sea el profesional ASIGNADO a este paciente) lo verifica
// el service de forma EXPLICITA, no solo por la lectura RLS.
export function canConfirmDiagnosis(user: CurrentUser): boolean {
  return hasRole(user, "professional");
}
