import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS CORTES DEL EWGSOP2 SON POR SEXO, Y LA PANTALLA TIENE QUE SABER CUAL  ·  Santiago, 2026-11-08
//
// ═══ EL DEFECTO, EN UNA PACIENTE REAL ═══
//
// *"Tarjeta de sarcopenia en una MUJER: «Bajo: <27 Kgf» y ASMI «Bajo: <7.0» son los cortes masculinos
// del EWGSOP2 (mujer: <16 kg y <5,5). La tabla de composición sí usa 5,5."*
//
// ═══ Y NO ERA DE GILDARDO, ERA NUESTRO, Y NO ESTABA DONDE PARECIA ═══
//
// La tarjeta SIEMPRE calculo bien sus cortes (`sexoM ? 27 : 16`). Lo que mentia era la PROP: la pagina
// de la evaluacion, en la rama CON diagnostico, pasaba `patientIsFemale: false` FIJO. Inocuo para lo
// unico que se miro al escribirlo (las condiciones de la toma, que en esa rama ni se pintan) y falso en
// dos tarjetas clinicas. Por eso la tabla de composicion, que recibe el mismo booleano, tambien mostraba
// los cortes de hombre: era el mismo dato mentido, no dos defectos.
//
// ═══ Y EL BOOLEANO ESCONDIA UN SEGUNDO CASO ═══
//
// `sexoM: boolean` no tiene sitio para "no se sabe": todo lo que no sea femenino cae en masculino. Un
// paciente SIN SEXO REGISTRADO (los hay) veia los cortes de hombre con su veredicto. Ahora la tarjeta
// recibe `"M" | "F" | null` y con `null` NO CLASIFICA: dice que falta el dato y por donde se arregla.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const TARJETA = readFileSync("src/modules/diagnoses/components/sarcopenia-card.tsx", "utf8");
const PAGINA = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"));
const PESTANA = sinComentarios(
  readFileSync("src/modules/evaluations/components/entrada-evaluacion.tsx", "utf8"),
);

describe("los cortes, que son del EWGSOP2 y no nuestros", () => {
  it("fuerza prensil 27 en hombre y 16 en mujer", () => {
    expect(sinComentarios(TARJETA)).toContain("const fuerzaCut = sexoM ? 27 : 16;");
  });

  it("y ASMI 7,0 en hombre y 5,5 en mujer, el mismo par que la tabla de composicion", () => {
    expect(sinComentarios(TARJETA)).toContain('const asmiCut = sexoM ? "7.0" : "5.5";');
    const COMPOSICION = sinComentarios(
      readFileSync("src/modules/diagnoses/data/composition-display.ts", "utf8"),
    );
    expect(COMPOSICION, "la tabla de composicion y la tarjeta se separaron en el corte del ASMI").toContain(
      "v < (sexoM ? 7.0 : 5.5)",
    );
  });
});

describe("y la pantalla NO le miente el sexo a la tarjeta", () => {
  it("la rama CON diagnostico deriva el sexo del snapshot, no lo escribe", () => {
    // Es el defecto exacto: `patientIsFemale: false` fijo. Si vuelve, una mujer ve los cortes de hombre
    // y nada falla.
    expect(PAGINA, "volvio el sexo escrito a mano en la rama con diagnostico").not.toContain(
      "patientIsFemale: false,",
    );
    expect(PAGINA).toContain("patientIsFemale: !sexoM,");
    expect(PAGINA).toContain('const sexoDelPacienteSellado: "M" | "F" = sexoM ? "M" : "F";');
  });

  it("y la rama SIN diagnostico pasa el sexo que leyo, tal cual (puede ser null)", () => {
    expect(PAGINA).toContain("sexoDelPaciente: entrySex,");
  });

  it("la tarjeta recibe el SEXO, no un booleano que no sabe decir «no se sabe»", () => {
    expect(PESTANA).toContain("sexo={sexoDelPaciente}");
    expect(PESTANA, "la tarjeta volvio a recibir un booleano").not.toContain(
      "sexoM={!patientIsFemale}\n          fuerzaPrensil",
    );
  });
});

describe("y sin sexo NO se clasifica", () => {
  it("la tarjeta sale antes de pintar ningun corte", () => {
    const limpia = sinComentarios(TARJETA);
    expect(limpia).toContain("if (sexo == null) {");
    // Y la salida se dice: el dato se registra en la ficha del paciente.
    expect(TARJETA).toContain("Falta el sexo del paciente");
    expect(TARJETA).toContain("ficha del paciente");
    // LA GUARDA VA ANTES DE DERIVAR `sexoM`: si fuera al reves, el `null` ya habria caido del lado de
    // hombre antes de que nadie preguntara.
    expect(limpia.indexOf("if (sexo == null) {")).toBeLessThan(
      limpia.indexOf("const sexoM = sexo === \"M\";"),
    );
  });
});
