// Si una venta sigue BLOQUEADA por la revision (no se entrega). Modulo NEUTRO: lo usan /pagos y Tratamiento.
//
// La bloquean la revision abierta y la devuelta. Las otras dos resoluciones la dejan como venta valida: la
// segunda compra, y el efectivo no recibido (0142), donde el pago de Wompi pasa a ser LA venta.
export function bloqueadaPorRevision(v: { review_reason: string | null; review_resolution: string | null }): boolean {
  return Boolean(v.review_reason) && v.review_resolution !== "segunda_compra" && v.review_resolution !== "efectivo_no_recibido";
}

/** Desde cuantos casos de "efectivo no recibido" del mismo Integrante en 90 dias se escala (Santiago, 2026-09-14). */
export const ESCALADA_EFECTIVO_NO_RECIBIDO = 2;
