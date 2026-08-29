import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { type ColumnaLista, FilaLista, ListaFilas } from "@/components/shared/fila-lista";
import { COLUMNAS_PACIENTES } from "@/modules/patients/components/lista-pacientes";

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

describe("FilaLista: DEFECTO CORREGIDO, un valor ausente no corre las columnas", () => {
  // Visto en la captura de Santiago del 2026-08-28: un paciente sin ultima consulta mostraba su numero de
  // evaluaciones bajo "Última" y su edad bajo "Evaluaciones". La primera version filtraba los nulos ANTES
  // de pintar, asi que en columnas los valores siguientes se corrian una celda a la izquierda.
  //
  // NO ERA UN FALLO VISIBLE: los valores se leen perfectamente, solo que rotulados mal, que es justo el
  // modo de fallo contra el que existe el `throw` de alineacion. Por eso el candado mira el CONTEO de
  // celdas y no solo el contenido.
  const conHueco = filaSola([null, "3", "CC 1.020.334.221"]);

  it("en COLUMNAS la celda vacia se pinta igual: tantas celdas como columnas", () => {
    // Una celda por columna, siempre. Si se filtrara el nulo, saldrian 2 y las dos ultimas se correrian.
    expect(veces(conHueco, "<span class=")).toBeGreaterThanOrEqual(COLUMNAS.length);
    expect(conHueco).toContain("hidden md:block");
  });

  it("y en DOS LINEAS desaparece: un hueco no dice nada donde no hay cabecera", () => {
    expect(conHueco).toContain("hidden md:block");
    expect(conHueco).not.toContain("Última: ");
  });

  it("el separador no queda HUERFANO cuando falta el primer valor", () => {
    // Solo un separador: entre "3" y el documento. No uno delante del "3" por ser el indice 1.
    expect(veces(conHueco, ">·</span>")).toBe(1);
  });
});

describe("rotulos de columna: un adjetivo solo no nombra un dato", () => {
  // DEFECTO ENCONTRADO POR SANTIAGO (2026-08-28): la columna decia "Última", que es un adjetivo sin
  // sustantivo. Un profesional nuevo no sabia si era la ultima consulta, la ultima cita o la ultima
  // evaluacion. Es la misma familia que ya le reportamos tres veces a Gildardo: una etiqueta que nombra una
  // cosa y muestra otra, o que no nombra nada.
  //
  // LA REGLA QUE SALE DEL BARRIDO, y explica por que "Previo"/"Actual" en la tabla de seguimiento SI estan
  // bien: un adjetivo funciona como encabezado solo cuando la PRIMERA columna nombra el sujeto de la fila.
  // Alli la fila empieza por "Indicador", asi que "previo" y "actual" se enganchan a el. Aqui la fila
  // empieza por el paciente, y "ultima" no describe al paciente.
  const ADJETIVOS_SOLOS = /^(Última|Últimos?|Actual|Previo|Anterior|Siguiente|Nuevo|Nueva)$/i;

  it("ninguna columna de la lista de pacientes es un adjetivo suelto", () => {
    for (const c of COLUMNAS_PACIENTES) expect(c.rotulo).not.toMatch(ADJETIVOS_SOLOS);
  });

  it("y el rotulo dice lo que el dato ES: la fecha viene de EVALUACIONES, no de consultas", () => {
    // No es un matiz: la fecha sale del MISMO filtro que produce la columna "Evaluaciones". Llamar
    // "consulta" a lo que la columna de al lado llama "evaluacion" sugeriria que son dos cosas distintas.
    const fecha = COLUMNAS_PACIENTES[0].rotulo;
    expect(fecha).toContain("evaluación");
    expect(fecha).not.toContain("consulta");
    expect(COLUMNAS_PACIENTES[1].rotulo).toBe("Evaluaciones");
  });
});
