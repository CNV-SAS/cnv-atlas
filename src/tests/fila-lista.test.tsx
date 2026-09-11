import { readFileSync } from "node:fs";

import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { type ColumnaLista, FilaLista, ListaFilas } from "@/components/shared/fila-lista";
import { COLUMNAS_PACIENTES } from "@/modules/patients/columnas";

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

  it("y SOLO el borde de abajo resalta", () => {
    // Santiago, 2026-09-10: "el borde superior del encabezado, del mismo color de los bordes de los
    // lados. Que el unico borde con color diferente y que resalta sea el de abajo". Llevaba `border-y`,
    // asi que pintaba una linea azul ARRIBA pegada al borde de la tarjeta: dos lineas de colores
    // distintos a un pixel una de otra. Arriba no hace falta ninguna, el borde de la tarjeta ya cierra.
    expect(markup).not.toContain("border-y border-primary");
    expect(markup).toContain("border-b border-primary/20");
  });

  it("las columnas se declaran UNA vez, en las variables que heredan las filas", () => {
    // TRES JUEGOS DE PISTAS, uno por escalon de ancho (ver `desde` en ColumnaLista). Sin columnas que
    // esperen, los tres son iguales; lo que el candado afirma es que se declaran UNA vez cada uno y que
    // la fila los lee de la herencia, no de una copia propia.
    expect(veces(markup, "--cols-md:minmax(0,1fr) 7rem 7rem 11rem")).toBe(1);
    expect(veces(markup, "--cols-lg:minmax(0,1fr) 7rem 7rem 11rem")).toBe(1);
    expect(veces(markup, "--cols-xl:minmax(0,1fr) 7rem 7rem 11rem")).toBe(1);
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

  it("y el rotulo dice DE QUE es la fecha, que es lo que un adjetivo solo no dice", () => {
    // ═══ RE-ANCLADO: LA COLUMNA CAMBIO DE DATO (Santiago, 2026-09-10, tercera vuelta) ═══
    //
    // "Última evaluación" se retiro entera: su fecha repetia la primera de las tres que ya salen al
    // desplegar la fila. En su sitio va la FECHA DE CREACION de la ficha, que es un dato que la lista no
    // daba en ningun sitio.
    //
    // LO QUE EL CASO SIGUE PROTEGIENDO es la regla que lo origino, no la columna: el rotulo tiene que
    // nombrar SU dato. "Fecha" a secas seria el mismo defecto que "Última" (¿fecha de que?), y "Fecha de
    // creación de la evaluación" seria peor: afirmaria de la evaluacion lo que es del paciente.
    const fecha = COLUMNAS_PACIENTES.find((c) => c.rotulo.includes("Fecha"))?.rotulo ?? "";
    expect(fecha, "desapareció la columna de fecha").not.toBe("");
    expect(fecha).toBe("Fecha de creación");
    expect(fecha).not.toContain("evaluación");
    expect(COLUMNAS_PACIENTES.some((c) => c.rotulo === "Evaluaciones")).toBe(true);
  });
});

describe("el pie de la lista: solo cuando el filtro esconde algo", () => {
  // Sin filtro repetia la tarjeta de metrica de arriba, y dos sitios con la misma cifra no informan mas,
  // solo hacen dudar de si son lo mismo. Con filtro NO es la misma cifra: dice cuantos quedaron FUERA, que
  // es justo lo que la tarjeta no puede decir.
  const conPie = renderToStaticMarkup(
    h(ListaFilas, {
      columnas: COLUMNAS,
      pie: "3 de 40 pacientes",
      children: h(FilaLista, {
        href: "/p/1",
        titulo: "María Restrepo",
        columnas: COLUMNAS,
        valores: ["12 ago", "3", "CC 1"],
      }),
    }),
  );
  const sinPie = renderToStaticMarkup(
    h(ListaFilas, {
      columnas: COLUMNAS,
      pie: null,
      children: h(FilaLista, {
        href: "/p/1",
        titulo: "María Restrepo",
        columnas: COLUMNAS,
        valores: ["12 ago", "3", "CC 1"],
      }),
    }),
  );

  it("con pie lo pinta, y sin pie NO deja la franja vacia", () => {
    expect(conPie).toContain("3 de 40 pacientes");
    // La franja del pie tiene borde superior: sin contenido no debe existir, o quedaria una linea suelta
    // bajo la ultima fila.
    expect(veces(conPie, "border-t border-border")).toBe(1);
    expect(veces(sinPie, "border-t border-border")).toBe(0);
  });
});

