import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { type ColumnaLista, FilaLista, ListaFilas } from "@/components/shared/fila-lista";

// CANDADO DE "UN SOLO DOM, UN SOLO CONTENIDO, DOS DISPOSICIONES" (2026-08-28).
//
// La fila de lista se ve de dos formas segun el ancho: columnas en escritorio, dos lineas en telefono. Hay
// tres maneras de lograr eso y dos son malas: renderizar las dos disposiciones y ocultar una con CSS
// (DUPLICA el contenido, y un lector de pantalla anuncia cada fila dos veces), o elegir en JavaScript segun
// el ancho (rompe la hidratacion). La buena es un solo DOM repartido por CSS, que es la que esta.
//
// LO QUE ESTE CANDADO PROTEGE es justamente eso, porque las tres se ven IGUAL en pantalla: si alguien
// "arregla" la fila duplicandola, el smoke visual pasa y solo lo nota quien use lector de pantalla.
// Por eso la asercion es sobre el CONTEO: cada campo aparece EXACTAMENTE UNA VEZ en el markup.

const COLUMNAS: readonly ColumnaLista[] = [
  { rotulo: "Última", ancho: "7rem", numerico: true, rotularEnEstrecho: true },
  { rotulo: "Evaluaciones", ancho: "7rem", numerico: true, rotularEnEstrecho: true },
  { rotulo: "Documento", ancho: "11rem" },
];

function veces(hay: string, aguja: string): number {
  return hay.split(aguja).length - 1;
}

function filaSola(valores: readonly (string | null)[]) {
  return renderToStaticMarkup(
    h(FilaLista, { href: "/pacientes/p1", titulo: "María Restrepo", columnas: COLUMNAS, valores }),
  );
}

describe("FilaLista: un contenido, no dos", () => {
  const markup = filaSola(["12 ago", "3", "CC 1.020.334.221"]);

  it("cada valor aparece EXACTAMENTE UNA VEZ", () => {
    expect(veces(markup, "12 ago")).toBe(1);
    expect(veces(markup, "CC 1.020.334.221")).toBe(1);
  });

  it("el titulo aparece EXACTAMENTE UNA VEZ", () => {
    expect(veces(markup, "María Restrepo")).toBe(1);
  });

  it("el rotulo de estrecho aparece una vez, y oculto en ancho (la cabecera lo da alli)", () => {
    expect(veces(markup, "Última: ")).toBe(1);
    expect(markup).toContain("md:hidden");
  });

  it("el valor que se explica solo NO lleva rotulo delante", () => {
    expect(markup).not.toContain("Documento: ");
  });
});

describe("FilaLista: las dos disposiciones salen del mismo DOM", () => {
  const markup = filaSola(["12 ago", "3", "CC 1.020.334.221"]);

  it("en ancho las celdas pasan a ser items del grid de la fila (display: contents)", () => {
    expect(markup).toContain("md:contents");
  });

  it("la fila lee las columnas de la variable heredada, no de una copia propia", () => {
    expect(markup).toContain("grid-template-columns:var(--cols)");
  });

  it("el separador es un NODO REAL, no un content-[] que puede no emitirse en silencio", () => {
    // Uno menos que columnas: no va delante del primer valor. Y se apaga en la disposicion de columnas.
    expect(veces(markup, ">·</span>")).toBe(COLUMNAS.length - 1);
    expect(veces(markup, 'aria-hidden="true" class="mr-2 text-border md:hidden"')).toBe(
      COLUMNAS.length - 1,
    );
  });

  it("los digitos que alinean entre filas van con tabular-nums", () => {
    expect(veces(markup, "tabular-nums")).toBe(2); // Última y Evaluaciones, no Documento
  });
});

describe("FilaLista: ausencia de dato", () => {
  it("un valor null se OMITE, no se pinta un guion", () => {
    const markup = filaSola([null, "0", "CC 1.020.334.221"]);
    expect(markup).not.toContain("Última");
    expect(markup).not.toContain("&#x2014;"); // em-dash
    expect(veces(markup, "CC 1.020.334.221")).toBe(1);
  });
});

describe("FilaLista: alineacion valores/columnas", () => {
  it("falla RUIDOSO si no coinciden, porque desalineadas se leen igual pero rotuladas mal", () => {
    expect(() => filaSola(["12 ago", "3"])).toThrow(/2 valores para 3 columnas/);
  });
});

describe("ListaFilas: la cabecera", () => {
  const markup = renderToStaticMarkup(
    h(ListaFilas, {
      columnas: COLUMNAS,
      children: h(FilaLista, {
        href: "/pacientes/p1",
        titulo: "María Restrepo",
        columnas: COLUMNAS,
        valores: ["12 ago", "3", "CC 1.020.334.221"],
      }),
    }),
  );

  it("va oculta a lectores de pantalla: en lectura el valor ya se anuncia tras el nombre", () => {
    expect(markup).toContain('aria-hidden="true"');
  });

  it("solo se ve en ancho", () => {
    expect(markup).toContain("hidden border-b");
    expect(markup).toContain("md:grid");
  });

  it("las columnas se declaran UNA vez, en la variable que heredan las filas", () => {
    expect(veces(markup, "--cols:minmax(0,1fr) 7rem 7rem 11rem")).toBe(1);
  });

  it("la lista sigue siendo <ul> y solo contiene pacientes, no la cabecera", () => {
    expect(markup).toContain("<ul");
    expect(markup.indexOf("aria-hidden")).toBeLessThan(markup.indexOf("<ul"));
  });

  it("el rotulo de cada columna aparece una sola vez en la cabecera", () => {
    // "Última" tambien sale como rotulo de estrecho DENTRO de la fila: cabecera + fila = 2.
    expect(veces(markup, "Última")).toBe(2);
    expect(veces(markup, "Documento")).toBe(1); // no se rotula en estrecho
  });
});
