import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ EL CANDADO DE LA RED POR PANEL (2026-10-07) ═══
//
// ── EL CASO REAL ───────────────────────────────────────────────────────────────────────────────────
//
// Produccion, 7 de octubre, 14:54 UTC: un profesional paso de Diagnostico a Antrop. & BIS y React lanzo
// "Rendered more hooks than during the previous render.". Lo atrapo el `error.tsx` de la RAIZ, asi que la
// pantalla entera se volvio "Algo salio mal" y el profesional perdio la consulta que estaba atendiendo.
//
// ── Y LA RAZON POR LA QUE ESTO NO ES COSMETICO ────────────────────────────────────────────────────
//
// El `error.tsx` de Next recibe `{ error, reset }` y NO el `errorInfo` de React, que es donde viaja el
// COMPONENT STACK. O sea que por ese camino el evento de Sentry nunca iba a decir QUE componente se rompio,
// ni esperando a que volviera a pasar. Una frontera de clase si lo recibe.
//
// ASI QUE ESTE CANDADO PROTEGE DOS COSAS A LA VEZ: que el daño no pase de una pestaña, y que el instrumento
// que nombra al culpable siga puesto. Quitar la frontera "porque no hace nada visible" devolveria las dos.

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

describe("una etapa que se cae no se lleva la consulta entera", () => {
  const tabs = leer("src/modules/diagnoses/components/evaluation-tabs.tsx");
  const red = leer("src/modules/diagnoses/components/panel-con-red.tsx");

  it("cada panel va dentro de la frontera, no el conjunto", () => {
    // DENTRO DEL `map`, que es lo que lo hace POR PANEL: una sola frontera alrededor del conjunto se
    // llevaria las seis etapas, que es casi lo mismo que tener solo la de la raiz.
    const bloque = tabs.slice(tabs.indexOf("visitadas.map("));
    expect(bloque, "el panel dejo de ir dentro de PanelConRed").toContain("<PanelConRed");
    expect(
      bloque.indexOf("<PanelConRed"),
      "PanelConRed tiene que envolver a EtapaActiva, no al contrario",
    ).toBeLessThan(bloque.indexOf("<EtapaActiva"));
  });

  it("y la frontera reporta a Sentry con la etapa, no en silencio", () => {
    expect(red, "la frontera dejo de ser la de Sentry: sin ella no hay component stack").toContain(
      "Sentry.ErrorBoundary",
    );
    // LA ETIQUETA DE LA ETAPA: sin ella los seis paneles se agrupan en el mismo issue y el evento no dice
    // en cual de las seis se rompio, que es la mitad de la pista.
    expect(red).toContain('setTag("etapa"');
  });

  it("y el panel roto dice que no se perdio nada, en vez de quedarse en blanco", () => {
    // UN PANEL VACIO SE LEE COMO "no hay nada que mostrar", que es otra cosa. Y la frase sobre lo guardado
    // existe porque el miedo razonable del profesional es haber perdido el borrador del tratamiento.
    expect(red).toContain("no se perdió nada de lo guardado");
    expect(red, "sin salida, el profesional se queda con un recuadro y nada que pulsar").toContain(
      "resetError()",
    );
  });
});

describe("el build dice si sube los sourcemaps", () => {
  it("no se calla cuando va a subirlos", () => {
    const cfg = leer("next.config.ts");
    // `silent: true` a secas se comia TODA la salida del plugin, incluidos sus errores: "no aparecio" no
    // distinguia entre el plugin no corrio, el build se reuso, o la subida fallo.
    // SE MIRA LA OPCION, NO EL TEXTO: el comentario de al lado CITA `silent: true` para explicar por que se
    // quito, asi que un "not.toContain" tropezaria con su propia documentacion.
    const opcion = cfg.split("\n").find((l) => /^\s*silent:/.test(l)) ?? "";
    expect(opcion, "volvio el silent incondicional: el log del build deja de poder comprobarse").toContain(
      "!subirSourcemaps",
    );
    expect(cfg).toContain("[sentry] subida de sourcemaps");
    // Y NUNCA EL TOKEN EN EL LOG: el log del build de Vercel lo ve cualquiera con acceso al proyecto.
    expect(cfg, "el token no se imprime, solo si esta presente").not.toMatch(
      /\$\{process\.env\.SENTRY_AUTH_TOKEN\}/,
    );
  });
});
