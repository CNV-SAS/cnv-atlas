import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (regla 3): quien puede REASIGNAR un paciente a otro profesional.
//
// ── SOLO ADMIN, Y ES LA DIFERENCIA CON COMPLETAR UN DATO ──────────────────────────────────────────
//
// Completar el sexo o la fecha de nacimiento lo hace el profesional que tiene al paciente delante: rellena
// un hueco de SU paciente. Reasignar mueve el acceso a una historia clinica de una persona a otra, y quien
// lo pide no puede ser la misma que se lo queda ni la que lo pierde. Es un acto de la organizacion, no de
// la consulta.
//
// Y ES EXACTAMENTE LO QUE LA REGLA DURA 14 PEDIA: *"Ninguna cuenta clinica se recicla. Offboarding =
// desactivar y reasignar."* La primera mitad existia (desactivar un integrante); la segunda no existia en
// ninguna parte, asi que al desactivar a alguien sus pacientes se quedaban sin profesional que los pudiera
// abrir, o con el acceso del que ya se fue.
export function canReassignPatient(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin"]);
}
