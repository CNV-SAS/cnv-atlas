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
//   - el usuario no MOVIO la pagina (rueda, dedo, arrastre de barra, o una tecla de scroll con el
//     foco fuera de un campo: escribir NO cuenta, ver abajo),
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

// ═══ POR QUE LA VENTANA ES DE SILENCIO Y NO DE RELOJ (smoke Santiago, 2026-09-10) ═══
//
// EL SINTOMA: el salto volvia en "generar con IA" y en "guardar cambios" de la subpestaña Nutricionista,
// y SOLO ahi. Los dos botones YA pasaban por el guard (los tres hooks lo llaman), asi que no era un sitio
// sin cubrir: era el guard PERDIENDO. Por eso el barrido por sitios no encontraba nada.
//
// POR QUE PERDIA, y son DOS movimientos, no uno:
//   1. Invocar la accion navega y Next scrollea al montar los segmentos. El guard lo deshace.
//   2. Y DESPUES `useFormToast*AndRefresh` hace `router.refresh()`. Ese refresco NO scrollea (usa
//      NoScroll), pero el panel de tratamiento se REMONTA por su key: el documento encoge un instante y
//      el navegador ACOTA la posicion. La pagina se va sola por SEGUNDA vez.
// El guard se desarmaba al completar la PRIMERA restauracion, asi que para el segundo movimiento ya no
// quedaba nadie mirando. En los formularios ligeros los dos movimientos caben en el mismo cuadro y no se
// nota; en el panel pesado hay segundos de por medio, que es justo por que se veia ahi y no en el resto.
//
// EL ARREGLO ES DE RAIZ porque vive en el mecanismo unico y no en los dos botones donde se noto: el guard
// NO se desarma al corregir. Sigue mirando mientras la pagina se siga moviendo, y la ventana se reinicia
// con cada correccion y con cada cambio de alto del documento (que es la señal de que todavia se esta
// recomponiendo). Se retira sola cuando la pagina lleva VENTANA_MS quieta, y nunca pasa de TOPE_MS.
//
// LO QUE NO CAMBIA, y es lo que hace que alargar la vigilancia sea seguro: el usuario sigue mandando. Una
// rueda, un dedo, un clic o una tecla de scroll la desarman en el acto, pase el tiempo que pase.

/** Cuanto tiene que llevar QUIETA la pagina para dejar de vigilar. El salto llega 1-2 s medidos. */
const VENTANA_MS = 3000;

/** Tope absoluto. Sin el, una pagina que cambiara de alto sola dejaria el guard armado indefinidamente. */
const TOPE_MS = 12000;

/** Cada cuanto se mira el alto del documento. Leer `scrollHeight` fuerza layout: no se hace por cuadro. */
const SONDEO_MS = 150;

/** Menos de esto no es el salto al inicio, es el ajuste normal de un layout que respira. */
const MINIMO_PX = 24;

/**
 * Vigila un salto de scroll no pedido y lo deshace.
 *
 * VIGILA MIENTRAS LA PAGINA SE MUEVA, no una sola vez: un guardado puede provocar DOS movimientos (la
 * navegacion de la accion y el remonte del refresco), y desarmarse tras el primero dejaba el segundo sin
 * deshacer. Ver el bloque de arriba.
 *
 * Se llama al recibir el resultado de la accion (que es cuando sale el toast): en ese momento la pagina
 * todavia esta donde el profesional la dejo, y el salto viene despues.
 */
