import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// CERRAR una devolucion del Integrante a CNV (0187) = reconocer lo que llego a la bodega central. Es
// LOGISTICA de CNV, no gobierno: admin y soporte, la misma pareja que declara una remesa.
//
// Y ES LA OTRA MITAD DE LA ASIMETRIA: el Integrante DECLARA lo que despacha (can-load-own-stock, que es lo
// que ya gobierna su inventario) y CNV CIERRA con lo que recibio. La persona que declara no puede cerrar,
// porque cerrarse a si mismo es exactamente lo que vaciaria un saldo por la sola palabra de su custodio.
export function canCerrarDevolucion(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}

/** Ver el lado CNV de las devoluciones (las abiertas, con su antiguedad) = quien puede cerrarlas. */
export function canSeeDevolucionesCnv(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}
