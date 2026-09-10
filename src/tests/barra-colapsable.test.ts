import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// LA BARRA LATERAL COLAPSABLE (Santiago, 2026-09-10), con su cuidado: "verifica que recuerde el estado
// entre pantallas: si se colapsa y vuelve a abrirse al navegar, estorba mas de lo que ayuda".
//
// No es una preferencia menor. Quien colapsa la barra lo hace para ganar ancho en una pantalla larga (el
// panel del nutricionista pasa de las mil lineas), asi que reabrirse al cambiar de seccion deshace justo
// lo que se pidio. Por eso el candado mira SOBRE TODO la persistencia, no el aspecto.

const SHELL = readFileSync("src/components/layout/app-shell.tsx", "utf8");
const HOOK = readFileSync("src/components/layout/usar-nav-colapsada.ts", "utf8");

describe("la preferencia sobrevive a la navegación", () => {
  it("vive fuera del componente, no en su estado", () => {
    // Un `useState` dentro del shell se reinicia con cada render del arbol de la ruta nueva, que es
    // exactamente el "vuelve a abrirse al navegar" que Santiago quiere evitar.
    expect(HOOK).toContain("window.localStorage");
    expect(HOOK).toContain('const CLAVE = "atlas:nav-colapsada"');
  });

  it("se lee EN EL RENDER, no en un efecto", () => {
    // Dos razones y las dos importan: `react-hooks/set-state-in-effect` prohíbe el setState en efecto, y
    // leer después de pintar deja un parpadeo (la barra abierta que se cierra) en cada carga.
    expect(HOOK).toContain("useSyncExternalStore(suscribir, leer, enServidor)");
  });

  it("y en el servidor se rinde ABIERTA, que es lo que no esconde nada", () => {
    expect(HOOK).toContain("const enServidor = () => false;");
  });

  it("si el navegador no deja guardar, no revienta: se queda abierta", () => {
    // Modo privado o cookies bloqueadas. Una preferencia de interfaz no puede tumbar la navegación.
    const lecturas = (HOOK.match(/try \{/g) ?? []).length;
    expect(lecturas, "el acceso a localStorage dejó de estar protegido").toBeGreaterThanOrEqual(2);
  });
});

describe("colapsada, los rótulos no desaparecen: flotan", () => {
  it("el rótulo va en un tooltip con PORTAL, no dentro del enlace", () => {
    // ═══ POR QUE PORTAL (2026-09-10) ═══
    //
    // La primera versión lo pintaba con `absolute` dentro del enlace y quedaba RECORTADO: la barra
    // necesita `overflow-y: auto` (una lista más larga que la pantalla no puede dejar items
    // inalcanzables) y CSS recorta también el eje horizontal en cuanto uno de los dos recorta. No había
    // forma de sacar el rótulo sin renunciar al desplazamiento, y renunciar a él es peor.
    //
    // El portal además trae de serie el foco de teclado y el cierre con Escape.
    expect(SHELL).toContain("<TooltipTrigger asChild>");
    expect(SHELL).toContain("<TooltipContent side=");
  });

  it("y la barra sigue pudiendo desplazarse: no se cambió una cosa por la otra", () => {
    const aside = SHELL.slice(SHELL.indexOf("<aside"), SHELL.indexOf("</aside>"));
    expect(aside, "la barra dejó de poder desplazarse").toContain("overflow-y-auto");
  });

  it("el texto sigue en el DOM: el enlace nunca queda sin nombre accesible", () => {
    // Colapsada el rótulo pasa a lectura de pantalla, no desaparece: el tooltip es una ayuda VISUAL
    // encima, no el único sitio donde vive el nombre del enlace.
    const bloque = SHELL.slice(SHELL.indexOf("function NavLinks"), SHELL.indexOf("// ROTULO DE SECCION"));
    expect(sinComentarios(bloque), "el rótulo dejó de estar en el DOM").toContain("{item.label}");
  });
});

describe("el tirador va en el borde, y dice lo que hace", () => {
  it("NO junto al logo", () => {
    // Junto al logo daba dos problemas de Santiago: abierto quedaba pegado a "CNV", y colapsado parecía
    // un item más de la lista. En el borde no es ninguna de las dos: no compite con la marca y no está
    // dentro de la navegación.
    const cabecera = SHELL.slice(SHELL.indexOf("<AtlasLogo compacto"), SHELL.indexOf("</nav>"));
    expect(cabecera, "el tirador volvió junto al logo").not.toContain("alternarNavColapsada");
    expect(SHELL).toContain("alternarNavColapsada");
  });

  it("y medio fuera, en un envoltorio que NO recorta", () => {
    // Dentro del aside, que sí recorta para poder desplazarse, quedaría cortado por la mitad. Por eso son
    // dos elementos y no uno.
    const i = SHELL.indexOf("</aside>");
    expect(SHELL.slice(i), "el tirador volvió a estar dentro de la barra").toContain("-right-3");
  });

  it("su etiqueta cambia con el estado", () => {
    expect(SHELL).toContain('aria-label={colapsada ? "Expandir navegación" : "Colapsar navegación"}');
    expect(SHELL).toContain("aria-pressed={colapsada}");
  });
});
