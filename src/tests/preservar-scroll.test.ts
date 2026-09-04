import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { preservarScroll } from "@/components/shared/preservar-scroll";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL SALTO AL INICIO EN LA PRIMERA ACCION DE CADA RUTA (smoke de Santiago, 2026-09-02).
//
// LA CAUSA, leida en el Next instalado (16.2.9): invocar una server action navega con
// `ScrollBehavior.Default` (`server-action-reducer.js`), y ese Default scrollea a los SEGMENTOS NUEVOS
// cuando montan (`segment-cache/navigation.js`). La primera accion de cada ruta renderiza desde la raiz y
// crea segmentos nuevos; las siguientes los reutilizan y `scrollRef` queda null. `router.refresh()`, en
// cambio, usa `NoScroll` explicitamente, asi que el refresco NUNCA fue el culpable.
//
// POR QUE EL CANDADO, y no solo el arreglo: cuesta tres intentos llegar aqui (dos explicaciones plausibles
// y falsas antes), la causa esta en `node_modules` y no en nuestro codigo, y `preservarScroll` se lee como
// codigo que sobra. Alguien lo va a querer quitar. Esto lo frena.

const TOAST = sinComentarios(readFileSync("src/components/shared/use-form-toast.ts", "utf8"));

describe("el mecanismo unico lo aplica, y en los TRES hooks", () => {
  it("`use-form-toast` importa y llama a `preservarScroll`", () => {
    // EL SITIO DE LLAMADA, que es donde estaria el hueco: la funcion puede estar perfecta y no servir de
    // nada si nadie la invoca. Es la leccion de la aprobacion, aplicada de entrada.
    expect(TOAST).toContain("preservarScroll");
    expect(TOAST).toContain('from "./preservar-scroll"');
  });

  it("los tres hooks la llaman, incluido el que NO refresca", () => {
    // `useFormToast` ni siquiera refresca, y aun asi lo necesita: el salto es de INVOCAR LA ACCION, no del
    // refresco. Si algun dia alguien lo quita de ese hook "porque ahi no hay refresh", vuelve el defecto.
    const llamadas = (TOAST.match(/preservarScroll\(\)/g) ?? []).length;
    expect(llamadas, "los tres hooks tienen que preservar el scroll").toBe(3);
  });
});