export function preservarScroll(): void {
  if (typeof window === "undefined") return;

  const desde = window.scrollY;
  const ruta = window.location.pathname;
  let terminado = false;
  /** A donde se corrigio la ultima vez, para no reentrar mientras el documento no de para mas. */
  let corregidoA: number | null = null;

  const nacimiento = Date.now();
  /** El temporizador de la ventana de silencio. Se reprograma, asi que no es constante. */
  let fin = 0;

  const quitar = () => {
    terminado = true;
    window.removeEventListener("scroll", revisar);
    for (const e of CANCELAN) window.removeEventListener(e, cancelar);
    window.removeEventListener("keydown", cancelarPorTecla);
    window.clearTimeout(fin);
  };

  /**
   * Reinicia la ventana de silencio. La llaman la correccion y el cambio de alto del documento: las dos
   * dicen lo mismo, que la pagina todavia se esta recomponiendo y hay que seguir mirando.
   */
  const reprogramar = () => {
    if (terminado) return;
    const restante = TOPE_MS - (Date.now() - nacimiento);
    if (restante <= 0) {
      quitar();
      return;
    }
    window.clearTimeout(fin);
    fin = window.setTimeout(quitar, Math.min(VENTANA_MS, restante));
  };

  // El usuario manda: si se mueve el solo, no se le pelea la pagina. Estos eventos llegan ANTES del
  // `scroll` que provocan, asi que cancelan a tiempo.
  //
  // EL `keydown` ERA DEMASIADO ANCHO (cotejo 2026-09-06, punto 10). Cancelaba con CUALQUIER tecla
  // durante los tres segundos siguientes al guardado, y hay dos formularios donde el profesional
  // ESCRIBE justo despues de guardar: el criterio del profesional y el de la reimportacion. Ahi el
  // guard se desarmaba antes de que llegara el salto, que es exactamente el sintoma que Santiago
  // reporto en los dos (y solo en esos dos).
  //
  // Ahora solo cancelan las teclas que MUEVEN LA PAGINA. Escribir no es moverse: una letra en un campo
  // no es una peticion de scroll, y tratarla como tal es lo que dejaba el salto sin deshacer.
  //
  // ESTO ES UNA HIPOTESIS APLICADA, no una causa confirmada, y se dice para que nadie lo lea como
  // cerrado: el defecto solo se ve en un navegador real (familia de los hazards de formulario de
  // CLAUDE.md), asi que lo confirma el smoke. Si tras esto sigue saltando, la causa es otra y este
  // cambio se queda igual porque es correcto por si mismo: cancelar por teclear nunca fue lo que se
  // queria.
  const TECLAS_QUE_MUEVEN = new Set([
    "PageUp",
    "PageDown",
    "Home",
    "End",
    "ArrowUp",
    "ArrowDown",
    " ",
    "Spacebar",
  ]);
  const CANCELAN = ["wheel", "touchstart", "mousedown"] as const;
  const cancelar = () => quitar();
  // Las flechas y el espacio SOLO mueven la pagina si el foco no esta en un campo: dentro de un input
  // mueven el cursor. Sin esta distincion, escribir un espacio en el criterio volveria a desarmarlo.
  // Se mira el TARGET del evento y no `document.activeElement`: es el mismo elemento para un `keydown`
  // y no obliga a este modulo a tocar `document`, que es lo unico que lo ataba a un entorno de navegador.
  const cancelarPorTecla = (e: KeyboardEvent) => {
    const el = e.target as { tagName?: string; isContentEditable?: boolean } | null;
    const t = el?.tagName;
    if (t === "INPUT" || t === "TEXTAREA" || el?.isContentEditable) return;
    if (TECLAS_QUE_MUEVEN.has(e.key)) quitar();
  };

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
    const destino = Math.min(desde, maximo);

    // Ya se corrigio a ese mismo destino y el documento sigue sin dar para mas: no se reentra. Esto
    // sustituye al `quitar()` incondicional de antes como freno de la reentrada, y sin desarmar.
    if (corregidoA === destino && Math.abs(window.scrollY - destino) < MINIMO_PX) return;
    corregidoA = destino;

    // YA NO SE DESARMA AL CORREGIR (arreglo del 2026-09-10, ver el bloque de la cabecera): tras la
    // correccion puede venir un SEGUNDO movimiento, el del remonte por key del refresco. Lo que se hace en
    // su lugar es reiniciar la ventana de silencio, asi que el guard sigue en pie mientras la pagina siga
    // moviendose y se retira sola cuando se queda quieta.
    //
    // EL FRENO DE LA REENTRADA YA NO ES DESARMARSE, es `corregidoA` (arriba) junto con la guarda del
    // minimo: el eco de nuestro propio `scrollTo` llega con la posicion ya buena y sale por ahi.
    //
    // Y ESTO CONVIVE CON EL ARREGLO DEL 2026-09-04 (Santiago: "salta y se queda arriba"; con la version
    // que sondeaba cada 100 ms "saltaba y me bajaba donde estaba").
    //
    // EL DEFECTO: el panel de tratamiento se REMONTA por su key al guardar. Mientras remonta, el
    // documento encoge un instante y el navegador ACOTA el scroll, o sea que la posicion baja sola sin
    // que nadie haya saltado. Mirando cada cuadro, el corrector veia ESE movimiento, lo tomaba por el
    // salto, corregia al maximo alcanzable de ese instante (pequeño, porque el documento estaba corto) y
    // se desarmaba. Cuando llegaba el salto de verdad ya no quedaba nadie mirando. Sondear cada 100 ms
    // era inmune por accidente: a esa granularidad se saltaba el cuadro del encogimiento. Ganar precision
    // destapo el defecto, no lo causo.
    //
    // Por eso una correccion ACOTADA es provisional: se aplica (mejor cerca que arriba del todo) pero se
    // sigue vigilando, y cuando el documento recupera su alto se corrige entero. Si nunca lo recupera, la
    // ventana se acaba y queda la acotada, que es lo que ya se queria.
    window.scrollTo({ top: destino, behavior: "instant" as ScrollBehavior });
    reprogramar();
  }

  window.addEventListener("scroll", revisar, { passive: true });
  for (const e of CANCELAN) window.addEventListener(e, cancelar, { passive: true, once: true });
  // SIN `once`: una tecla que no mueve la pagina no desarma, asi que hay que seguir escuchando.
  window.addEventListener("keydown", cancelarPorTecla, { passive: true });

  // RESPALDO, y desde hoy tambien el SENSOR DE QUE LA PAGINA SIGUE RECOMPONIENDOSE. El evento `scroll` es
  // lo que corrige a tiempo; esto cubre que el navegador lo agrupe o que el salto llegue sin evento, y
  // ademas vigila el alto del documento: mientras cambie, la ventana se reinicia. Un remonte que encoge y
  // vuelve a crecer se ve aqui aunque no dispare ningun `scroll`.
  let altoVisto = document.documentElement.scrollHeight;
  let ultimoSondeo = 0;
  const siguienteCuadro = (t: number) => {
    if (terminado) return;
    revisar();
    if (!terminado && t - ultimoSondeo >= SONDEO_MS) {
      ultimoSondeo = t;
      const alto = document.documentElement.scrollHeight;
      if (alto !== altoVisto) {
        altoVisto = alto;
        reprogramar();
      }
    }
    if (!terminado) window.requestAnimationFrame(siguienteCuadro);
  };
  window.requestAnimationFrame(siguienteCuadro);

  reprogramar();
}
