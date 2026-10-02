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

// UN EFECTIVO QUE NO SE RECIBIO TAMPOCO CUENTA (0142): la venta sigue `paid` porque su factura existe hasta la
// nota credito, pero ese dinero nunca entro. Va como `.is("cash_not_received_at", null)` en cada lector.
export const COLUMNA_EFECTIVO_NO_RECIBIDO = "cash_not_received_at";

// ═══ LO QUE VOLVIO NO SE FACTURO (smoke del 2026-09-29) ═══
//
// EL HUECO, y es el MISMO que se cerro el 2026-09-17 con otra puerta: el bruto restaba las ventas cuya
// DISPUTA se perdio (`state = 'perdida'`), porque una venta que CNV devolvio no se puede seguir contando como
// facturada. La DEVOLUCION DEL PACIENTE se construyo despues (2026-09-22) y tiene otro estado ('devuelta'),
// asi que se quedo fuera del descuento: el producto volvia, el dinero volvia, y el bruto seguia contandolo.
//
// Y NO SE RESTA LA VENTA ENTERA, que es la diferencia con la disputa: una devolucion es POR UNIDADES de UNA
// LINEA. Si el paciente compro cuatro y devolvio una, lo que dejo de facturarse es esa una. Por eso se resta
// `debited_amount`, que es lo que la reversa ya sello como devuelto al paciente, y no `transactions.amount`.
//
// LA DISPUTA PERDIDA SI RESTA ENTERA, y por eso son dos mecanismos y no uno: ahi el banco devolvio todo.
export const ESTADO_DEVUELTA = "devuelta";
export const ESTADO_DISPUTA_PERDIDA = "perdida";

/**
 * El bruto reconocido: lo pagado, menos las ventas cuya disputa se perdio (enteras) y menos lo devuelto por
 * los pacientes (proporcional).
 *
 * MODULO NEUTRO Y FUNCION PURA a proposito: la usan los DOS tableros (Inicio y Direccion). Tenerla en cada
 * lector es como se separan, y este defecto salio justamente de que uno restaba y el otro no.
 */
export function brutoReconocido(e: {
  pagadas: { id: string; amount: string | number | null }[];
  /** `transaction_id` de las reversas con la disputa perdida. */
  disputasPerdidas: string[];
  /** `debited_amount` de las devoluciones ya resueltas. */
  devoluciones: (string | number | null)[];
}): number {
  const perdidas = new Set(e.disputasPerdidas);
  const pagado = e.pagadas
    .filter((t) => !perdidas.has(t.id))
    .reduce((n, t) => n + (Number(t.amount) || 0), 0);
  const devuelto = e.devoluciones.reduce((n: number, d) => n + (Number(d) || 0), 0);
  return pagado - devuelto;
}

// ═══ EL INVENTARIO NO CUENTA LOS PRODUCTOS DE PRUEBA (smoke del 2026-09-29) ═══
//
// Direccion los excluye desde el 2026-09-18 (los "PRUEBA SMOKE" de cada smoke dejan saldo que no se puede
// borrar, porque los movimientos son inmutables) y la tarjeta de Inicio no: 1.903 contra 1.820, 83 unidades
// de diferencia sobre el mismo hecho.
//
// Es lo que ya paso con "45 referencias": dos cifras del mismo hecho en dos pantallas. El filtro vive aqui
// para que no haya un tercer sitio que lo olvide.
// TRAE TAMBIEN EL NOMBRE desde el 2026-09-30, y por eso no se escribio un embed aparte: el desglose de
// Direccion ("cuales son esos 6 productos") necesita el nombre, y dos embeds de la misma tabla en la misma
// consulta chocan. Antes de esto el lector tenia su propia copia del embed, y una copia es como se llega a
// que una pantalla excluya lo de prueba y la otra no. A Inicio le sobra el nombre y no le cuesta nada.
export const EMBED_PRODUCTO_NO_DE_PRUEBA = "nutraceuticals!inner(name, is_test)";
export const COLUMNA_PRODUCTO_DE_PRUEBA = "nutraceuticals.is_test";

/**
 * LAS VENTAS QUE NO CUENTAN PORQUE LLEVAN UN PRODUCTO DE PRUEBA (Santiago, 2026-10-01).
 *
 * EL HUECO QUE CIERRA: el filtro de productos de prueba llegaba al INVENTARIO y no al DINERO. Una venta con
 * un producto que no existe sumaba su precio al bruto y su base a la comision.
 *
 * Y UNA VENTA ES HOMOGENEA por el guard del servicio (de prueba o real, nunca las dos), asi que "lleva un
 * producto de prueba" es lo mismo que "es una venta de prueba", y excluirla entera equivale a excluir sus
 * lineas sin tocar el contador compartido.
 *
 * Se consulta UNA vez y se filtra en memoria, igual que con el profesional y el paciente: una venta puede no
 * tener lineas todavia, y un embed interno la dejaria fuera en silencio.
 */
// SE COMPARTE EL SELECT, NO UNA FUNCION QUE HABLE CON LA BASE: este modulo es NEUTRO (lo usan los lectores y
// su test), y meterle un cliente de Supabase lo acoplaria al servidor. Es el mismo patron que las dos
// constantes de arriba: la REGLA se comparte, la consulta la hace cada lector con su propio cliente.
/**
 * ═══ LA UNICA RESPUESTA A "¿ESTA VENTA CUENTA?" (0203) ═══
 *
 * POR QUE EXISTE: seis veces en dos semanas, dos pantallas de la misma cifra con el filtro en una y no en la
 * otra. Y la sexta enseño que ni compartir la regla alcanza: los dos lectores aplicaban el MISMO filtro y
 * daban distinto porque cada uno armaba su propio universo (uno pedia los pacientes marcados bajo la RLS del
 * profesional y no los veia todos).
 *
 * Asi que la pregunta tiene UNA respuesta, guardada por trigger, y todos leen la misma columna. La regla
 * (profesional, paciente o producto de prueba) vive en la migracion, no repartida en nueve consultas.
 *
 * En SQL se escribe negando la columna directamente; esta constante es para los filtros de PostgREST.
 */
export const COLUMNA_VENTA_DE_PRUEBA = "cuenta_como_de_prueba";
