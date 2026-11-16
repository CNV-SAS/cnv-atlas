// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE CUENTA COMO NUTRACEUTICO DE CNV, EN UN SOLO SITIO  ·  Santiago, 2026-11-16
//
// Modulo NEUTRO (sin "use client" ni server-only) a proposito: la regla la usan una pantalla de cliente
// (la seccion de prescribir) y el servidor (la lista de pendientes del cierre), y una regla que vive en
// dos sitios envejece en uno solo. Ya paso: la pantalla partia el catalogo con `ownership !== "tercero"`
// desde el 2026-09-26, y el cierre contaba filas sin mirar el ownership.
//
// ═══ EL CASO QUE LO ABRE ═══
//
// Textual de Santiago: *"se prescribe un nutraceutico, se quita, queda solo un producto Luvia, y el item
// del cierre desaparece"*. La cuenta del cierre era `treatment_nutraceuticals.length`, que SI es la
// prescripcion VIGENTE (el writer reemplaza el set entero en una transaccion), pero contaba CUALQUIER
// producto del catalogo. LUVIA es un producto de TERCERO: la propia pantalla de prescribir lo saca del
// desplegable de nutraceuticos y lo pone en otro bloque, rotulado "Producto externo".
//
// ═══ POR QUE `ownership` Y NO OTRA COSA ═══
//
// Es el unico dato del catalogo que distingue las dos familias, y es el que la pantalla YA usa. Medido
// en produccion el 2026-11-16: 23 productos, UNO de tercero (LUVIA), CERO sin `ownership` declarado.
//
// Y UN PRODUCTO SIN `ownership` CUENTA COMO DE CNV, igual que en la pantalla (`!== "tercero"`): el dato
// que falta no puede volver abierto un pendiente que nadie podria cerrar, que es el defecto que la regla
// del 16 de noviembre existe para no repetir.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El valor de `nutraceuticals.ownership` que marca un producto que NO es de CNV. */
export const OWNERSHIP_DE_TERCERO = "tercero";

/** ¿Este producto del catalogo es un nutraceutico de CNV? Lo contrario es un producto externo. */
export function esNutraceuticoDeCnv(ownership: string | null | undefined): boolean {
  return ownership !== OWNERSHIP_DE_TERCERO;
}

/** ¿Es un producto de tercero (LUVIA y los que vengan)? Es la negacion, escrita para que se lea. */
export function esProductoDeTercero(ownership: string | null | undefined): boolean {
  return !esNutraceuticoDeCnv(ownership);
}

/**
 * CUANTOS NUTRACEUTICOS DE CNV HAY EN UNA PRESCRIPCION VIGENTE.
 *
 * Es la cuenta que decide el pendiente del cierre. Recibe las filas tal como las trae el lector del
 * tratamiento, asi que la pantalla no tiene que saber como se decide.
 */
export function cuantosNutraceuticosDeCnv(
  prescritos: readonly { ownership: string | null }[],
): number {
  return prescritos.filter((p) => esNutraceuticoDeCnv(p.ownership)).length;
}
