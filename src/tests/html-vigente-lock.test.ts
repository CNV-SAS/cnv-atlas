import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ENTREGAS, HTML_VIGENTE } from "./fixtures/html-vigente";

const CONGELADOS = new Set([
  "celular-badges.test.ts",
  "frozen-derivar-composicion-diff.test.ts",
  "frozen-dfi-calcle8-diff.test.ts",
  "frozen-dfi-ffmilow-diff.test.ts",
  "frozen-fenotipo-diff.test.ts",
  "frozen-patron-diff.test.ts",
  "frozen-protocolo-chain-diff.test.ts",
  // `frozen-protocolo-diff` salio de esta lista el 2026-09-04: dejo de anclar por ruta literal al
  // re-anclarse por NOMBRE a la entrega vigente. La lista se achica sola cuando un candado deja de
  // necesitar la excepcion, que es lo que la mantiene honesta.
  // No ancla nada: CITA la entrega vigente para verificar que el texto salio de su archivo.
  "salvaguarda-tca-mensaje.test.ts",
]);

// CANDADO SOBRE EL SITIO DE LLAMADA, no sobre la funcion, porque el defecto es una OMISION: nadie
// "llamo mal" a nada, simplemente se dejo una ruta escrita a mano apuntando a la entrega anterior. Un
// candado sobre `HTML_VIGENTE` habria pasado verde mientras los tests seguian sin usarla.
//
// Lo que atrapa: que un test de paridad vuelva a anclar a un ATLAS_v8.html por ruta literal.

describe("la fuente vigente de Gildardo se deriva, y nadie la escribe a mano", () => {
  it("HTML_VIGENTE apunta a la ULTIMA entrega y el archivo existe", () => {
    expect(ENTREGAS.length).toBeGreaterThan(1);
    expect(HTML_VIGENTE).toContain(ENTREGAS[ENTREGAS.length - 1]);
    expect(existsSync(HTML_VIGENTE)).toBe(true);
  });
});

/** Todo archivo de `src/tests`, recursivo, en ruta relativa a esa carpeta. */
function archivosDeTests(dir = "src/tests", base = ""): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...archivosDeTests(`${dir}/${d.name}`, rel));
    else if (/\.(ts|tsx|mjs|js)$/.test(d.name)) out.push(rel);
  }
  return out;
}

describe("alcance del barrido de anclajes", () => {
  it("cubre los fixtures y los helpers, no solo los .test.ts del primer nivel", () => {
    // CONTROL del alcance, que es lo que fallo las dos veces que este candado se creyo completo. Sin
    // esto, alguien puede volver a estrechar el barrido y el verde no cambiaria.
    const todos = archivosDeTests();
    expect(todos).toContain("fixtures/html-vigente.ts");
    expect(todos.some((f) => f.endsWith(".mjs"))).toBe(true);
    expect(todos.length).toBeGreaterThan(220);
  });
});

