import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  declaracionesDesdeRespuesta,
  hayQueYuxtaponer,
} from "@/modules/nutraceuticals/yuxtaposicion-alergenos";

// ═══ LAS DOS DECLARACIONES SE PONEN JUNTAS, Y NUNCA SE COMPARAN (2026-09-11) ═══
//
// Lo que este candado protege no es una función: es una FRONTERA. La diferencia entre lo que se construyó
// y lo que está prohibido son tres líneas de código, y las tres son tentadoras:
//
//   · filtrar la lista del producto por lo que coincide  → sería un cruce
//   · pintar distinto lo que coincide                     → sería una clasificación
//   · mostrar el bloque SOLO cuando algo coincide         → sería una clasificación por presencia,
//                                                           la más difícil de ver de las tres
//
// Las tres son inferencia clínica, y un Atlas que infiere clínicamente contradice el Anexo 3 y el
// consentimiento que los pacientes YA FIRMARON, donde dice que Atlas no diagnostica. Por eso el candado
// no mira solo el resultado: BARRE EL CODIGO buscando la comparación, que es la forma que tomaría el
// defecto si alguien "mejora" esto sin leer la historia.

const MODULO = "src/modules/nutraceuticals/yuxtaposicion-alergenos.ts";
const COMPONENTE = "src/modules/nutraceuticals/components/yuxtaposicion-alergenos.tsx";

describe("la aparición NO depende de que haya coincidencia", () => {
  it("sale con declaraciones que no tienen NADA que ver entre sí", () => {
    // Este es EL caso del diseño, no un caso borde: si solo saliera al coincidir, el profesional
    // aprendería que la presencia del bloque significa problema, y esa es la pantalla que aprende a
    // creerle. Alergia a mariscos, producto con avena: nada que ver, y sale igual.
    expect(
      hayQueYuxtaponer({ alergias: ["Mariscos"], intolerancias: [] }, { alergenos: ["avena"] }),
    ).toBe(true);
  });

  it("y sale igual cuando coinciden, sin ninguna diferencia", () => {
    expect(
      hayQueYuxtaponer({ alergias: [], intolerancias: ["Gluten (trigo, pan, pasta)"] }, { alergenos: ["avena"] }),
    ).toBe(true);
  });

  it("no sale si el paciente no declaró nada", () => {
    expect(hayQueYuxtaponer({ alergias: [], intolerancias: [] }, { alergenos: ["avena"] })).toBe(false);
  });

  it("no sale si el producto no declara nada", () => {
    // Es el texto literal del asesor: hacen falta las DOS declaraciones. Que no salga dice algo del
    // producto (no declara alérgenos), no algo sobre la compatibilidad.
    expect(hayQueYuxtaponer({ alergias: ["Maní"], intolerancias: [] }, { alergenos: [] })).toBe(false);
  });
});

describe("lo que el paciente declaró se lee tal como lo escribió", () => {
  it("una respuesta de opción múltiple llega como lista", () => {
    expect(declaracionesDesdeRespuesta('["Maní","Mariscos"]')).toEqual(["Maní", "Mariscos"]);
  });

  it("el texto libre de «Otra» CONSERVA su prefijo", () => {
    // Es el caso que importa y el que un filtro nunca vería: el alérgeno que no está en la lista cerrada.
    // El prefijo se queda porque dice algo verdadero, que lo escribió el paciente y no lo eligió de un
    // menú. Gildardo, 2026-09-11 §3: "es un dato que el paciente dio. Se muestra lo que escribió."
    expect(declaracionesDesdeRespuesta('["Otra: kiwi"]')).toEqual(["Otra: kiwi"]);
  });

  it('"Ninguna" NO es una declaración: es la ausencia de una', () => {
    // Dejarla pasar llenaría la pantalla de bloques que dicen "este paciente declaró: Ninguna", que es
    // ruido con forma de advertencia.
    expect(declaracionesDesdeRespuesta('["Ninguna"]')).toEqual([]);
    expect(declaracionesDesdeRespuesta("Ninguna")).toEqual([]);
    expect(hayQueYuxtaponer({ alergias: declaracionesDesdeRespuesta('["Ninguna"]'), intolerancias: [] }, { alergenos: ["avena"] })).toBe(false);
  });

  it("un JSON roto se trata como el texto plano que es, sin perder el dato", () => {
    // Este valor viajó por el intake público. Perderlo en silencio sería peor que mostrarlo raro.
    expect(declaracionesDesdeRespuesta('["Maní"')).toEqual(['["Maní"']);
  });

  it("y una respuesta vacía o ausente no declara nada", () => {
    expect(declaracionesDesdeRespuesta(null)).toEqual([]);
    expect(declaracionesDesdeRespuesta("   ")).toEqual([]);
  });
});

