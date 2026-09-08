import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (regla 3): quien puede crear un paciente EN CONSULTA, con consentimiento presencial.
//
// SOLO PROFESIONAL, y no es una restriccion cosmetica: quien crea firma tambien la declaracion
// ("presente el consentimiento al paciente... verifique su identidad contra su documento"). Es una
// afirmacion sobre un acto que ocurrio delante de quien la hace. Un admin que no estuvo en el consultorio
// no puede declarar eso, y darle el boton seria invitarlo a afirmarlo.
//
// SE APARTA A PROPOSITO de `canViewPatients` (admin + profesional): ver la lista y estar en la sala son
// cosas distintas. El alcance fino (que el paciente quede atado a el) lo impone el professional_id que la
// action resuelve del usuario autenticado, no el formulario.
export function canCreatePatientPresencial(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional"]);
}
