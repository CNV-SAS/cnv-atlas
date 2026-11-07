import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { patronParaLaIa } from "@/clinical-engine/patron-para-la-ia";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE LA IA RECIBE DEL PATRON USUAL  ·  v16 §4.5, 2026-11-07
//
// ═══ EL DEFECTO, EN SUS PALABRAS ═══
//
// *"El texto que se envía para el diagnóstico integral listaba las 15 frecuencias sin categorías, y la IA
// podía describir la carne roja como protectora."*
//
// Ahi esta el problema entero: "Carnes rojas: nunca" es un dato CIERTO, y un modelo que lo lee junto a
// catorce frecuencias mas y sin ninguna categoria concluye lo razonable, que aqui es lo equivocado. Una
// frecuencia baja en un grupo de riesgo es una frecuencia ACEPTABLE, no un factor protector.
//
// ═══ POR QUE HACEN FALTA LAS DOS MITADES ═══
//
// El DATO resuelto (este modulo) y la REGLA en el texto de sistema (la v15). Con solo la regla, el modelo
// tendria que clasificar el solo y a veces acertaria; con solo el dato, seguiria pudiendo interpretar una
// frecuencia baja como un acierto. Es el mismo par que ya se uso cinco veces con este prompt.
//
// Y LA CLASIFICACION NO SE CALCULA AQUI: sale de `d1Clasificar`, la MISMA que pinta la vista D1 del
// profesional. Dos fuentes de la misma clasificacion es lo que su §4.1 vino a cerrar.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Las opciones canonicas de frecuencia, tal como Atlas las guarda. */
const NUNCA = "Nunca";
const UNO_A_DOS = "1–2 días";
const TRES_A_CUATRO = "3–4 días";
const CINCO_A_SEIS = "5–6 días";
const DIARIO = "Todos los días";

/** Los protectores (1 a 7) en una frecuencia, para tener una base con patron respondido. */
function base(freq: string): Record<string, string> {
  const enc: Record<string, string> = {};
  for (let n = 1; n <= 7; n += 1) enc[`d1_${n}_i`] = freq;
  return enc;
}

describe("el bloque del patron que viaja al modelo", () => {
  it("lleva la frase del patron, verbatim del motor", () => {
    const r = patronParaLaIa({ ...base(CINCO_A_SEIS), d1_12_i: TRES_A_CUATRO });
    expect(r?.frase).toContain("Al evaluar el patrón usual de consumo de alimentos");
    expect(r?.frase).toContain("un patrón de riesgo");
  });

  it("y la CATEGORIA de cada grupo respondido, con su frecuencia en palabras", () => {
    const r = patronParaLaIa({ d1_1_i: CINCO_A_SEIS, d1_12_i: UNO_A_DOS, d1_15_i: TRES_A_CUATRO });
    expect(r?.porGrupo).toEqual([
      "Verduras y hortalizas: 5 a 6 días por semana — categoría: Protector",
      "Carnes rojas: 3 a 4 días por semana — categoría: Limitar",
      "Carnes procesadas y embutidos: 1 a 2 días por semana — categoría: Riesgo",
    ]);
  });

  it("LAS CARNES ROJAS LLEVAN 'LIMITAR' AUNQUE SU FRECUENCIA SEA NUNCA, que es el caso del defecto", () => {
    // Es exactamente el ejemplo de su documento: con la frecuencia mas baja posible, el grupo sigue sin
    // ser protector. La categoria no depende de la frecuencia.
    const r = patronParaLaIa({ ...base(CINCO_A_SEIS), d1_15_i: NUNCA });
    const linea = r?.porGrupo.find((l) => l.startsWith("Carnes rojas"));
    expect(linea).toBe("Carnes rojas: nunca — categoría: Limitar");
    expect(linea, "la carne roja apareceria como protectora").not.toContain("Protector");
  });

  it("y las procesadas llevan 'Riesgo' con cualquier frecuencia, incluida nunca", () => {
    const r = patronParaLaIa({ ...base(CINCO_A_SEIS), d1_12_i: NUNCA });
    expect(r?.porGrupo.find((l) => l.startsWith("Carnes procesadas"))).toBe(
      "Carnes procesadas y embutidos: nunca — categoría: Riesgo",
    );
  });

  it("un grupo sin responder NO aparece: no se le inventa una frecuencia", () => {
    const r = patronParaLaIa({ d1_1_i: DIARIO });
    expect(r?.porGrupo).toHaveLength(1);
    expect(r?.porGrupo[0]).toContain("Verduras y hortalizas");
  });

  it("y sin NINGUNA frecuencia respondida el bloque NO viaja", () => {
    // Un apartado con titulo y sin filas le dice al modelo que mire algo que no esta, y de ahi salen las
    // frases sobre un patron que nadie respondio.
    expect(patronParaLaIa({})).toBeNull();
    expect(patronParaLaIa({ d1_1_i: "" })).toBeNull();
    // Y una respuesta que no es ninguna opcion canonica tampoco cuenta como respondida.
    expect(patronParaLaIa({ d1_1_i: "a veces" })).toBeNull();
  });
});

describe("y las dos mitades estan conectadas", () => {
  const BUILDER = sinComentarios(
    readFileSync("src/modules/diagnoses/ai/prompts/criterion.v2.ts", "utf8"),
  );
  const LECTOR = sinComentarios(
    readFileSync("src/modules/diagnoses/data/criterion-input-reader.ts", "utf8"),
  );
  const SISTEMA = JSON.parse(
    readFileSync("src/modules/diagnoses/ai/prompts/criterion.system.v15.json", "utf8"),
  ).system as string;

  it("el lector arma el bloque y el builder lo emite", () => {
    expect(LECTOR).toContain("patronD1: patronParaLaIa(");
    expect(BUILDER).toContain("PATRÓN USUAL DE CONSUMO, YA CLASIFICADO");
    expect(BUILDER).toContain("input.patronD1.frase");
    expect(BUILDER).toContain("...input.patronD1.porGrupo");
  });

  it("y las 15 frecuencias crudas SIGUEN viajando: son el insumo del LE8 y del dominio 2", () => {
    // El bloque nuevo AÑADE la lectura; no sustituye el dato. Quitarlas dejaria al modelo sin el insumo
    // de dos dominios, que es un defecto mayor que el que se vino a arreglar.
    expect(BUILDER).toContain('"d1_15_i"');
    expect(BUILDER).toContain("FRECUENCIA DE CONSUMO POR GRUPOS");
  });

  it("el texto de sistema v15 prohibe llamar protectora a la carne, en los DOS sentidos", () => {
    expect(SISTEMA).toContain("NUNCA describas las carnes rojas ni las carnes procesadas como protectoras");
    // El error simetrico es igual de facil: un grupo protector con frecuencia baja leido como acierto.
    expect(SISTEMA).toContain("un grupo Protector con frecuencia baja es un déficit, no un acierto");
    // Y que la clasificacion que recibe MANDA: sin esto, el modelo la recalcula desde las frecuencias.
    expect(SISTEMA).toContain("Esa clasificación manda: no la recalcules");
  });

  it("y el canonico que corre ES el v15", () => {
    const modulo = readFileSync("src/modules/diagnoses/ai/prompts/criterion.system.ts", "utf8");
    expect(modulo).toContain("promptV15.system");
  });
});