describe("anclajes a una entrega de Gildardo", () => {
  it("ningún test ancla a una entrega por ruta literal fuera de la lista de congelados", () => {
    // CORRECCION DE MI PROPIO CANDADO (2026-08-29). La primera version solo buscaba el patron
    // "html actualizado <dia> <mes>", que es UNA de las dos convenciones de carpeta que hay en
    // `docs/entregas`. La otra ("gildardo-2026-07-30") pasaba entera: CUATRO tests anclados por ruta
    // literal quedaban fuera de vigilancia y el candado se creia completo. Es la misma forma del defecto
    // que este archivo cierra, cometida aqui: una garantia que no cubre lo que dice cubrir. Ahora busca
    // cualquier ruta literal a `docs/entregas`.
    //
    // CONGELADOS: anclan a una entrega CONGELADA a proposito. No son "el archivo vigente", son la foto
    // contra la que se porto un trozo. Que sean legitimos NO los exime de deriva: por eso existe ademas
    // `frozen-deriva-vigente.test.ts`, que compara todo el frozen contra la entrega de hoy. Los dos hacen
    // falta: aquel prueba que el porte fue fiel a su entrega, este que esa entrega sigue siendo la de hoy.

    // SEGUNDA CORRECCION DE ALCANCE (2026-09-02), y salio de barrer los filtros de ruido de los demas
    // candados despues de encontrar uno que ignoraba por LONGITUD. Este ignoraba por CARPETA y por
    // EXTENSION: miraba `src/tests/*.test.ts` al primer nivel, asi que un anclaje escrito en un fixture
    // (`src/tests/fixtures/*.ts`) o en un helper `.mjs` era invisible, mientras el mensaje del candado
    // decia "ningun test ancla". Hoy no escondia ninguno; el punto es que no podia saberlo.
    // Medido antes de aplicarlo: +24 archivos, 1 rojo, que es la EXENCION de abajo.
    const sueltos: string[] = [];
    for (const f of archivosDeTests()) {
      // `fixtures/html-vigente.ts` es la FUENTE de la que sale la ruta derivada: es el unico sitio donde
      // la carpeta se escribe, y por eso existe. Exento por la misma razon que este archivo.
      if (CONGELADOS.has(f) || f === "html-vigente-lock.test.ts" || f === "fixtures/html-vigente.ts") {
        continue;
      }
      const src = readFileSync(`src/tests/${f}`, "utf8");
      // Solo lineas de CODIGO: un comentario que nombre el archivo es documentacion, no un anclaje.
      const codigo = src
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      // Una ruta DERIVADA no es un anclaje: `${ENTREGAS[...]}` sigue a la carpeta y se mueve con ella. Lo
      // que se persigue es la ruta ESCRITA A MANO, que es la que envejece. Lo aprendí comiteando este
      // mismo candado en rojo: marcó al candado de deriva, que construye su ruta desde ENTREGAS.
      const derivada = /docs\/entregas\/[^"'`]*\$\{\s*ENTREGAS/;
      const literales = codigo
        .split("\n")
        .filter((l) => /docs\/entregas\//.test(l) && !derivada.test(l));
      if (literales.length > 0) sueltos.push(f);
    }
    expect(
      sueltos,
      `estos tests anclan a una entrega por ruta literal; usa HTML_VIGENTE de fixtures/html-vigente, o ` +
        `agrégalos a CONGELADOS con su razón: ${sueltos.join(", ")}`,
    ).toEqual([]);
  });

  it("la lista de CONGELADOS no tiene sobrantes: todos existen y todos anclan de verdad", () => {
    // Una excepcion que ya no corresponde es un agujero abierto sin que nadie lo note: el dia que ese
    // test se re-ancle bien, la excepcion sigue tapando al siguiente que se escriba con ese nombre.
    for (const f of CONGELADOS) {
      expect(existsSync(`src/tests/${f}`), `${f} está en CONGELADOS y no existe`).toBe(true);
      const src = readFileSync(`src/tests/${f}`, "utf8");
      expect(
        /docs\/entregas\//.test(src),
        `${f} ya no ancla a ninguna entrega: sácalo de CONGELADOS`,
      ).toBe(true);
    }
  });

  it("los tests CONGELADOS declaran contra qué entrega están anclados", () => {
    // Un ancla congelada es legitima, pero tiene que decir a que se congelo y por que. Si no lo dice,
    // dentro de un mes nadie sabe si es deliberada o si es la de esta vez: una que se quedo atras.
    for (const f of [
      "frozen-derivar-composicion-diff.test.ts",
      "frozen-dfi-ffmilow-diff.test.ts",
      "frozen-patron-diff.test.ts",
      "frozen-protocolo-diff.test.ts",
    ]) {
      const src = readFileSync(`src/tests/${f}`, "utf8");
      expect(/VIGENTE|FUENTE/.test(src), `${f} no declara su ancla`).toBe(true);
    }
  });
});
