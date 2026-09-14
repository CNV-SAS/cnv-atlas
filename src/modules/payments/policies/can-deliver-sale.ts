import { hasAnyRole, hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien registra la ENTREGA de una venta. El profesional de la venta, que es quien tiene el
// producto en su consultorio y se lo da al paciente; y el admin (operativo). Direccion ve las ventas pero no
// entrega: no tiene producto en la mano.
//
// `ownProfessionalId` es el perfil profesional del usuario (null si no tiene): la venta guarda el perfil, no
// la persona.
export function canDeliverSale(
  user: CurrentUser,
  venta: { professional_id: string | null },
  ownProfessionalId: string | null,
): boolean {
  if (hasRole(user, "admin")) return true;
  return (
    hasAnyRole(user, ["professional"]) &&
    ownProfessionalId != null &&
    venta.professional_id === ownProfessionalId
  );
}
