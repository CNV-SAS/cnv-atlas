import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { YuxtaposicionAlergenos } from "@/modules/nutraceuticals/components/yuxtaposicion-alergenos";

// ═══ LOS ROTULOS SE LEEN SOLOS, EN LAS CUATRO COMBINACIONES ═══
//
// EL DEFECTO QUE ESTE CANDADO IMPIDE QUE VUELVA (2026-09-11, cazado en el smoke). Los rotulos se
// escribieron como UNA FRASE REPARTIDA EN TRES COLUMNAS: "El paciente declaro alergia a" / "Y declaro
// intolerancia a" / "LUVIA declara". Leida entera funciona. Pero cual columna aparece DEPENDE DEL DATO, y
// el paciente del smoke declaraba intolerancias y ninguna alergia: la primera columna no se pinto, y la
// segunda salio empezando por "Y", sin sujeto.
//
// LA REGLA: cada rotulo tiene que sostenerse SOLO. Un texto que depende de que su vecino exista falla en
// cuanto el vecino falta, y en una pantalla condicional eso no es un caso borde, es la mitad de los casos.
//
// SE RENDERIZA DE VERDAD y no se lee el archivo: lo que fallaba no era el texto de una constante, era la
// COMBINACION que produce cada dato. Un candado que buscara cadenas en el fuente habria pasado verde con
// el defecto en pantalla, porque las dos cadenas estaban ahi.

const PACIENTE_SOLO_ALERGIAS = { alergias: ["Maní", "Mariscos"], intolerancias: [] };
const PACIENTE_SOLO_INTOLERANCIAS = { alergias: [], intolerancias: ["Lactosa"] };
const PACIENTE_AMBAS = { alergias: ["Leche"], intolerancias: ["Lactosa (leche y lácteos)"] };

function pintar(paciente: { alergias: string[]; intolerancias: string[] }, alergenos: string[], nombre = "LUVIA") {
  return renderToStaticMarkup(
    h(YuxtaposicionAlergenos, { paciente, producto: { alergenos }, nombreProducto: nombre }),
  );
}

// Texto plano, que es lo que el profesional lee: sin etiquetas y con los espacios colapsados, para que
// una asercion de frase no dependa de como quedo partido el marcado.
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("ningún rótulo empieza por una conjunción ni pierde el sujeto", () => {
  const casos: [string, { alergias: string[]; intolerancias: string[] }][] = [
    ["solo alergias", PACIENTE_SOLO_ALERGIAS],
    ["solo intolerancias", PACIENTE_SOLO_INTOLERANCIAS],
    ["las dos", PACIENTE_AMBAS],
  ];

  for (const [nombre, paciente] of casos) {
    it(`${nombre}: cada rótulo nombra de quién es la declaración`, () => {
      const t = texto(pintar(paciente, ["avena"]));

      // Ninguna frase visible arranca por "Y ": era el sintoma exacto del defecto.
      expect(t, "un rótulo empieza por una conjunción: se escribió como continuación de otro").not.toMatch(/(^|\s)Y declaró/);

      // Y cada bloque que se pinta dice a quien pertenece. El defecto no era solo la "Y": era que la
      // columna de intolerancias no decia "del paciente" porque esa palabra vivia en la columna de al lado.
      if (paciente.alergias.length) expect(t).toContain("Alergias declaradas por el paciente");
      if (paciente.intolerancias.length) expect(t).toContain("Intolerancias declaradas por el paciente");
      expect(t).toContain("Alérgenos declarados por LUVIA");
    });

    it(`${nombre}: se ven todos los valores declarados, ninguno se pierde`, () => {
      const t = texto(pintar(paciente, ["avena"]));
      for (const v of [...paciente.alergias, ...paciente.intolerancias]) expect(t).toContain(v);
    });
  }

  it("y el rótulo de intolerancias es el MISMO aparezca sola o acompañada", () => {
    // Es la prueba de que se sostiene solo: si el texto cambiara segun el vecino, volveria a ser una frase
    // repartida, solo que mejor disimulada.
    const sola = texto(pintar(PACIENTE_SOLO_INTOLERANCIAS, ["avena"]));
    const junta = texto(pintar(PACIENTE_AMBAS, ["avena"]));
    expect(sola).toContain("Intolerancias declaradas por el paciente");
    expect(junta).toContain("Intolerancias declaradas por el paciente");
  });
});

describe("el lado del producto aguanta uno, dos o varios alérgenos", () => {
  // Hoy LUVIA declara uno solo, asi que el caso de varios no lo prueba nadie en pantalla. Es justo el que
  // se rompe en silencio el dia que entre un producto con tres.

  it("con UNO, el rótulo en plural sigue leyéndose bien y el valor aparece", () => {
    const t = texto(pintar(PACIENTE_AMBAS, ["avena"]));
    expect(t).toContain("Alérgenos declarados por LUVIA");
    expect(t).toContain("avena");
  });

  it("con VARIOS, salen todos y ninguno se concatena con otro", () => {
    const html = pintar(PACIENTE_AMBAS, ["avena", "soya", "frutos secos"], "PRODUCTO X");
    const t = texto(html);
    expect(t).toContain("Alérgenos declarados por PRODUCTO X");
    for (const a of ["avena", "soya", "frutos secos"]) expect(t).toContain(a);
    // Cada uno en su propia fila: pegados serian una cadena sola y el profesional leeria "avenasoya".
    expect(t).not.toMatch(/avenasoya|soyafrutos/);
    expect(html.match(/<li/g)?.length).toBe(5); // 1 alergia + 1 intolerancia + 3 alérgenos
  });

  it("y el nombre del producto es el que se le pasa, no uno fijo", () => {
    expect(texto(pintar(PACIENTE_AMBAS, ["soya"], "OMEGA COMPLEX"))).toContain(
      "Alérgenos declarados por OMEGA COMPLEX",
    );
  });
});

describe("y lo que ya estaba verificado sigue en pie", () => {
  it("no se pinta nada si falta una de las dos declaraciones", () => {
    expect(pintar({ alergias: [], intolerancias: [] }, ["avena"])).toBe("");
    expect(pintar(PACIENTE_AMBAS, [])).toBe("");
  });

  it("sale con declaraciones que no tienen nada que ver, que es el caso del diseño", () => {
    // Lactosa contra avena: nada en comun, y sale igual. Si solo saliera al coincidir, su presencia seria
    // la clasificacion. Fue el caso del smoke, a proposito.
    expect(texto(pintar(PACIENTE_SOLO_INTOLERANCIAS, ["avena"]))).toContain("Lactosa");
  });

  it("y el cierre pide verificar, sin afirmar que algo se verificó", () => {
    const t = texto(pintar(PACIENTE_AMBAS, ["avena"]));
    expect(t).toContain("Verifica la compatibilidad antes de recomendarlo");
    expect(t).toContain("Atlas no las compara");
    expect(t).not.toMatch(/verificad[oa]|compatible[^s]/i);
  });
});
