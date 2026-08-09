// Tipos de las lecturas de remesa. Viven en un módulo NEUTRO (sin `server-only`) porque los importa un
// componente CLIENTE (confirmar-remesa-section usa PendingRemesa). Un tipo que cruza la frontera
// cliente/servidor no puede vivir en el service `server-only`: la arista dejaría el service al alcance del
// boundary de cliente y el bundler de producción podría romperlo. El service los re-exporta para el servidor.

export type PendingRemesa = {
  remesaId: string;
  nutraceuticalId: string;
  nutraceuticalName: string;
  declaredQuantity: number;
  lote: string | null;
  declaredAt: string;
};

// Estado con DIRECCIÓN: no solo "con diferencia", sino si FALTÓ (llegó menos) o SOBRÓ (llegó más).
export type RemesaStatus = "enviada" | "confirmada" | "confirmada_faltante" | "confirmada_sobrante";

export type CnvRemesa = {
  remesaId: string;
  professionalId: string;
  professionalName: string;
  nutraceuticalName: string;
  declaredQuantity: number;
  receivedQuantity: number | null; // lo REPORTADO por el integrante; null si aún no confirmada
  difference: number | null; // reportado − declarado (con signo); null si no confirmada
  status: RemesaStatus;
  declaredAt: string;
};

export type UnbackedReception = {
  movementId: string;
  professionalId: string;
  professionalName: string;
  nutraceuticalName: string;
  quantity: number;
  lote: string | null;
  receivedAt: string;
};

// Para el formulario de declaración: a quién (solo los que pueden sostener consignación) y qué producto.
export type EligibleProfessional = { professionalId: string; name: string };
export type RemesableProduct = { id: string; name: string };
