// QUE VENTAS PAGADAS CUENTAN COMO COBRO RECONOCIDO. Modulo NEUTRO: lo usan los tableros y su test contra la base.
//
// UNA VENTA EN REVISION NO CUENTA (contabilidad, 2026-09-14). Un pago aprobado sobre un link anulado entro a la
// cuenta puente de Wompi como PASIVO, no como ingreso: todavia no se sabe si hubo venta o si hay que
// devolverlo. Hasta que se resuelva, no suma en ningun reporte de cobro.
//
// Al resolverse sale solo: "segunda compra" la deja pagada y con resolucion (cuenta), y "devuelto" la pasa a
// `refunded` (ya no es `paid`).
//
// Es un `or` de PostgREST y va junto al `.eq("status", "paid")` de cada lector.
export const FILTRO_FUERA_DE_REVISION = "review_reason.is.null,review_resolution.not.is.null";
