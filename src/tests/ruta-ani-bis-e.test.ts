import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL RENOMBRE DE RUTA `/evaluaciones` -> `/ani-bis-e` (2026-09-10).
//
// POR QUE: renombrar una ruta es barato de escribir y caro de dejar a medias. Los dos modos de fallo son
// silenciosos: (1) queda un enlace apuntando a la direccion vieja, que ahora rebota por la redireccion en
// vez de ir directo (y el dia que la redireccion se retire, da 404); (2) alguien retira la redireccion
// creyendo que ya no hace falta, y todos los marcadores y enlaces pegados en notas y correos mueren.
//
// La ruta es INTERNA (lo que se comparte con un paciente va a `/encuesta/...`, no por aqui), asi que lo
// que hay al otro lado de esos enlaces son profesionales con marcadores, no pacientes.

const NEXT_CONFIG = readFileSync("next.config.ts", "utf8");
const NAV = readFileSync("src/components/layout/nav-config.ts", "utf8");

function archivosDeCodigo(dir: string, salida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosDeCodigo(ruta, salida);
    else if (/\.tsx?$/.test(entrada)) salida.push(ruta.split(sep).join("/"));
  }
  return salida;
}

describe("no queda nada apuntando a la ruta vieja", () => {
  it("ningún archivo de `src` la emite", () => {
    // SE MIRA EL CODIGO, NO LA PROSA. La primera version barria el texto crudo y se ponia roja por DOS
    // comentarios legitimos: el de `nav-config` que explica el renombre (`/evaluaciones` -> `/ani-bis-e`,
    // que es justo la historia que hay que conservar) y el de este mismo archivo, que tiene que nombrar la
    // ruta vieja para poder prohibirla. Un candado que se caza a si mismo no dice nada de la regla.
    const culpables = archivosDeCodigo("src")
      .filter((f) => f !== "src/tests/ruta-ani-bis-e.test.ts")
      .filter((f) => /\/evaluaciones(\/|\b)/.test(sinComentarios(readFileSync(f, "utf8"))));
    expect(culpables, "quedaron enlaces o rutas a /evaluaciones").toEqual([]);
  });

  it("el control: la ruta nueva sí aparece, y en el sidebar", () => {
    // Sin esto, un barrido sobre un `src` vacio o un patron roto pasaria verde diciendo "no queda nada".
    const conRutaNueva = archivosDeCodigo("src").filter((f) =>
      readFileSync(f, "utf8").includes("/ani-bis-e"),
    );
    expect(conRutaNueva.length, "no aparece la ruta nueva en ninguna parte").toBeGreaterThan(5);
    expect(sinComentarios(NAV)).toContain('href: "/ani-bis-e"');
    // EL ROTULO SE QUEDA (Santiago lo revierte el 2026-09-10, tras haberlo cambiado esa misma tarde): el
    // nombre no es de la pantalla, es del MODELO, y es como Gildardo y los profesionales lo llaman.
    expect(sinComentarios(NAV)).toContain('label: "Modelo ANI-BIS-E"');
  });

  it("y Pacientes se renombró SIN tocar su ruta", () => {
    // Las dos mitades importan: la etiqueta cambio, la direccion no. Si alguien "unifica" y le cambia la
    // ruta tambien, rompe marcadores sin que nadie lo haya pedido.
    const limpio = sinComentarios(NAV);
    // EL ROTULO CAMBIO A "Lista de pacientes" (Santiago, 2026-09-10) Y LA RUTA NO, que es justo lo que
    // este caso vigila: la pantalla ya se llamaba asi por dentro y el rotulo decia otra cosa.
    expect(limpio).toContain('label: "Lista de pacientes"');
    expect(limpio).toContain('href: "/pacientes"');
  });
});

describe("la redirección cubre las DOS formas", () => {
  it("la ruta pelada y la ruta con sufijo", () => {
    // `/:path*` NO cubre la pelada, y la pelada es justo la que esta en los marcadores (la bandeja).
    // Es el olvido tipico de este cambio, y no da error: da 404 el dia que alguien abre su marcador.
    const limpio = sinComentarios(NEXT_CONFIG);
    expect(limpio, "falta la redirección de la ruta sin sufijo").toContain(
      '{ source: "/evaluaciones", destination: "/ani-bis-e", permanent: true }',
    );
    expect(limpio, "falta la redirección de las rutas de detalle").toContain(
      '{ source: "/evaluaciones/:path*", destination: "/ani-bis-e/:path*", permanent: true }',
    );
  });

  it("y son PERMANENTES, no temporales", () => {
    // Un 307 le dice al navegador y a los buscadores "esto es temporal, sigan usando la vieja". No lo es.
    const bloque = NEXT_CONFIG.slice(NEXT_CONFIG.indexOf("async redirects()"));
    expect(bloque.slice(0, 600), "la redirección volvió a ser temporal").not.toContain(
      "permanent: false",
    );
  });
});
