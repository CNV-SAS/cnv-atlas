// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL INVENTARIO MUESTRA MAS QUE EL FISICO, Y HAY QUE DECIRLO  ·  2026-11-18
//
// ── QUE PASA, Y POR QUE ES A PROPOSITO ───────────────────────────────────────────────────────────
//
// Al arrancar, el inventario de cada Integrante se carga con TODO LO QUE RECIBIO, sin descontar las
// ventas que ya hizo antes del arranque (decision de Santiago, 2026-11-17). Esas ventas existen: se
// facturaron A MANO en Alegra y entraran despues por un xlsx como ventas atrasadas, que es cuando
// descontaran su inventario.
//
// O sea que entre el arranque y esa carga, el sistema dice MAS unidades de las que hay en la mano. No es
// un defecto y no se va a arreglar antes: arreglarlo seria descontar las ventas dos veces.
//
// ── POR QUE UN AVISO Y NO UN NUMERO CORREGIDO ────────────────────────────────────────────────────
//
// Porque la unica cifra honesta hoy es la que esta, con su explicacion al lado. Corregir el saldo "para
// que cuadre" lo dejaria sin cuadrar el dia que entre el xlsx, y nadie sabria por que bajo dos veces. Es
// la misma leccion que las tarjetas de dinero: el alcance se dice en la cifra, no en letra chica.
//
// Y el aviso es para las DOS caras: el Integrante, que al contar sus frascos va a encontrar menos de los
// que la pantalla dice; y admin, que mira el total de las vitrinas.
//
// ── POR QUE UNA CONSTANTE Y NO UNA COLUMNA ───────────────────────────────────────────────────────
//
// Es la misma eleccion que `CNVS_ACTIVA` (`modules/evaluations/instrumento.ts`), y por las mismas razones:
// una constante se VE EN EL DIFF el dia que alguien la apaga, y no tiene los tres estados de una variable
// de entorno (puesta, vacia, ausente), que es justo la forma en que una bandera se queda encendida sin que
// nadie lo sepa. Esto ocurre UNA VEZ, antes del 30 de noviembre; una columna de configuracion sobreviviria
// al hecho que describe.
//
// SE APAGA en el mismo commit en que se carga el xlsx, y ese commit es el registro de que se cargo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ¿Ya se cargaron las ventas atrasadas del xlsx?
 *
 * `false` mientras el inventario del sistema sea mayor que el fisico. Se pone en `true` el dia que la carga
 * termine (antes del 30 de noviembre de 2026, que es lo que contabilidad acepto el 2026-11-18).
 */
export const VENTAS_HISTORICAS_CARGADAS = false;

/**
 * La frase, o null cuando ya no hay nada que avisar.
 *
 * EN UN SOLO SITIO, por lo mismo que `avisoDeQueNoSeHaArrancado`: tres pantallas que escriben su propia
 * version de la misma advertencia acaban diciendo tres cosas distintas, y ya nos paso con el arranque.
 */
export function avisoDeVentasHistoricas(cargadas: boolean = VENTAS_HISTORICAS_CARGADAS): string | null {
  if (cargadas) return null;
  return "Pendiente la carga de ventas históricas: estas cifras muestran todo lo que se recibió, sin descontar las ventas hechas antes del arranque. Esas ventas ya se facturaron a mano y entran después desde un archivo; ese día el inventario baja y queda igual al físico. Hasta entonces el sistema dice más unidades de las que hay, a propósito.";
}
