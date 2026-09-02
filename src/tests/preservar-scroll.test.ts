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
      addEventListener: vi.fn((_e: string, _h: unknown, _o?: unknown) => undefined),
      removeEventListener: vi.fn(),
      setInterval: vi.fn((_fn: () => void, _ms?: number) => 1),
      clearInterval: vi.fn(),
      setTimeout: vi.fn(() => 2),
      clearTimeout: vi.fn(),
      scrollTo: vi.fn(),
    };
    vi.stubGlobal("window", w);
    vi.stubGlobal("document", { documentElement: { scrollHeight: alto } });
    return w;
  };
  const tick = (w: ReturnType<typeof entorno>) => {
    const fn = w.setInterval.mock.calls[0]?.[0];
    if (typeof fn !== "function") throw new Error("preservarScroll no programó el vigilante");
    fn();
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
