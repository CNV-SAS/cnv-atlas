import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla dura 3): quien puede entrar a la bandeja de aprobaciones. Solo los roles
// que pueden ser aprobadores segun la matriz: admin (aprueba a soporte) y direccion
// (aprueba a admin). Es la puerta de la pantalla; la decision de un grant concreto la
// gobierna canDecideGrant (grant-rules): el aprobador debe tener el rol que el grant
// designo y no ser el propio solicitante.
export function canApproveAccess(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "direccion"]);
}
