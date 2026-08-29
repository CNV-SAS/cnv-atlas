import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildEmissionVersions } from "@/modules/clinical-pipeline/emission-versions";

// CANDADO: si cambian los CLASIFICADORES, tiene que cambiar la versión con que se sellan.
//
// EL HUECO QUE CIERRA, y es de los caros. `emission_versions.classification` existe justo para esto: dice
// con qué juego de clasificadores se emitió un diagnóstico, para poder comparar y reemitir. El 2026-08-28
// se portaron los cortes del IRC por sexo (1,68/2,11 pasa a 1,7/2,1), que MUEVEN DE BANDA a un paciente en
// 1,69, y la etiqueta se quedó en `cXXX-1.0` durante días.
//
// La consecuencia no era cosmética: los diagnósticos de antes y de después del porte se veían "al día" con
// la misma versión, así que la comparación de bandas de su §12b NO PODÍA DISPARARSE NUNCA para ese cambio.
// El mecanismo estaba entero y nadie lo llamó, que es la forma que este proyecto repite: por eso el candado
// va sobre el SITIO DE LLAMADA (el sellado) y no sobre la función.
//
// CÓMO FUNCIONA. Se hashean los cuerpos de los diez clasificadores `cXXX` extraídos POR NOMBRE (no el
// archivo entero: un comentario nuevo no es un cambio de ciencia, y un candado que salta por comentarios
// se aprende a ignorar). Si el hash cambia sin que cambie la etiqueta, esto truena y dice qué hacer.
//
// CUANDO TRUENE, el orden es: (1) mirar si el cambio mueve alguna BANDA; (2) si la mueve, subir la
// etiqueta y anotar por qué; (3) si NO la mueve (un color, un texto), actualizar el hash y dejar escrito
// que no la mueve. Lo que NO se hace es actualizar el hash sin mirar: eso apaga el candado.

const CLASIFICADORES = [
  "cIFC",
  "cIRC",
  "cPABU",
  "cFMI",
  "cFFMI",
  "cISCM",
  "cIEHH",
  "cIAE",
  "cAF",
  "cIR",
] as const;

/** Hash de los cuerpos, extraídos POR NOMBRE del frozen. */
function shaDeLosClasificadores(): string {
  const src = readFileSync("src/clinical-engine/frozen/engine.core.js", "utf8").replace(/\r\n/g, "\n");
  let acc = "";
  for (const n of CLASIFICADORES) {
    const i = src.indexOf(`const ${n} = `);
    if (i < 0) throw new Error(`no aparece el clasificador ${n} en engine.core.js`);
    let prof = 0;
    let fin = -1;
    for (let j = src.indexOf("{", i); j < src.length; j++) {
      const c = src[j];
      if (c === "{") prof++;
      else if (c === "}") {
        prof--;
        if (prof === 0) {
          fin = j + 1;
          break;
        }
      }
    }
    acc += src.slice(i, fin) + "\n";
  }
  return createHash("sha256").update(acc).digest("hex");
}

// SHA de los clasificadores CON los cortes del IRC por sexo ya portados (2026-08-29), que es la ciencia
// que sella `cXXX-2026-08-29`.
const SHA_ESPERADO = "b410d492e57758ce1458e5d78753c2d9ab50012fbcda7828dda2723e60aacb7c";
const ETIQUETA_ESPERADA = "cXXX-2026-08-29";

describe("los clasificadores y su versión de emisión no pueden divergir", () => {
  it("los diez clasificadores siguen existiendo con ese nombre", () => {
    // Si uno se renombra, el hash cambiaría por la razón equivocada y el mensaje del candado confundiría.
    expect(() => shaDeLosClasificadores()).not.toThrow();
  });

  it("si cambió la ciencia de los clasificadores, tiene que haber cambiado la etiqueta", () => {
    expect(
      shaDeLosClasificadores(),
      "Cambiaron los clasificadores cXXX. ¿El cambio mueve alguna BANDA (una etiqueta sellada, no un " +
        "color)? Si la mueve: sube `classification` en emission-versions.ts y anota por qué; los " +
        "diagnósticos anteriores quedarán marcados como emitidos con versión anterior, que es lo correcto " +
        "y es lo que hace que la reemisión del §12b pueda dispararse. Si NO la mueve: actualiza este SHA y " +
        "deja escrito que no la mueve. Lo que no se hace es actualizar el SHA sin mirar.",
    ).toBe(SHA_ESPERADO);
  });

  it("y la etiqueta sellada es la que corresponde a ese SHA", () => {
    // Las dos mitades: el hash dice "esta ciencia" y la etiqueta dice "esta versión". El candado sirve
    // solo si están atadas; si alguien sube la etiqueta sin tocar la ciencia, o al revés, esto lo dice.
    expect(buildEmissionVersions().classification).toBe(ETIQUETA_ESPERADA);
  });

  it("CONTROL: el hash cambia de verdad si se toca un corte", () => {
    // Sin este control, un error en la extracción (una cadena vacía, por ejemplo) daría un hash estable y
    // el candado pasaría verde para siempre sin mirar nada. Es la forma de aserción negativa que ya nos
    // mordió: "no cambió" pasa verde también cuando no se comparó.
    const src = readFileSync("src/clinical-engine/frozen/engine.core.js", "utf8");
    const tocado = src.replace("const lo = f ? 2.3 : 1.7;", "const lo = f ? 2.4 : 1.7;");
    expect(tocado, "no encontré el corte del IRC: revisa este control").not.toBe(src);
    expect(createHash("sha256").update(tocado).digest("hex")).not.toBe(
      createHash("sha256").update(src).digest("hex"),
    );
  });
});
