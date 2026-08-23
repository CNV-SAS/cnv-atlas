import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { INTER_TABLA_B, alimentosDe } from "@/clinical-engine/intercambio-alimentos";
import {
  ALIMENTOS_VISIBLES_PACIENTE,
  AlimentosDelSubgrupo,
  ListaIntercambioPaciente,
} from "@/modules/treatment/components/lista-intercambio";

// CANDADO DE LAS DOS SUPERFICIES de la lista de alimentos (porte del v8, 2026-08-23). Lo que se blinda no
// es el estilo: son los DOS RECORTES, que son decisiones de Gildardo y no nuestras, y que un edit futuro
// desharia con buena intencion ("¿por que ocultamos alimentos?").
//   - La del PROFESIONAL va PLEGADA. El subgrupo Cereales tiene 39 alimentos; desplegados rompen la tabla.
//   - La del PACIENTE va RECORTADA a 8 por subgrupo, con "entre otros". Una lista de 39 no se usa en casa.
// Si alguno de los dos se pierde, la pantalla sigue "funcionando" y por eso nadie lo notaria en un smoke.

const CEREALES = "Cereales"; // el subgrupo mas grande: 39 alimentos

describe("AlimentosDelSubgrupo (referencia del profesional)", () => {
  const markup = renderToStaticMarkup(createElement(AlimentosDelSubgrupo, { sub: CEREALES }));

  it("va PLEGADA: usa details/summary, no una lista abierta", () => {
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
  });

  it("el resumen anuncia CUANTOS alimentos hay, con el conteo real", () => {
    expect(markup).toContain(`ver ${alimentosDe(CEREALES).length} alimentos`);
  });

  it("muestra TODOS los del subgrupo (es referencia; el recorte es de la lista del paciente)", () => {
    for (const a of alimentosDe(CEREALES)) expect(markup).toContain(a.al);
  });

  it("cada alimento va con su gramaje, que es el dato que se consulta", () => {
    const uno = alimentosDe(CEREALES)[0];
    expect(markup).toContain(`${uno.al} (${uno.g} g)`);
  });
});

describe("ListaIntercambioPaciente (lo que se lleva el paciente)", () => {
  const markup = renderToStaticMarkup(createElement(ListaIntercambioPaciente));

  it("RECORTA a los primeros 8 por subgrupo y lo dice con 'entre otros'", () => {
    const todos = alimentosDe(CEREALES);
    expect(todos.length).toBeGreaterThan(ALIMENTOS_VISIBLES_PACIENTE); // si no, el caso no prueba nada
    const visibles = todos.slice(0, ALIMENTOS_VISIBLES_PACIENTE);
    const ocultos = todos.slice(ALIMENTOS_VISIBLES_PACIENTE);
    for (const a of visibles) expect(markup, `deberia mostrar ${a.al}`).toContain(a.al);
    expect(markup).toContain("entre otros");
    // Y el ultimo oculto NO aparece: prueba que el recorte corta de verdad, no que solo diga la frase.
    expect(markup, `no deberia mostrar ${ocultos[ocultos.length - 1].al}`).not.toContain(
      ocultos[ocultos.length - 1].al,
    );
  });

  it("NO dice 'entre otros' en un subgrupo que cabe entero", () => {
    const corto = INTER_TABLA_B.reduce<Record<string, number>>((acc, a) => {
      acc[a.sub] = (acc[a.sub] ?? 0) + 1;
      return acc;
    }, {});
    const subCorto = Object.keys(corto).find((k) => corto[k] <= ALIMENTOS_VISIBLES_PACIENTE)!;
    const bloque = markup.slice(markup.indexOf(subCorto));
    const finBloque = bloque.indexOf("</p>");
    expect(bloque.slice(0, finBloque)).not.toContain("entre otros");
  });

  it("lleva el parrafo de COMO USARLA (sin el, la lista no se entiende en casa)", () => {
    expect(markup).toContain("puedes intercambiarlos libremente");
    expect(markup).toContain("una porción de intercambio");
  });

  it("recorre los 12 grupos, no solo los que tienen porciones", () => {
    // Es la tabla completa, igual para todos: lo que cambia por paciente son las PORCIONES, que estan
    // en la tabla de arriba. Si algun dia se filtrara por porciones>0, el paciente perderia alternativas.
    expect(markup).toContain("Harinas");
    expect(markup).toContain("Bebidas");
  });
});
