// DESHACE EL SALTO AL INICIO QUE NEXT PROVOCA EN LA PRIMERA SERVER ACTION DE CADA RUTA.
//
// LA CAUSA, leida en el Next instalado (16.2.9) y no razonada. Son tres piezas:
//
//   1. `router.refresh()` NO scrollea. `refresh-reducer.js`: `const scrollBehavior = ScrollBehavior.NoScroll`.
//      Asi que nuestro refresco del toast era inocente, y quitar los `revalidatePath` no podia arreglar
//      esto del todo aunque lo pareciera.
//   2. INVOCAR UNA SERVER ACTION SI. `server-action-reducer.js`: `const scrollBehavior =
//      ScrollBehavior.Default`. Y no es la rama del redirect: dos lineas antes,
//      `redirectUrl = redirectLocation !== undefined ? redirectLocation : currentUrl`, o sea que sin
//      redirect navega igual a la URL actual.
//   3. Y ese "Default" scrollea SOLO SI la navegacion creo SEGMENTOS NUEVOS. `segment-cache/navigation.js`,
//      textual: "we scroll to the segments that were navigated to... When they mount, the first one to
//      mount initiates the scroll", y "Use the accumulated scrollRef (may be null if no new segments were
//      created)". El reducer de la action lo remata: "Currently the server always renders from the root in
//      response to a Server Action".
//
// ESO EXPLICA LAS CUATRO OBSERVACIONES DEL SMOKE, sin forzar ninguna: pasa en la PRIMERA accion de cada
// ruta (despues los segmentos se reutilizan y `scrollRef` queda null), da igual el formulario (es por RUTA,
// confirmado: una nota salta y el guardado inmediato posterior no), ocurre UNO O DOS SEGUNDOS DESPUES del
// toast (el scroll se dispara cuando MONTAN los segmentos, no al pulsar), y pasa en los dos entornos
// porque es del router en el cliente, no de la red.
//
// POR QUE SE DESHACE Y NO SE IMPIDE, que seria mejor: NO HAY FORMA DE IMPEDIRLO. `ScrollBehavior.Default`
// esta escrito como constante en el reducer de la action, sin opcion ni API que lo cambie, y los refs con
// que Next lo cancela (`scrollRef.current = false`, `layout-router.js`) viven dentro del router y no se
// alcanzan desde nuestro codigo. Deshacerlo es el limite de lo posible.
//
// LO QUE ESTO HACE, y es deliberadamente poco: no "restaura una posicion", DESHACE UN SCROLL QUE NADIE
// PIDIO. Por eso solo actua si se cumplen todas:
//   - la ruta no cambio (un redirect legitimo se respeta),
//   - el usuario no toco nada (rueda, dedo o teclado cancelan),
//   - y la posicion se movio de verdad.
// Y se acota a una ventana corta: pasada esa, cualquier movimiento ya es del usuario o de la pagina.
//
// POR QUE ESCUCHA EL EVENTO `scroll` Y NO SONDEA CADA 100 ms, que es como estaba: sondeando, el salto y la
// vuelta ALCANZABAN A VERSE (Santiago los noto estando atento). Next hace el scroll dentro del commit de
// React (`componentDidMount` de `ScrollAndFocusHandler`, que llama a `scrollIntoView`), asi que el evento
// `scroll` se despacha en el mismo ciclo de renderizado, ANTES de pintar. Corrigiendo ahi, el navegador no
// llega a pintar la posicion equivocada. El `requestAnimationFrame` queda de respaldo por si el evento se
// agrupa; sondear cada 100 ms garantizaba al menos un fotograma malo.
//
// MODULO NEUTRO, sin "use client", y a proposito: no usa ningun hook, solo toca `window` detras de una
// guarda de SSR. Con la directiva, `check:rsc` marcaba con razon la arista de su propio test (un archivo
// sin "use client" invocando un valor de un modulo cliente). Neutro lo importan los dos lados sin mentir,
// que es justo lo que ARCHITECTURE pide para un valor que cruza la frontera.

/** Cuanto se vigila el salto. El scroll llega al montar los segmentos: 1-2 s medidos, 3 da margen. */
const VENTANA_MS = 3000;

/** Menos de esto no es el salto al inicio, es el ajuste normal de un layout que respira. */
const MINIMO_PX = 24;

/**
 * Vigila un salto de scroll no pedido y lo deshace una sola vez.
 *
 * Se llama al recibir el resultado de la accion (que es cuando sale el toast): en ese momento la pagina
 * todavia esta donde el profesional la dejo, y el salto viene despues.
 */
export function preservarScroll(): void {
  if (typeof window === "undefined") return;

  const desde = window.scrollY;
  const ruta = window.location.pathname;
  let terminado = false;

  const quitar = () => {
    terminado = true;
    window.removeEventListener("scroll", revisar);
    for (const e of CANCELAN) window.removeEventListener(e, cancelar);
    window.clearTimeout(fin);
  };

  // El usuario manda: si se mueve el solo, no se le pelea la pagina. Estos eventos llegan ANTES del
  // `scroll` que provocan, asi que cancelan a tiempo.
  const CANCELAN = ["wheel", "touchstart", "keydown", "mousedown"] as const;
  const cancelar = () => quitar();

  function revisar(): void {
    if (terminado) return;
    // Un redirect real cambia la ruta: ahi el scroll de Next es correcto y no se toca.
    if (window.location.pathname !== ruta) {
      quitar();
      return;
    }
    if (Math.abs(window.scrollY - desde) < MINIMO_PX) return;

    // EL ALTO PUDO CAMBIAR: si al guardar aparecio o desaparecio un bloque, la posicion guardada puede
    // quedar fuera del documento. Se acota al maximo actual en vez de no hacer nada: quedarse cerca de
    // donde estaba es mejor que quedarse arriba del todo, que es justo lo que se esta deshaciendo.
    const maximo = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    // `quitar()` ANTES de corregir: nuestro propio `scrollTo` dispara otro evento `scroll`, y sin esto se
    // reentraria en `revisar` con la posicion ya buena.
    quitar();
    window.scrollTo({ top: Math.min(desde, maximo), behavior: "instant" as ScrollBehavior });
  }

  window.addEventListener("scroll", revisar, { passive: true });
  for (const e of CANCELAN) window.addEventListener(e, cancelar, { passive: true, once: true });

  // RESPALDO. El evento `scroll` es lo que corrige a tiempo; esto solo cubre que el navegador lo agrupe o
  // que el salto llegue sin evento. Se para en cuanto `revisar` corrige o se acaba la ventana.
  const siguienteCuadro = () => {
    if (terminado) return;
    revisar();
    if (!terminado) window.requestAnimationFrame(siguienteCuadro);
  };
  window.requestAnimationFrame(siguienteCuadro);

  const fin = window.setTimeout(quitar, VENTANA_MS);
}
