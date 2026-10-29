import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUIEN PUEDE REEMITIR UN DIAGNOSTICO  ·  policy (regla dura 3)
//
// La reemision por recalibracion cientifica es un acto de la DIRECCION CIENTIFICA sobre el historico, no
// un acto de consulta: recalcula registros clinicos sellados de pacientes que un profesional atendio otro
// dia. Asi que no la autoriza la asignacion del paciente (como la correccion), la autoriza el rol.
//
// `direccion` entra junto con `admin` porque es literalmente su trabajo: la ciencia la cambia Gildardo, y
// el recalculo es la consecuencia operativa de ese cambio.
//
// NO la tiene `professional`, y es deliberado: un profesional puede corregir lo que midio mal, pero no
// reemitir el historico de otros por un cambio de version. Ni `soporte` ni `obbia`: el primero no toca
// ciencia y el segundo solo ve agregados.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
export function canReemitDiagnosis(user: CurrentUser): boolean {
  return hasRole(user, "admin") || hasRole(user, "direccion");
}
