// EL FILTRO DEL CATALOGO QUE SE OFRECE AL PRESCRIBIR. Modulo NEUTRO: lo usan el lector del tratamiento y su
// test contra la base, que asi prueba el mismo texto que corre y no una copia.
//
// Oculta solo los productos DE PRUEBA que no estan a la venta (los "PRUEBA SMOKE BLOQUE 3 (retirado ...)" que
// deja cada smoke y no se pueden borrar). Un producto REAL "aun no disponible" se sigue mostrando: el
// profesional debe saber que el modelo lo contempla (cotejo 2026-08-24).
export const FILTRO_CATALOGO_PRESCRIBIBLE = "is_test.eq.false,commercial_availability.eq.en_consultorio";