describe("deshace el salto, pero solo el que nadie pidio", () => {
  const entorno = (scrollY: number, alto = 4000) => {
    const w = {
      scrollY,
      innerHeight: 800,
      location: { pathname: "/evaluaciones/e1" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn(),
      setTimeout: vi.fn(() => 2),
      clearTimeout: vi.fn(),
      scrollTo: vi.fn(),
    };
    vi.stubGlobal("window", w);
    vi.stubGlobal("document", { documentElement: { scrollHeight: alto } });
    return w;
  };
  // El corrector reacciona al evento `scroll`, que es lo que lo hace imperceptible: Next scrollea dentro
  // del commit de React, asi que el evento llega antes de pintar. Aqui se dispara como lo haria el
  // navegador. (El `requestAnimationFrame` es solo respaldo y se prueba aparte.)
  const tick = (w: ReturnType<typeof entorno>) => {
    const fn = w.addEventListener.mock.calls.find((c) => c[0] === "scroll")?.[1];
    if (typeof fn !== "function") throw new Error("preservarScroll no escucha el evento scroll");
    (fn as () => void)();
  };

  afterEach(() => vi.unstubAllGlobals());

  it("si la página salta al inicio, la devuelve donde estaba", () => {
    const w = entorno(1200);
    preservarScroll();
    w.scrollY = 0; // el salto de Next, al montar los segmentos
    tick(w);
    expect(w.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: "instant" });
  });

  it("si no se movió, no toca nada", () => {
    // CONTROL: sin esto, el caso de arriba pasaría verde también con una función que scrollea siempre.
    const w = entorno(1200);
    preservarScroll();
    tick(w);
    expect(w.scrollTo).not.toHaveBeenCalled();
  });

  it("un movimiento pequeño no cuenta: es un layout que respira, no el salto", () => {
    const w = entorno(1200);
    preservarScroll();
    w.scrollY = 1190;
    tick(w);
    expect(w.scrollTo).not.toHaveBeenCalled();
  });

  it("SI LA RUTA CAMBIÓ no se pelea con el redirect: ese scroll es correcto", () => {
    // Cuidado (a) de Santiago. Hoy ninguna acción que use estos hooks redirige (las de auth y encuesta,
    // que sí lo hacen, no los usan), pero el día que alguna lo haga, restaurar sería pelearse con ella.
    const w = entorno(1200);
    preservarScroll();
    w.location.pathname = "/dashboard";
    w.scrollY = 0;
    tick(w);
    expect(w.scrollTo).not.toHaveBeenCalled();
  });

  it("y si el contenido ENCOGIÓ, acota al máximo alcanzable en vez de rendirse", () => {
    // Cuidado (b). Si al guardar desaparece un bloque, la posición guardada puede quedar fuera del
    // documento. Quedarse cerca de donde estaba es mejor que quedarse arriba del todo, que es justo lo que
    // se está deshaciendo.
    const w = entorno(3000, 1500); // alto 1500, ventana 800 -> máximo 700
    preservarScroll();
    w.scrollY = 0;
    tick(w);
    expect(w.scrollTo).toHaveBeenCalledWith({ top: 700, behavior: "instant" });
  });

  it("un ENCOGIMIENTO PASAJERO no gasta el intento: el salto de verdad viene después", () => {
    // EL DEFECTO QUE SANTIAGO REPORTÓ EL 2026-09-04, y el caso que lo reproduce.
    //
    // Sus dos observaciones lo acotaron entero: (1) salta SOLO la primera vez por ruta, así que el
    // mecanismo de Next es el que ya teníamos identificado; y (2) **salta y se QUEDA arriba**, mientras
    // que la versión que sondeaba cada 100 ms "saltaba y me bajaba donde estaba". Ese contraste es el
    // dato: con la MISMA captura de `desde`, sondear funcionaba y mirar cada cuadro no. Así que `desde`
    // no vale 0 (esa hipótesis muere ahí), y el problema es que el corrector se dispara ANTES de tiempo.
    //
    // QUÉ PASA. El panel de tratamiento se REMONTA por su key al guardar. Mientras remonta, el documento
    // encoge un instante y el navegador ACOTA el scroll: la posición baja sola, sin que nadie salte. El
    // corrector, que ahora mira cada cuadro, ve ese movimiento, lo toma por el salto, corrige al máximo
    // alcanzable de ESE instante (que es pequeño porque el documento está corto) y se DESARMA. Cuando
    // llega el salto de verdad, ya no queda nadie mirando.
    //
    // Sondear cada 100 ms era inmune por accidente: a esa granularidad se saltaba el cuadro del
    // encogimiento. Ganar precisión fue lo que destapó el defecto, no lo que lo causó.
    const w = entorno(1200, 4000);
    preservarScroll();

    // 1) El remonte: el documento encoge y el navegador arrastra la posición con él.
    vi.stubGlobal("document", { documentElement: { scrollHeight: 1000 } }); // máximo 200
    w.scrollY = 200;
    tick(w);

    // 2) El documento vuelve a su alto, y AHORA sí llega el salto de Next.
    vi.stubGlobal("document", { documentElement: { scrollHeight: 4000 } });
    w.scrollY = 0;
    tick(w);

    // Lo que importa es DÓNDE queda, no cuántas veces corrigió.
    const ultima = w.scrollTo.mock.calls.at(-1)?.[0] as { top: number } | undefined;
    expect(ultima?.top, "se gastó el intento en el encogimiento y el salto real quedó sin deshacer").toBe(
      1200,
    );
  });

  it("y el usuario manda: si se movió él, se cancela", () => {
    const w = entorno(1200);
    preservarScroll();
    // El listener de `wheel` es el que cancela; se dispara como lo haría el navegador.
    const cancelar = w.addEventListener.mock.calls.find((c) => c[0] === "wheel")?.[1];
    expect(cancelar, "no se registró el listener que cancela").toBeTypeOf("function");
    (cancelar as () => void)();
    w.scrollY = 0;
    tick(w);
    expect(w.scrollTo).not.toHaveBeenCalled();
  });
});

