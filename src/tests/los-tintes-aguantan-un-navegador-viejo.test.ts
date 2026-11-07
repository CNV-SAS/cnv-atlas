import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN TINTE NO PUEDE SALIR SOLIDO EN EL NAVEGADOR DE UNA PROFESIONAL  ·  2026-11-06
//
// ═══ EL CASO ═══
//
// Maria Teresa importo un archivo con un valor fuera de rango y el aviso salio como un BLOQUE ROJO SOLIDO
// con la letra encima, ilegible. En Windows el mismo aviso es rosa claro con letra roja.
//
// ═══ LA CAUSA, LEIDA EN EL CSS COMPILADO (no supuesta) ═══
//
//     .bg-destructive\/5 { background-color: var(--destructive); }            <- respaldo, SOLIDO
//     @supports (color: color-mix(in lab, red, red)) { ... el tinte ... }
//
// En un navegador sin `color-mix()` (Safari < 16.2, Chrome < 111) se aplica el respaldo y el color sale
// ENTERO. Un tinte del 5 % sale veinte veces mas fuerte de lo que se diseño.
//
// ═══ QUE VIGILA ESTE CANDADO ═══
//
// Que TODA clase de FONDO con opacidad baja que la app use de verdad este cubierta por el bloque
// `@supports not` de `globals.css`. Una clase nueva sin cubrir vuelve a romper la misma pantalla, y el
// defecto es invisible desde aqui: en la maquina de quien programa se ve perfecto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const CSS = readFileSync("src/app/globals.css", "utf8");

/** El bloque del remedio, aislado: lo que esta fuera de el no cuenta como cobertura. */
const REMEDIO = (() => {
  const i = CSS.indexOf("@supports not (color: color-mix(in lab, red, red))");
  expect(i, "desaparecio el bloque que arregla los tintes en navegadores viejos").toBeGreaterThan(-1);
  // Hasta el cierre de su llave: se corta en el ultimo `}` del archivo, que basta porque el bloque es lo
  // ultimo y lo que importa es que las clases esten DENTRO de un `@supports not`.
  return CSS.slice(i);
})();

function archivosDe(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta));
    else if (/\.tsx$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

/**
 * LO QUE NO HACE FALTA CUBRIR, y por que. No es una lista para ir engordando: cada entrada dice por que
 * su version solida NO deja un texto ilegible.
 *
 *   · `muted` e `input` son grises que ya son casi blancos (#F6F7F9 y #DEE1E8): su solido se parece al
 *     tinte y el texto encima se sigue leyendo.
 *   · `attention-bg` y los `-bg` en general YA SON el fondo claro: ponerles opacidad y perderla no cambia
 *     nada apreciable.
 *   · Una opacidad ALTA (70 % o mas) se parece a su solido por definicion.
 */
const NO_HACE_FALTA = /^(muted|input|[a-z-]+-bg)$/;
const OPACIDAD_ALTA = 70;

describe("los tintes aguantan un navegador que no sabe mezclar colores", () => {
  const usadas = new Map<string, string[]>();
  for (const archivo of archivosDe("src")) {
    const texto = readFileSync(archivo, "utf8");
    for (const m of texto.matchAll(/\bbg-([a-z][a-z-]*)\/(\d+)\b/g)) {
      const [clase, familia, alfa] = [m[0], m[1], Number(m[2])];
      if (NO_HACE_FALTA.test(familia) || alfa >= OPACIDAD_ALTA) continue;
      if (!usadas.has(clase)) usadas.set(clase, []);
      usadas.get(clase)!.push(archivo.replace(/\\/g, "/"));
    }
  }

  it("CONTROL: se encontraron clases con opacidad de verdad", () => {
    // Sin esto, un barrido que no encuentre nada pasaria verde sobre una app rota.
    expect(usadas.size, "no se encontro ni una clase de fondo con opacidad").toBeGreaterThanOrEqual(5);
  });

  it("todas las de opacidad baja estan cubiertas por el bloque `@supports not`", () => {
    const sinCubrir: string[] = [];
    for (const [clase, archivos] of usadas) {
      // La clase, escapada como la escribe el CSS: `bg-destructive\/5`.
      const enCss = clase.replace("/", "\\/");
      if (!REMEDIO.includes(enCss)) sinCubrir.push(`${clase}  (p. ej. ${archivos[0]})`);
    }
    expect(
      sinCubrir,
      `estas clases se pintan SOLIDAS en Safari < 16.2 y Chrome < 111, y llevan texto encima:\n  ${sinCubrir.join("\n  ")}\nAgrégalas al bloque \`@supports not\` de globals.css con el fondo claro que les corresponde.`,
    ).toEqual([]);
  });

  it("y los dos graves siguen cubiertos, por su nombre", () => {
    // EL FONDO DE LOS DIALOGOS: solido tapa la pantalla entera en negro. Es el peor de los 64 y por eso
    // se nombra aparte, para que no se pierda dentro de un barrido.
    expect(REMEDIO, "el fondo de los diálogos volvió a quedar sin cubrir").toContain("bg-black\\/10");
    expect(REMEDIO).toContain("rgba(0, 0, 0, 0.1)");
    // LA ETIQUETA DENTRO DE LA BANDA OSCURA: solido deja letra blanca sobre blanco.
    expect(REMEDIO).toContain("bg-white\\/15");
    expect(REMEDIO).toContain("rgba(255, 255, 255, 0.15)");
  });

  it("el remedio NO se aplica en un navegador moderno", () => {
    // La garantía que lo hace seguro: va dentro de `@supports not`, así que en un navegador que sí sabe
    // mezclar no existe. Si alguien lo sacara de ahí, pisaría los tintes de todo el mundo.
    expect(REMEDIO.startsWith("@supports not (color: color-mix(in lab, red, red))")).toBe(true);
    // Y SIN `@layer`: lo no estratificado gana a las utilidades de Tailwind, que viven en una capa. Dentro
    // de una capa, el remedio perdería contra la clase que viene a corregir.
    const antes = CSS.slice(0, CSS.indexOf("@supports not (color: color-mix(in lab, red, red))"));
    const capasAbiertas = (antes.match(/@layer\s+\w+\s*\{/g) ?? []).length;
    const capasCerradas = (antes.match(/^\}/gm) ?? []).length;
    expect(capasAbiertas, "el remedio quedó dentro de un @layer y pierde la cascada").toBeLessThanOrEqual(
      capasCerradas,
    );
  });
});
