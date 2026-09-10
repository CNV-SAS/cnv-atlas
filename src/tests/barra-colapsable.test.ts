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
  it("cada enlace lleva su rótulo al lado al pasar por encima", () => {
    // Una barra de solo iconos obliga a aprenderse doce símbolos, y quien no se acuerda tiene que entrar
    // a mirar. Con el rótulo al lado se reconoce sin abrir nada.
    expect(SHELL).toContain("group-hover:block");
  });

  it("y también con el FOCO, no solo con el ratón", () => {
    // Quien navega con teclado necesita lo mismo que quien pasa el cursor.
    expect(SHELL).toContain("group-focus-within:block");
  });

  it("el texto sigue en el DOM: el enlace nunca queda sin nombre accesible", () => {
    // Con `sr-only` + `title` el enlace se anunciaría distinto según el estado de la barra. Aquí el
    // rótulo está siempre; lo que cambia es dónde se pinta.
    const bloque = SHELL.slice(SHELL.indexOf("function NavLinks"), SHELL.indexOf("// ROTULO DE SECCION"));
    expect(sinComentarios(bloque), "el rótulo dejó de estar en el DOM").toContain("{item.label}");
    expect(sinComentarios(bloque)).not.toContain("sr-only");
  });

  it("y el rótulo flotante no se corta contra el borde de la barra", () => {
    // `overflow-x: auto` en el aside recortaría el rótulo justo donde tiene que verse. Los dos ejes van
    // por separado: el vertical sigue haciendo falta para las listas largas.
    expect(SHELL).toContain("overflow-x-visible");
  });
});

describe("el mando vive en la barra y dice lo que hace", () => {
  it("la hamburguesa está en el aside, no en el header", () => {
    // El header ya tiene la suya, y abre otra cosa (el panel deslizante de móvil). Dos mandos parecidos
    // en la misma fila haciendo cosas distintas es como se aprende a no fiarse de ninguno.
    const aside = SHELL.slice(SHELL.indexOf("<aside"), SHELL.indexOf("</aside>"));
    expect(aside).toContain("alternarNavColapsada");
  });

  it("y su etiqueta cambia con el estado", () => {
    expect(SHELL).toContain('aria-label={colapsada ? "Expandir navegación" : "Colapsar navegación"}');
    expect(SHELL).toContain("aria-pressed={colapsada}");
  });
});