describe("por qué es imperceptible: corrige en el evento, no sondeando", () => {
  // EL RESIDUO QUE ESTO CIERRA (smoke, 2026-09-02): con la primera versión, que sondeaba cada 100 ms, el
  // salto y la vuelta ALCANZABAN A VERSE. Next hace el scroll dentro del commit de React
  // (`componentDidMount` de `ScrollAndFocusHandler` → `scrollIntoView`), así que el evento `scroll` se
  // despacha en el mismo ciclo de renderizado, ANTES de pintar: corrigiendo ahí, el navegador no llega a
  // pintar la posición equivocada. Sondear garantizaba al menos un fotograma malo.
  const entorno = () => {
    const w = {
      scrollY: 900,
      innerHeight: 800,
      location: { pathname: "/evaluaciones/e1" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn(),
      setTimeout: vi.fn(() => 2),
      clearTimeout: vi.fn(),
      scrollTo: vi.fn(),
    };
    vi.stubGlobal("window", w);
    vi.stubGlobal("document", { documentElement: { scrollHeight: 4000 } });
    return w;
  };

  afterEach(() => vi.unstubAllGlobals());

  it("escucha `scroll`, que es lo que llega a tiempo", () => {
    const w = entorno();
    preservarScroll();
    expect(w.addEventListener.mock.calls.some((c) => c[0] === "scroll")).toBe(true);
  });

  it("y deja un respaldo por cuadro, por si el navegador agrupa el evento", () => {
    const w = entorno();
    preservarScroll();
    expect(w.requestAnimationFrame).toHaveBeenCalled();
  });

  it("no se reentra con su propio scroll: corrige UNA vez", () => {
    // `scrollTo` dispara otro evento `scroll`, y sin freno se volvería a evaluar con la posición ya buena.
    // Cuando la restauración es ENTERA el freno sigue siendo desmontarse antes de corregir.
    const w = entorno();
    preservarScroll();
    const revisar = w.addEventListener.mock.calls.find((c) => c[0] === "scroll")?.[1] as () => void;
    w.scrollY = 0;
    revisar();
    revisar(); // el eco de nuestro propio scrollTo
    expect(w.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("y TAMPOCO se reentra por el otro camino, el que sigue armado", () => {
    // EL SEGUNDO CAMINO DE REENTRADA, que lo abrió el arreglo del 2026-09-04 y por eso lleva su propio
    // caso: con el documento encogido la corrección es provisional y NO se desmonta, así que el freno de
    // arriba no aplica. Sin este caso, el candado probaría una de las dos vías y se creería completo.
    //
    // Aquí el freno es recordar a dónde se corrigió: si el documento sigue sin dar para más, el eco del
    // propio `scrollTo` no vuelve a corregir. Si no, se pelearía consigo mismo durante los tres segundos.
    // Este `entorno` no parametriza el alto (arranca en 900 con documento de 4000), así que se encoge a
    // mano: 1000 de alto con ventana de 800 deja el máximo en 200, muy por debajo de los 900 de partida.
    const w = entorno();
    preservarScroll();
    vi.stubGlobal("document", { documentElement: { scrollHeight: 1000 } });
    const revisar = w.addEventListener.mock.calls.find((c) => c[0] === "scroll")?.[1] as () => void;
    w.scrollY = 0;
    revisar();
    w.scrollY = 200; // el navegador ya nos llevó ahí: es el eco de nuestra propia corrección
    revisar();
    revisar();
    expect(w.scrollTo).toHaveBeenCalledTimes(1);
    expect(w.scrollTo).toHaveBeenCalledWith({ top: 200, behavior: "instant" });
  });
});
