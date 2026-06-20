import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien ve los ingresos y comisiones agregados. admin y direccion,
// espejando la RLS de SELECT de cnv_revenue. El profesional ve solo sus propias
// transacciones por la RLS de transactions, no toda la facturacion.
export function canViewRevenue(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "direccion"]);
}
