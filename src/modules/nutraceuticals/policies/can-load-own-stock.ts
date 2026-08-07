import { hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien registra RECEPCIONES en su propio inventario de consignacion. Es el
// PROFESIONAL (su stock, su custodia); la RLS acota ademas a que la fila sea suya
// (is_own_professional_profile). No un auxiliar: entregar/recibir producto en custodia es parte del acto
// clinico (cierra la prescripcion), no un movimiento operativo separado (ver BACKLOG, guard del despacho).
export function canLoadOwnStock(user: CurrentUser): boolean {
  return hasRole(user, "professional");
}
