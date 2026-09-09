import { describe, expect, it } from "vitest";

// CANDADO DE LA NAVEGACION POR ETAPAS. Lo que se blinda es que cada etapa sea ALCANZABLE por URL: una
// etapa en la lista cuyo id el parseo no reconoce se renderiza en la barra, no se puede abrir con un
// enlace, y al recargar cae en Diagnostico. Ese defecto es SILENCIOSO (nada falla, la pestaña "funciona"
// mientras se navegue con clics) y es exactamente el que introdujo la quinta etapa: el parseo era una
// cadena de comparaciones y agregarla sin tocarla la habria dejado inalcanzable.
//
// Se prueba sobre las FUENTES, no sobre el render: el componente es "use client" con hooks de navegacion,
// y montarlo aqui exigiria una infra que no tenemos. Lo que importa es la coherencia entre la lista de
// etapas, el parseo y el mapa de contenidos, y eso se ve en el archivo.

import { readFileSync } from "node:fs";

const SRC = readFileSync("src/modules/diagnoses/components/evaluation-tabs.tsx", "utf8");

// Ids declarados en TABS.
const idsDeLaBarra = [...SRC.matchAll(/\{ id: "([a-z]+)", label:/g)].map((m) => m[1]);

describe("navegacion por etapas de la evaluacion", () => {
  it("la barra declara las etapas de su archivo, ni una menos", () => {
    // ALCANCE AJUSTADO (2026-09-10), no la asercion. Este caso escribia las cinco etapas a mano, y al
    // partir Evaluacion en Encuesta + Antrop. & BIS (peticion de Gildardo, y es lo que su archivo tiene)
    // se puso rojo por la LISTA COPIADA, no por la regla.
    //
    // La lista deja de vivir aqui: quien afirma cuales y en que orden es
    // `etapas-en-su-orden.test.ts`, que las DERIVA de su HTML vigente. Una copia mas en este archivo seria
    // una tercera fuente que envejece sola, que es justo lo que ese candado vino a cerrar.
    //
    // Lo que este caso conserva es lo SUYO: que la barra no se quede vacia ni pierda etapas por un cambio
    // de forma, que es el control que hace significativo todo lo de abajo.
    expect(idsDeLaBarra.length, "no se leyeron las etapas de la barra").toBeGreaterThan(4);
    expect(new Set(idsDeLaBarra).size, "hay una etapa repetida en la barra").toBe(idsDeLaBarra.length);
  });

  it("el parseo valida contra la LISTA, no contra una cadena de comparaciones", () => {
    // Si vuelve a ser `raw === "a" || raw === "b" ...`, agregar una etapa y olvidar esa linea la deja
    // inalcanzable por URL sin que nada falle. Validar contra la lista hace imposible ese olvido.
    expect(SRC).toContain("TAB_IDS");
    expect(SRC).toMatch(/TAB_IDS\s*=\s*new Set<string>\(TABS\.map/);
    expect(SRC).toContain("TAB_IDS.has(raw)");
  });

  it("cada etapa de la barra tiene su slot en el mapa de contenidos", () => {
    // Una etapa sin contenido rendiriza un panel vacio: el tab se ve, se puede abrir, y no muestra nada.
    const mapa = SRC.slice(SRC.indexOf("const content: Record<TabId, ReactNode>"));
    const linea = mapa.slice(0, mapa.indexOf(";"));
    for (const id of idsDeLaBarra) {
      expect(linea, `falta el slot de ${id}`).toContain(id);
    }
  });

  it("el default lo decide la pagina, y nunca es una etapa del final", () => {
    // ALCANCE AJUSTADO (cotejo 2026-09-05, punto 3), no la asercion. Este caso fijaba la cadena
    // "diagnostico" como default del componente, y Santiago cambio la regla: sin diagnostico se abre en
    // Evaluacion, con diagnostico en Diagnostico. Lo que el caso GARANTIZA sigue igual y es lo que dice su
    // titulo: no se abre por el final. Eso ahora se verifica donde vive la decision, que es la pagina.
    expect(SRC, "el default volvio a estar clavado en el componente").toContain("porDefecto");
    const PAGE = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
    const defaults = [...PAGE.matchAll(/porDefecto="([a-z]+)"/g)].map((m) => m[1]);
    expect(defaults.length, "algun camino de la pagina no declara su etapa de entrada").toBe(2);
    for (const d of defaults) {
      // ALCANCE AJUSTADO (2026-09-10): "evaluacion" se partio en dos y el camino sin diagnostico abre
      // ahora en "encuesta", que es lo PRIMERO de la secuencia. La asercion no cambia: sigue prohibiendo
      // abrir por el final. Se declara por LO QUE NO PUEDE SER, que no depende de cuantas etapas haya.
      expect(
        ["seguimiento", "reporte"],
        `abrir en "${d}" es empezar por el final de la consulta`,
      ).not.toContain(d);
    }
  });

  it("el parametro propio es ?etapa y se copian los demas (las subpestañas no se pisan)", () => {
    expect(SRC).toContain('searchParams.get("etapa")');
    expect(SRC).toContain("new URLSearchParams(searchParams.toString())");
    expect(SRC).toContain('params.set("etapa", id)');
  });
});
