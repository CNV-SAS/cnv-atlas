"use client";

// ═══ IMPRIMIR UNA HOJA, NO TODAS LAS QUE ESTEN MONTADAS (2026-09-18) ═══
//
// EL DEFECTO, encontrado al ir a añadir la tercera hoja imprimible: la regla de impresion oculta todo lo que no
// sea `.imprimible`, este dentro de una, o contenga una. Con UNA hoja en el DOM eso es exacto. Pero las etapas
// visitadas NO se desmontan (se hizo asi para no perder el borrador del tratamiento), asi que quien pasa por
// Tratamiento y luego imprime desde Reporte/HC tiene DOS hojas montadas, y salen las dos: el plan del paciente
// pegado a su historia clinica.
//
// COMO SE CIERRA: el boton marca SU hoja antes de abrir el dialogo, y la regla de `globals.css` esconde las
// demas mientras esa marca exista. Al terminar (o al cancelar) se quita.
//
// Y ES ADITIVO A PROPOSITO: si alguien imprime con Ctrl+P sin pasar por un boton, no hay marca y el
// comportamiento es el de siempre. Se estrecha el camino que usamos, sin romper el otro.

export const ATRIBUTO_HOJA_ACTIVA = "data-hoja-activa";

/**
 * Imprime la hoja que contiene a `elemento` (o el elemento mismo, si ya es la hoja). Sin hoja, imprime como
 * antes: es mejor imprimir de mas que no imprimir cuando alguien pulsa el boton.
 */
export function imprimirHoja(elemento: HTMLElement | null): void {
  const hoja = elemento?.closest<HTMLElement>(".imprimible") ?? null;
  if (!hoja) {
    window.print();
    return;
  }

  hoja.setAttribute(ATRIBUTO_HOJA_ACTIVA, "");
  // `afterprint` llega tambien cuando se CANCELA el dialogo, que es lo que hace falta: la marca no puede
  // quedarse puesta, o la proxima impresion de otra hoja saldria vacia.
  const limpiar = () => {
    hoja.removeAttribute(ATRIBUTO_HOJA_ACTIVA);
    window.removeEventListener("afterprint", limpiar);
  };
  window.addEventListener("afterprint", limpiar);
  window.print();
  // Respaldo por si el navegador no dispara `afterprint` (algunos no lo hacen al cancelar): la marca se
  // retira igual un momento despues. Quitarla de mas no rompe nada; dejarla puesta si.
  window.setTimeout(limpiar, 3000);
}
