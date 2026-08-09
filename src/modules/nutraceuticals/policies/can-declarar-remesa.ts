import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Declarar una remesa (E2) = CNV declara que envió producto en consignación al integrante. Es LOGÍSTICA de
// CNV, no gobierno: admin y soporte (el rol operativo, "Operaciones"). El integrante NO declara (él recibe);
// espeja el modelo recepción=receptor / remesa=emisor. Misma pareja de roles que can-manage-inventory.
export function canDeclararRemesa(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}

// Ver el lado CNV de la remesa (lista con estado + recepciones no respaldadas) = quien puede declarar.
export function canSeeRemesasCnv(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin", "soporte"]);
}
