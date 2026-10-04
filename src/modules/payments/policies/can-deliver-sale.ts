import { hasAnyRole, hasRole, type CurrentUser } from "@/modules/auth/roles";

// Policy (regla 3): quien registra la ENTREGA de una venta. El profesional de la venta, que es quien tiene el
// producto en su consultorio y se lo da al paciente; y el admin (operativo). Direccion ve las ventas pero no
// entrega: no tiene producto en la mano.
//
// `ownProfessionalId` es el perfil profesional del usuario (null si no tiene): la venta guarda el perfil, no
// la persona.
//
// ═══ Y UNA VENTA QUE SALE DE LA BODEGA NO LA ENTREGA EL PROFESIONAL (Santiago, smoke del 2026-10-04) ═══
//
// LO QUE PASO: cobro OMEGA COMPLEX desde la bodega (no tiene unidades de ese producto) y la pantalla le dejo
// marcar "Entregado". Al hacerlo, el aviso de "falta despacharla" DESAPARECIO: admin nunca se entera y nadie
// le lleva el producto al paciente. Es exactamente el olvido invisible que ese aviso existe para evitar.
//
// Y LO QUE LO HACE PEOR, que es la leccion: la pantalla YA DECIA "Sale de la bodega de CNV: falta despacharla",
// y su comentario afirmaba que esa linea "es lo que evita que el profesional la de por entregada". No evitaba
// nada: era texto. **Un comentario que afirma una garantia que el codigo no da es peor que no tenerlo**, porque
// el siguiente que lea el archivo se queda tranquilo.
//
// El producto no estuvo nunca en sus manos, asi que su entrega la registra QUIEN DESPACHA, en CNV.
export function canDeliverSale(
  user: CurrentUser,
  venta: { professional_id: string | null; location_id?: string | null },
  ownProfessionalId: string | null,
  /**
   * La ubicacion de inventario del usuario (su vitrina), o null si no tiene.
   *
   * ES OBLIGATORIO Y NO OPCIONAL a proposito: un parametro con defecto dejaria que un sitio nuevo omitiera el
   * dato y recuperara el agujero sin que nada fallara, que es como volvio el guard de la pregunta retirada.
   * Quien llama tiene que decidir, aunque sea para pasar null.
   */
  ownLocationId: string | null,
): boolean {
  if (hasRole(user, "admin")) return true;
  // SALE DE OTRA UBICACION QUE NO ES LA SUYA: la despacha CNV. Se compara con la ubicacion, no con una bandera
  // aparte, porque `transactions.location_id` ES el hecho ("de donde sale el producto"), sellado al cobrar.
  if (venta.location_id != null && ownLocationId != null && venta.location_id !== ownLocationId) return false;
  return (
    hasAnyRole(user, ["professional"]) &&
    ownProfessionalId != null &&
    venta.professional_id === ownProfessionalId
  );
}
