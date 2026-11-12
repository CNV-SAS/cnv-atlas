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

// SHA de los clasificadores con los cortes del IRC por sexo (2026-08-29) y con `cIAE` re-portado de su
// v16 (2026-11-07), que es la ciencia que sella `cXXX-2026-11-07`.
//
// POR QUE SUBIO LA ETIQUETA Y NO SOLO EL SHA, que es la pregunta que este candado obliga a contestar: el
// cambio de `cIAE` SI MUEVE UNA BANDA SELLADA. Sus dos bordes pasan a cerrados hacia el extremo (de
// `v < -5` y `v <= 5` a `v <= -5` y `v < 5`), asi que un IAE de +5,0 exacto pasa de "Concordante" a
// "Acelerado" y uno de -5,0 de "Concordante" a "Desacelerado". Medido sobre la nube el 2026-11-07: cuatro
// consultas reales caen en esos bordes. El detalle, en `emission-versions.ts` y en
// `el-borde-de-los-cinco-dice-lo-mismo.test.ts`.
//
// (El `t` nuevo de cada banda, que viene con su bloque, es TEXTO y no mueve ninguna etiqueta por si solo.
// La etiqueta sube por los cortes, no por el.)
// SHA ACTUALIZADO (2026-11-11) CON SUBIDA DE ETIQUETA: paso 2 del porte de la v17 (su §3 y §4). Las tres
// etiquetas que se mueven estan escritas en `emission-versions.ts`, al lado de la clave que subio: el IFC
// en las ventanas de 0,02 de sus cortes nuevos, el IFC del paciente sin sexo, y la del PABU para TODOS
// (la zona fija de ±0,15 pasa a los percentiles de su Tabla 7.3). O sea que SI mueve bandas, y por eso la
// etiqueta sube en el mismo acto que este SHA.
// SHA ACTUALIZADO (2026-11-12) CON SUBIDA DE ETIQUETA: pasos 3, 4 y 5 del porte de la v17. Es el cambio
// mas grande que han tenido estos clasificadores desde el porte inicial, y la lista de etiquetas que se
// mueven esta en `emission-versions.ts`, al lado de la clave que subio. En dos palabras: los cuatro
// niveles del ISCM-BIS se retiran (cambia la etiqueta de TODOS), los cuatro grados del IEHH pasan a tres
// zonas Y su valor se recalcula con z por sexo (tambien para todos), y el sector de la Diana se
// clasifica con los cortes MCCB (279 de 441 consultas en la nube).
//
// EL VALOR SE TOMA DEL QUE REPORTA ESTE MISMO CANDADO, y la razon quedo escrita en septiembre: el hash
// se calcula sobre el texto de las funciones con los finales de linea normalizados, asi que calcularlo
// por fuera da otro numero si se olvida esa normalizacion. Ya paso una vez.
// SHA ACTUALIZADO (2026-11-12b) SIN SUBIR LA ETIQUETA, y aqui la respuesta a la pregunta de este
// candado es NO: el paso 6 pasa `cFMI`, `cSMM`, `cMMEM` y `cASMI` por `sexoBIS` (su §11), y eso NO
// mueve ninguna etiqueta sellada en Atlas. La razon esta medida: la cadena normaliza el sexo con
// `normalizeSexo` antes de llamarlos, y en la base solo hay "M", "F" y dos nulos, asi que ninguno de
// los cuatro recibio nunca un "Masculino" ni un "Femenino". Era un hazard LATENTE. Si algun dia una
// pantalla los llamara con la forma larga, la etiqueta se habria movido sin que nadie subiera nada:
// por eso el arreglo entra, y por eso la etiqueta no sube.
//
// La etiqueta vigente (cXXX-2026-11-12) ya cubre los pasos 3, 4 y 5, que SI mueven etiquetas.
const SHA_ESPERADO = "cb8cf284a77e2a2e165ff28a716931cf82102b58a98e2dbfac9c793963cc94a6";
const ETIQUETA_ESPERADA = "cXXX-2026-11-12";

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