describe("los botones de fila no son una columna: la pista se RESERVA", () => {
  // ═══ EL DEFECTO QUE ESTE CANDADO IMPIDE QUE VUELVA (Santiago, 2026-09-10) ═══
  //
  // Los dos botones caian a UNA SEGUNDA FILA debajo del nombre, y aguanto dos tandas porque se diagnostico
  // como un problema de ANCHO: se fijo la columna "Acciones" en 6rem y no cambio nada, porque el ancho
  // nunca fue la causa.
  //
  // LA CAUSA: la lista declaraba "Acciones" como una COLUMNA (con su celda vacia en cada fila) Y ademas
  // pintaba el contenedor de botones como hermano. Siete pistas, ocho items de grid. El octavo cae a una
  // fila IMPLICITA, y una fila implicita empieza en la columna 1: justo debajo del nombre.
  //
  // POR QUE ES INVISIBLE A tsc Y A ESTE ARCHIVO SIN EL CANDADO: las dos piezas son validas por separado y
  // el conteo solo se rompe al juntarlas. Es la familia de "cada mitad esta bien y el total no".
  it("declarar conAcciones Y una columna Acciones falla RUIDOSO", () => {
    expect(() =>
      renderToStaticMarkup(
        h(ListaFilas, {
          columnas: [...COLUMNAS, { rotulo: "Acciones", ancho: "6rem" }],
          conAcciones: true,
          children: h(FilaLista, {
            href: "/p/1",
            titulo: "X",
            columnas: [...COLUMNAS, { rotulo: "Acciones", ancho: "6rem" }],
            valores: ["12 ago", "3", "CC 1", null],
          }),
        }),
      ),
    ).toThrow(/conAcciones/);
  });

  it("la lista de pacientes reserva la pista y NO declara la columna", () => {
    expect(COLUMNAS_PACIENTES.some((c) => c.rotulo === "Acciones")).toBe(false);
    const LISTA = readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8");
    expect(LISTA).toContain("conAcciones");
  });

  it("con conAcciones la pista extra existe y la cabecera la rotula", () => {
    const markup = renderToStaticMarkup(
      h(ListaFilas, {
        columnas: COLUMNAS,
        conAcciones: true,
        children: h(FilaLista, {
          href: "/p/1",
          titulo: "X",
          columnas: COLUMNAS,
          valores: ["12 ago", "3", "CC 1"],
          acciones: h("button", { type: "button" }, "archivar"),
        }),
      }),
    );
    // LA PISTA DE ACCIONES ES FIJA, NO `auto`, y ese era el desalineado que Santiago capturo: `auto` se
    // resuelve contra el contenido de CADA grid, y la cabecera y la fila son grids distintos (el texto
    // "ACCIONES" mide menos que dos botones), asi que sus columnas no coincidian.
    expect(markup).toContain("--cols-md:minmax(0,1fr) 7rem 7rem 11rem 5.5rem");
    expect(markup).not.toContain("11rem auto");
    expect(veces(markup, "Acciones")).toBe(1);
  });
});

describe("las columnas entran por escalones: nada se pierde, se aplaza", () => {
  // ═══ EL DEFECTO (Santiago, 2026-09-10): "al cambiar el tamaño de la ventana todo se amontona" ═══
  //
  // Las pistas son anchos FIJOS en rem, y un grid cuyas pistas fijas suman mas que su contenedor NO las
  // encoge: las DESBORDA. Entre 768 px y el ancho que la suma pide, las celdas de la derecha se salian de
  // la tarjeta. No se amontonaba: se PERDIA, que es peor, porque nada indica que falte algo.
  const CON_ESCALON: readonly ColumnaLista[] = [
    { rotulo: "Pendiente", ancho: "13rem" },
    { rotulo: "Última evaluación", ancho: "9rem", desde: "lg" },
    { rotulo: "Evaluaciones", ancho: "6rem", desde: "xl" },
  ];
  const markup = renderToStaticMarkup(
    h(ListaFilas, {
      columnas: CON_ESCALON,
      children: h(FilaLista, {
        href: "/p/1",
        titulo: "X",
        columnas: CON_ESCALON,
        valores: ["Montar BIS", "12 ago", "3"],
      }),
    }),
  );

  it("cada escalon declara solo las pistas que caben en el", () => {
    expect(markup).toContain("--cols-md:minmax(0,1fr) 13rem");
    expect(markup).toContain("--cols-lg:minmax(0,1fr) 13rem 9rem");
    expect(markup).toContain("--cols-xl:minmax(0,1fr) 13rem 9rem 6rem");
  });

  it("la celda aplazada SIGUE en la linea concatenada del telefono", () => {
    // Esto es lo que distingue aplazar de perder: por debajo de 768 px todas vuelven a la segunda linea.
    // Si alguien "simplifica" a `hidden lg:block`, el dato desaparece tambien en el telefono, que es
    // donde MENOS sitio hay para ir a buscarlo a otra pantalla.
    expect(markup).toContain("md:hidden lg:block");
    expect(markup).toContain("md:hidden xl:block");
  });

  it("lo que NO puede faltar no lleva escalon", () => {
    // Su instruccion, literal: nombre, pendiente y acciones son las que no pueden faltar.
    const pendiente = COLUMNAS_PACIENTES.find((c) => c.rotulo === "Pendiente");
    expect(pendiente, "desapareció la columna de pendientes").toBeDefined();
    expect(pendiente?.desde).toBeUndefined();
  });
});
