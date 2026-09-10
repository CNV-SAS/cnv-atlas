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

// El guard es UNICO POR PAGINA desde el 2026-09-10: mientras uno siga vivo, una segunda llamada le alarga
// la ventana en vez de armar otro (el primero se armó en el clic y tiene el `desde` bueno). Eso es estado
// de módulo, y en un navegador se limpia solo porque su temporizador vence. Aquí el temporizador es un
// espía que no dispara, así que se dispara a mano al terminar cada caso.
let ultimo: { setTimeout: ReturnType<typeof vi.fn> } | null = null;
function retirarGuard(): void {
  for (const [fn] of ultimo?.setTimeout.mock.calls ?? []) {
    if (typeof fn === "function") (fn as () => void)();
  }
  ultimo = null;
}


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
    const w: {
      scrollY: number;
      innerHeight: number;
      location: { pathname: string };
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
      requestAnimationFrame: ReturnType<typeof vi.fn>;
      setTimeout: ReturnType<typeof vi.fn>;
      clearTimeout: ReturnType<typeof vi.fn>;
      scrollTo: ReturnType<typeof vi.fn>;
    } = {
      scrollY,
      innerHeight: 800,
      location: { pathname: "/ani-bis-e/e1" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn(),
      setTimeout: vi.fn(() => 2),
      clearTimeout: vi.fn(),
      // `scrollTo` MUEVE LA PAGINA, como en un navegador de verdad. Con un espia mudo, `window.scrollY`
      // se quedaba donde estaba y el freno de reentrada del corrector (que compara la posicion actual
      // con la ultima corregida) no podia actuar: el entorno no reproducia la unica cosa que el
      // corrector observa. Se arregla el ENTORNO, no la asercion.
      scrollTo: vi.fn(({ top }: { top: number }) => {
        w.scrollY = top;
      }),
    };
    vi.stubGlobal("window", w);
    vi.stubGlobal("document", { documentElement: { scrollHeight: alto } });
    ultimo = w;
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

  afterEach(() => {
    retirarGuard();
    vi.unstubAllGlobals();
  });

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

  it("EL SEGUNDO MOVIMIENTO TAMBIÉN SE DESHACE: un guardado mueve la página dos veces", () => {
    // EL DEFECTO DEL SMOKE DEL 2026-09-10 (Santiago): el salto volvía en "generar con IA" y en "guardar
    // cambios" de la subpestaña Nutricionista, y solo ahí. Los dos botones YA pasaban por el guard, así
    // que no era un sitio sin cubrir: era el guard perdiendo.
    //
    // UN GUARDADO MUEVE LA PÁGINA DOS VECES. Primero la navegación de la server action (Next scrollea al
    // montar los segmentos). Y después `router.refresh()`, que no scrollea pero remonta el panel por su
    // key: el documento encoge un instante y el navegador acota la posición. El guard se desarmaba al
    // completar la PRIMERA restauración, así que el segundo movimiento quedaba sin deshacer.
    //
    // En los formularios ligeros los dos caben en el mismo cuadro y no se nota. En el panel pesado hay
    // segundos de por medio, que es por qué se veía ahí y en ningún otro sitio.
    const w = entorno(1200, 4000);
    preservarScroll();

    // 1) La navegación de la acción: salta al inicio. El guard lo deshace.
    w.scrollY = 0;
    tick(w);
    expect(w.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: "instant" });

    // 2) El remonte del refresco, un rato después: el documento encoge y la posición se va sola.
    vi.stubGlobal("document", { documentElement: { scrollHeight: 1000 } });
    w.scrollY = 200;
    tick(w);
    vi.stubGlobal("document", { documentElement: { scrollHeight: 4000 } });
    tick(w);

    const ultima = w.scrollTo.mock.calls.at(-1)?.[0] as { top: number } | undefined;
    expect(
      ultima?.top,
      "el guard se desarmó tras el primer movimiento y el segundo quedó sin deshacer",
    ).toBe(1200);
  });

  it("y aun así se retira sola: la ventana de silencio se reinicia, no se elimina", () => {
    // CONTROL de lo de arriba. Sin esto, "no desarmarse nunca" también pasaría verde, y un guard que se
    // queda armado indefinidamente le pelea la página al profesional cada vez que la mueve algo.
    const w = entorno(1200, 4000);
    preservarScroll();
    const programado = w.setTimeout.mock.calls.at(-1);
    // EL ALCANCE SE AJUSTA, NO LA ASERCION (2026-09-10): la PRIMERA espera pasó de tres segundos al tope,
    // porque desde hoy el guard se arma en el CLIC y entre el clic y el salto está el viaje al servidor.
    // Lo que este caso afirma es lo mismo de antes: que la ventana está ACOTADA y que al vencer se retira.
    // Un guard sin tope le pelearía la página al profesional cada vez que algo la mueva.
    expect(programado?.[1], "la ventana dejó de acotarse").toBeLessThanOrEqual(12000);
    // Y cuando vence, deja de escuchar: es el mismo `quitar` de siempre.
    (programado?.[0] as () => void)();
    w.scrollY = 0;
    tick(w);
    expect(w.scrollTo, "siguió corrigiendo con la ventana vencida").not.toHaveBeenCalled();
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

  // ESCRIBIR NO ES MOVERSE (cotejo 2026-09-06, punto 10). El guard cancelaba con CUALQUIER tecla durante
  // los tres segundos siguientes al guardado, y hay dos formularios donde el profesional escribe justo
  // despues de guardar: ahi se desarmaba antes de que llegara el salto. Ahora solo cancelan las teclas
  // que MUEVEN la pagina, y solo con el foco fuera de un campo.
  it("teclear NO cancela: una letra no es una peticion de scroll", () => {
    const w = entorno(1200);
    preservarScroll();
    const porTecla = w.addEventListener.mock.calls.find((c) => c[0] === "keydown")?.[1];
    expect(porTecla, "no se registro el listener de teclado").toBeTypeOf("function");
    (porTecla as (e: { key: string }) => void)({ key: "a" });
    w.scrollY = 0;
    tick(w);
    expect(w.scrollTo, "deberia haber deshecho el salto igual").toHaveBeenCalled();
  });

  it("pero una tecla que SI mueve la pagina cancela", () => {
    // El control de la asercion de arriba: sin el, "no cancela nunca" tambien pasaria verde.
    const w = entorno(1200);
    preservarScroll();
    const porTecla = w.addEventListener.mock.calls.find((c) => c[0] === "keydown")?.[1];
    (porTecla as (e: { key: string }) => void)({ key: "PageDown" });
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
    const w: {
      scrollY: number;
      innerHeight: number;
      location: { pathname: string };
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
      requestAnimationFrame: ReturnType<typeof vi.fn>;
      setTimeout: ReturnType<typeof vi.fn>;
      clearTimeout: ReturnType<typeof vi.fn>;
      scrollTo: ReturnType<typeof vi.fn>;
    } = {
      scrollY: 900,
      innerHeight: 800,
      location: { pathname: "/ani-bis-e/e1" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn(),
      setTimeout: vi.fn(() => 2),
      clearTimeout: vi.fn(),
      // Igual que en el otro entorno: mover de verdad es lo que deja probar el freno de reentrada.
      scrollTo: vi.fn(({ top }: { top: number }) => {
        w.scrollY = top;
      }),
    };
    vi.stubGlobal("window", w);
    vi.stubGlobal("document", { documentElement: { scrollHeight: 4000 } });
    ultimo = w;
    return w;
  };

  afterEach(() => {
    retirarGuard();
    vi.unstubAllGlobals();
  });

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
    // DESDE EL 2026-09-10 el freno NO es desmontarse (el corrector sigue armado a propósito, para el
    // segundo movimiento): es que el eco llega con la página ya en su sitio y sale por la guarda del
    // mínimo. Por eso el entorno tiene que mover de verdad la página al hacer `scrollTo`.
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

describe("la etapa que se abre al entrar a una evaluación (cotejo 3 y 5)", () => {
  const TABS = readFileSync("src/modules/diagnoses/components/evaluation-tabs.tsx", "utf8");
  const PAGE_SRC = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
  const BIS = readFileSync("src/modules/bis-intake/components/bis-conditions-capture.tsx", "utf8");

  // SU REGLA (Santiago, cotejo 2026-09-05): sin diagnóstico se abre en Evaluación, que es donde hay
  // trabajo por hacer; con diagnóstico se abre en Diagnóstico, que es lo que se viene a ver. Antes el
  // default era fijo y entrar a una evaluación sin diagnóstico abría una pestaña vacía.

  it("la decide la PÁGINA, que es quien sabe si hay diagnóstico", () => {
    // ALCANCE AJUSTADO (2026-09-10), no la asercion. Se fijaba la FIRMA literal de `parseTab`, y al
    // añadirle el parametro que traduce los enlaces de la etapa vieja se puso roja por la firma y no por
    // la regla. Lo que importa es que el default ENTRE por parametro, no que la firma tenga dos huecos.
    expect(TABS, "el default volvió a estar clavado en el componente").toMatch(
      /function parseTab([^)]*porDefecto: TabId)/,
    );
    // Los DOS caminos de la página lo declaran. Es el sitio de llamada: un camino que no lo pase cae al
    // default del componente y nadie se entera.
    //
    // Y el camino SIN diagnostico abre en "encuesta" desde que Evaluacion se partio en dos: es la misma
    // regla de antes (empezar por donde hay trabajo), aplicada a la primera de las dos mitades.
    expect(PAGE_SRC).toContain('porDefecto="encuesta"');
    expect(PAGE_SRC).toContain('porDefecto="diagnostico"');
  });

  it("y `?etapa=diagnostico` sigue llegando a Diagnóstico", () => {
    // LA TRAMPA QUE HABIA: el parseo excluía "diagnostico" de la lista válida y lo dejaba caer al default,
    // que casualmente era el mismo. Con el default configurable, esa línea habría mandado
    // `?etapa=diagnostico` a Evaluación. Se quitó, y esto lo fija.
    // SE ASIERTA SOBRE EL CODIGO SIN COMENTARIOS, y no es un detalle de estilo: el comentario que explica
    // por que se quito esa linea la NOMBRA, asi que la asercion se cazaba a si misma. Ya nos paso con
    // `--clinical-*` en el panel de asesoria; es la misma forma.
    const codigo = sinComentarios(TABS);
    expect(codigo, "volvió la exclusión que rompía ?etapa=diagnostico").not.toContain(
      'raw !== "diagnostico"',
    );
  });

  it("el enlace de importar la medición lleva la ETAPA explícita", () => {
    // El punto 5 era el 3: el enlace ponía `?ev=antropometria` sin `?etapa`, así que la página caía a su
    // default y el profesional aterrizaba en Diagnóstico con la subpestaña correcta donde no la veía.
    // Va explícito aunque el default ya esté bien: un enlace que depende de un default se rompe en
    // silencio la próxima vez que alguien mueva el default.
    //
    // ALCANCE AJUSTADO (2026-09-10): la dirección son ahora DOS caracteres menos porque Antrop. & BIS es
    // pestaña propia (`?etapa=antro` en vez de `?etapa=evaluacion&ev=antropometria`). La asercion es la
    // misma: el enlace nombra su destino en vez de confiarlo al default.
    expect(sinComentarios(BIS)).toContain("?etapa=antro");
  });
});
