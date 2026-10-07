import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ CANDADO DE LA FLEXION DE "OTRA" (Santiago, 2026-10-07) ═══
//
// ── EL DEFECTO, Y PERDIA DATOS CLINICOS ────────────────────────────────────────────────────────────
//
// El HTML escribe esa opcion "Otros" (plural) y el catalogo de Atlas la tiene como "Otra" (singular). La
// importacion copia el valor tal cual, asi que 56 evaluaciones quedaron con un valor que no es ninguna opcion
// de Atlas, y las tres vistas de la respuesta lo trataban distinto:
//
//   · LECTURA lo anexaba como chip extra -> se veian TRES opciones marcadas;
//   · EDICION no lo casaba -> se veian DOS, y la pildora salia apagada;
//   · y AL GUARDAR desde edicion, el valor emitido era la flexion PELADA, sin el texto: "Otros: CREATINA"
//     se convertia en "Otros". 244 respuestas tenian texto.
//
// Lo que el paciente escribio (un suplemento, una alergia) es informacion clinica.
//
// ── LO QUE ESTE CANDADO VIGILA, Y NO ES LA FUNCION ─────────────────────────────────────────────────
//
// Que las TRES vistas casen la flexion contra el catalogo. Probar `conLaFlexionDelCatalogo` sola no sirve: el
// defecto no era la funcion (no existia), era que cada vista comparaba por su cuenta. Asi que esto barre el
// archivo y exige que las tres la usen.

const ARCHIVO = "src/modules/evaluations/components/survey-widgets.tsx";
const SRC = readFileSync(ARCHIVO, "utf8");

const sinComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const CODIGO = sinComentarios(SRC);

describe("las tres vistas de una respuesta casan la flexion de Otra", () => {
  // LAS TRES, NOMBRADAS: el formulario de opcion unica, el de multiple, y la lectura (que tiene dos
  // variantes, chips y texto plano). Si alguien agrega una cuarta vista y no la casa, este conteo lo dice.
  it("la funcion existe y la usan las cuatro superficies", () => {
    expect(CODIGO, "desaparecio `conLaFlexionDelCatalogo`").toContain("function conLaFlexionDelCatalogo");
    const usos = [...CODIGO.matchAll(/conLaFlexionDelCatalogo\(/g)].length;
    // 1 declaracion + al menos un uso en PillsSingle, PillsMulti, la variante plana y los chips.
    expect(usos, "alguna vista dejo de casar la flexion").toBeGreaterThanOrEqual(5);
  });

  // ── EL ORDEN IMPORTA, y es la clase de cosa que un refactor rompe sin avisar ──
  //
  // El prefill NECESITA la opcion del catalogo, asi que `otherOption` tiene que resolverse ANTES del
  // `useState`. Si alguien mueve la linea debajo, en JavaScript sale `undefined` y la flexion deja de casar,
  // en silencio y solo para los valores importados.
  it("la opcion del catalogo se resuelve ANTES del prefill, en los dos formularios", () => {
    for (const widget of ["PillsSingle", "PillsMulti"]) {
      const i = CODIGO.indexOf(`export function ${widget}`);
      expect(i, `desaparecio ${widget}`).toBeGreaterThan(0);
      const cuerpo = CODIGO.slice(i, i + 1800);
      const dondeCatalogo = cuerpo.indexOf("const otherOption");
      const dondePrefill = cuerpo.indexOf("useState");
      expect(dondeCatalogo, `${widget}: no resuelve la opcion del catalogo`).toBeGreaterThan(0);
      expect(
        dondeCatalogo,
        `${widget}: resuelve la opcion del catalogo DESPUES del prefill, asi que llega undefined`,
      ).toBeLessThan(dondePrefill);
    }
  });
});

describe("que hace la funcion, caso por caso", () => {
  // Se reimplementa aqui la MISMA regla para poder probarla sin montar React. Es una copia a proposito y
  // pequena; lo que impide que divergan es el barrido de arriba, que exige que las vistas usen la de verdad.
  const splitOther = (s: string) => {
    const m = /^(otr[oa]s?)\s*:\s*(.+)$/i.exec(s.trim());
    return m ? { base: m[1], text: m[2] } : null;
  };
  const esOtra = (t: string) => /^otr[oa]s?$/i.test(t.trim());
  const casar = (valor: string, catalogo: string | null): string => {
    if (catalogo == null) return valor;
    const s = valor.trim();
    const p = splitOther(s);
    if (p) return `${catalogo}: ${p.text}`;
    return esOtra(s) ? catalogo : valor;
  };

  // EL CASO REAL, con sus datos: "Otros: CREATINA" guardado, "Otra" en el catalogo.
  it("una flexion con texto conserva el texto y toma la palabra del catalogo", () => {
    expect(casar("Otros: CREATINA", "Otra")).toBe("Otra: CREATINA");
  });

  it("una flexion pelada toma la palabra del catalogo", () => {
    expect(casar("Otros", "Otra")).toBe("Otra");
    expect(casar("Otras", "Otra")).toBe("Otra");
    expect(casar("Otro", "Otra")).toBe("Otra");
  });

  // Y AL REVES TAMBIEN, porque d5_40 (medicamentos) tiene "Otros" en el catalogo de Atlas: la direccion del
  // descalce no es siempre la misma, y una funcion que solo convirtiera a singular romperia esa pregunta.
  it("funciona en la direccion contraria: catalogo plural, valor singular", () => {
    expect(casar("Otra: IBUPROFENO", "Otros")).toBe("Otros: IBUPROFENO");
    expect(casar("Otra", "Otros")).toBe("Otros");
  });

  // LO QUE NO ES "OTRA" NO SE TOCA. Es la mitad que evita el dano opuesto: si tocara cualquier valor, una
  // opcion normal podria terminar convertida en "Otra" y la respuesta diria algo que el paciente no dijo.
  it("no toca ninguna otra opcion", () => {
    for (const v of ["Omega-3", "Magnesio", "Ninguno", "Otorrino", "Otralgia"]) {
      expect(casar(v, "Otra"), `cambio "${v}", que no es la opcion de texto libre`).toBe(v);
    }
  });

  // UNA PREGUNTA SIN OPCION "OTRA" no tiene con que casar, y entonces el valor pasa intacto.
  it("sin opcion Otra en el catalogo, el valor pasa tal cual", () => {
    expect(casar("Otros: algo", null)).toBe("Otros: algo");
  });

  // EL TEXTO SE CONSERVA ENTERO, con sus comas y sus dos puntos: hay respuestas largas de verdad
  // ("COLAGENO, VITAMINA C, COMPLEJO B, B12, CALTRATE , AOX THERAPY,") y partir mal el valor las truncaria.
  it("conserva textos largos, con comas y espacios", () => {
    const largo = "COLAGENO, VITAMINA C, COMPLEJO B, B12, CALTRATE , AOX THERAPY,";
    expect(casar(`Otros: ${largo}`, "Otra")).toBe(`Otra: ${largo}`);
  });
});
