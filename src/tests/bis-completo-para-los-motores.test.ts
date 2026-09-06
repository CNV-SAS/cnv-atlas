import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

/**
 * TODO CAMPO QUE LOS MOTORES DE TRATAMIENTO LEEN DEL `bis` TIENE QUE LLEGARLES.
 *
 * EL DEFECTO QUE CIERRA (barrido del 2026-09-06, pedido por Santiago tras el punto 29). Los tres lectores
 * de `dieta-resumen-reader` arman el `bis` con `snapshot.indicators`, que trae DOCE claves:
 *
 *     AF IR eb FMI iae ifc irc FFMI iehh iscm pabu icaBis
 *
 * y los motores leen ONCE campos, de los cuales cuatro no estaban en esa lista ni llegaban por ningun
 * otro lado. Ninguno daba error: el motor lee lo que falta como CERO o cae a un default.
 *
 *   · ASMI      -> `sarcopenia = ASMI > 0 && ...` era SIEMPRE falsa. Caia la rama de sarcopenia de
 *                  `motorTratNutri`, su nota de fuerza en la obesidad sarcopenica, y la fila "ASMI bajo,
 *                  sarcopenia" (1,2-1,5 g/kg) del panel de referencia que Gildardo mando construir.
 *   · edad      -> `Number(e.edad || b.edad) || 30`: el gasto basal de TODOS los pacientes se calculaba
 *                  con 30 años. Medido sobre la nube: SEIS de veintiseis tratamientos cambian de
 *                  etiqueta de dieta al pasarle la edad real (cinco de ellos de "Hipercalórica" a
 *                  "Normocalórica", que es lo correcto cuando el objetivo ES el gasto).
 *   · AEC, ACT  -> la rama de hidratacion solo se alcanzaba por IEHH o por la sed declarada.
 *
 * POR QUE ESTE CANDADO SE DERIVA Y NO SE ESCRIBE A MANO: la lista de campos se EXTRAE de los motores
 * congelados. Una entrega nueva suya que lea un campo mas lo pone rojo solo. Un candado con la lista
 * escrita a mano solo sabria de los cuatro de hoy, y este defecto nacio justo de que nadie habia
 * comparado las dos listas.
 */

const MOTORES = [
  "src/clinical-engine/frozen/atlas-tratamiento-nutri.js",
  "src/clinical-engine/frozen/atlas-asesoria-macro.js",
  "src/clinical-engine/frozen/atlas-tratamiento.js",
];
const LECTOR = sinComentarios(readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8"));

/**
 * Como llega cada campo del `bis`. La CLAVE es el campo que el motor lee; el VALOR es un fragmento del
 * lector que tiene que existir para que ese campo llegue, o `null` con la razon de por que no hace falta.
 */
const COMO_LLEGA: Record<string, { fragmento: string | null; razon: string }> = {
  peso: { fragmento: "const peso = Number(bis.peso ?? comp?.peso ?? 0)", razon: "de la composicion" },
  talla: { fragmento: "const talla = Number(bis.talla ?? comp?.talla ?? 0)", razon: "de la composicion" },
  ASMI: { fragmento: "extra.ASMI = asmi", razon: "de la composicion (fila asmi)" },
  AEC: { fragmento: "extra.AEC = aec", razon: "de la composicion (fila ECW)" },
  ACT: { fragmento: "extra.ACT = act", razon: "de la composicion (fila TBW)" },
  edad: { fragmento: "{ sexo, edad }", razon: "del nacimiento del paciente, en el enc" },
  sexo: { fragmento: "{ sexo, edad }", razon: "el enc lo lleva; el motor mira b.sexo || e.sexo" },
  FMI: { fragmento: null, razon: "viene en snapshot.indicators" },
  FFMI: { fragmento: null, razon: "viene en snapshot.indicators" },
  iehh: { fragmento: null, razon: "viene en snapshot.indicators (minuscula; el motor lee las dos)" },
  IEHH: { fragmento: null, razon: "el motor lee b.iehh || b.IEHH, y iehh si llega" },
  pesoMeta: { fragmento: null, razon: "viaja como edit.peso_meta, que MANDA sobre b.pesoMeta" },
  tallaCm: { fragmento: null, razon: "el motor lee b.talla || b.tallaCm, y talla si llega" },
};

// SIN \b NI \. A PROPOSITO: la clase de caracteres de delante hace de frontera de palabra y [.] de
// punto literal. Es la misma regla escrita sin barras invertidas, y evita que el patron se rompa al pasar
// por una capa que se las coma. Este candado ya se puso rojo una vez por eso: encontro CERO campos, y lo
// dijo su control y no la regla. Un candado rojo por el PARSEO es ruido, y el ruido es como mueren.
const LEE_DEL_BIS = /(^|[^A-Za-z_0-9.])b[.]([A-Za-z_][A-Za-z_0-9]*)/g;

function camposQueLeeElMotor(archivo: string): string[] {
  const src = readFileSync(archivo, "utf8");
  return [...new Set([...src.matchAll(LEE_DEL_BIS)].map((m) => m[2]))];
}

describe("los motores de tratamiento reciben todo el bis que leen", () => {
  const campos = [...new Set(MOTORES.flatMap(camposQueLeeElMotor))].sort();

  it("el control: la extraccion encuentra campos de verdad", () => {
    // Sin esto, un regex que dejara de casar volveria verde el candado sin mirar nada.
    expect(campos.length).toBeGreaterThanOrEqual(11);
    expect(campos).toContain("ASMI");
    expect(campos).toContain("edad");
  });

  it("cada campo esta contabilizado, o llega o se dice por que no hace falta", () => {
    const sinContabilizar = campos.filter((c) => !(c in COMO_LLEGA));
    expect(
      sinContabilizar,
      `campos nuevos en los motores congelados que nadie contabilizo: ${sinContabilizar.join(", ")}`,
    ).toEqual([]);
  });

  it("y el que llega por el lector, llega de verdad", () => {
    for (const campo of campos) {
      const c = COMO_LLEGA[campo];
      if (!c?.fragmento) continue;
      expect(LECTOR, `${campo} (${c.razon}) ya no llega al motor`).toContain(c.fragmento);
    }
  });
});
