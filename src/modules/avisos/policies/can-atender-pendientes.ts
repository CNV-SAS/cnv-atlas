import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien ATIENDE los pendientes de ventas: los ve en /pagos y los marca "en gestion". Son los
// roles que pueden tener la marca de los avisos (admin, direccion y soporte; Santiago, 2026-09-15). Un correo que
// llega a quien no puede abrir el panel no sirve de nada.
//
// ATENDER NO ES RESOLVER: resolver una revision, registrar la nota credito y reintentar facturas siguen siendo de
// quien ve el ingreso (`canViewRevenue`: admin y direccion).
export function canAtenderPendientesVentas(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "direccion", "soporte"]);
}