describe("NADIE compara las dos listas, y se verifica sobre el código", () => {
  // Un test de comportamiento no puede ver esto: comparar y no usar el resultado pasaría verde. Lo que
  // hay que impedir es que la comparación EXISTA, porque en cuanto exista alguien la usará.

  it("la ÚNICA función que ve las dos declaraciones no las compara", () => {
    // El barrido va sobre `hayQueYuxtaponer` y no sobre el módulo entero, y la distinción importa:
    // `declaracionesDesdeRespuesta` sí filtra, pero filtra UNA lista contra una constante ("Ninguna"),
    // que no es cruzar nada. Lo prohibido es que las DOS listas se toquen, y eso solo puede pasar donde
    // las dos están a la vista.
    const src = readFileSync(MODULO, "utf8");
    const desde = src.indexOf("export function hayQueYuxtaponer");
    expect(desde).toBeGreaterThan(0);
    const cuerpo = src.slice(desde);
    for (const cruce of [".includes(", ".some(", ".filter(", ".find(", ".indexOf(", ".match("]) {
      expect(
        cuerpo.includes(cruce),
        `\`${cruce}\` dentro de hayQueYuxtaponer: si compara las dos listas, esto dejó de ser una yuxtaposición y pasó a ser una inferencia clínica`,
      ).toBe(false);
    }
  });

  it("y ninguna OTRA función del módulo recibe las dos a la vez", () => {
    // Es la puerta de al lado: no hace falta tocar `hayQueYuxtaponer` para colar un cruce, basta añadir
    // un `coincidencias(paciente, producto)` al lado. Si aparece una segunda función que ve las dos
    // declaraciones, este candado la saca a la luz aunque sea inocente.
    const src = readFileSync(MODULO, "utf8");
    const firmas = src
      .split("\n")
      .filter((l) => l.startsWith("export function"))
      .map((l) => l.replace("export function ", "").split("(")[0]);
    expect(firmas.sort()).toEqual(["declaracionesDesdeRespuesta", "hayQueYuxtaponer"]);
  });

  it("y el componente pinta los dos lados igual: sin resaltar lo que coincide", () => {
    const src = readFileSync(COMPONENTE, "utf8");
    const cuerpo = src.slice(src.indexOf("export function YuxtaposicionAlergenos"));
    expect(
      /includes|some\(|indexOf|coincid/i.test(cuerpo),
      "el componente compara o resalta coincidencias: pintar distinto lo que coincide es clasificar",
    ).toBe(false);
    // Sin color de severidad: un tinte de alerta ES una clasificación, aunque no compare nada.
    expect(src).not.toMatch(/clinical-(critical|warning)/);
  });

  it("la lista del producto se muestra COMPLETA: nada la filtra", () => {
    // Del asesor legal, y es la parte fina: así el profesional ve ingredientes que un filtro nunca le
    // habría mostrado. El componente recibe `producto.alergenos` y lo pinta entero.
    const src = readFileSync(COMPONENTE, "utf8");
    expect(src).toContain("items={producto.alergenos}");
  });

  it("y el cierre PIDE verificar, no informa de que se verificó", () => {
    // Gildardo, textual: "la pantalla no dice que nada fue verificado contra las alergias, porque no lo
    // será". La diferencia entre "verifica" y "verificado" es la diferencia entre pedir y afirmar.
    // Se mira SOLO lo que se PINTA, no el archivo: el encabezado cita la frase de Gildardo ("no dice que
    // nada fue verificado") para explicar la regla, y un candado sobre el archivo entero confundiría la
    // explicación con la pantalla. Tercera vez que esta distinción hace falta.
    const src = readFileSync(COMPONENTE, "utf8");
    const pintado = src.slice(src.indexOf("export function YuxtaposicionAlergenos"));
    expect(pintado).toContain("Verifica la compatibilidad");
    expect(pintado).toContain("Atlas no las compara");
    expect(
      pintado,
      "la pantalla afirma que algo se verificó, y nada se verifica",
    ).not.toMatch(/verificad[oa]|comprobad[oa]|sin conflictos?|compatible[^s]/i);
  });
});

describe("y no queda bloqueo en ninguna capa", () => {
  it("la sección de tratamiento muestra el bloque sin condicionar nada", () => {
    // Ni `disabled`, ni confirmación, ni registro de override. El asesor lo retiró él mismo: "Atlas no
    // bloquea ni condiciona la recomendación."
    const src = readFileSync("src/modules/treatment/components/nutraceuticals-section.tsx", "utf8");
    expect(src).toContain("<YuxtaposicionAlergenos");
    const cerca = src.slice(src.indexOf("<YuxtaposicionAlergenos"));
    expect(
      /disabled|confirm|bloque[ao]/i.test(cerca.slice(0, 600)),
      "apareció algo que condiciona la recomendación junto a la yuxtaposición",
    ).toBe(false);
  });

  it("y la tabla de equivalencias ya no existe en el esquema", () => {
    const schema = readFileSync("src/db/schema/reparto.ts", "utf8");
    expect(schema).not.toContain("allergenRelations = pgTable");
    // Y el retiro queda contado, no solo hecho: una ausencia sin documento se rehace.
    expect(schema).toContain("se retiro con su tabla en la 0127");
  });
});
