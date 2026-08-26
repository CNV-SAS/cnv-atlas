import { describe, expect, it } from "vitest";

import { type EngineInput, runEngine } from "@/clinical-engine";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import enc from "./fixtures/clinical-engine/encuesta-sintetica.json";

// CANDADO DE INERCIA (previo a la data-migration de los field_key faltantes).
//
// Vamos a darle field_key a las 25 preguntas que hoy no lo tienen, para que su respuesta
// llegue al motor. La pregunta que este candado responde es la unica que importa antes de
// tocar nada: al empezar a llegar, ¿MUEVEN algun calculo?
//
// La respuesta esperada es NO para todas menos d3_31 (que el DFI lee y no usa: lectura
// muerta). Si alguna mueve algo, la migracion NO es mecanica y hay que parar.

// Los 25 codigos, con el codigo de GILDARDO (no el numero de nuestra pantalla: ver la
// leccion del desfase de numeracion). Valores plausibles, del tipo que de verdad
// responderia un paciente.
const NUEVOS: Record<string, unknown> = {
  d3_25: "Caminata",
  d3_27: "Regular",
  d3_28: "Sí",
  d3_31: "Todos los días",
  d4_32: "3",
  d4_33: "Sí",
  d4_34: "Vegetariano",
  d4_35: "Vitamina D",
  d5_37: "Losartán",
  d5_41: "Sí",
  d5_42: "Sí",
  d6_43: ["Mariscos"],
  d6_44: ["Lactosa"],
  d6_qx: "Bypass gástrico",
  d6_45: "Frecuente",
  d6_46: "Frecuente",
  d6_47: "A veces",
  d6_48: "Nunca",
  d6_49: "Frecuente",
  d6_50: "A veces",
  d6_51: "Nunca",
  d7_52: "3",
  d7_53: "1",
  d7_54: "2",
  d7_58: "Amarillo oscuro",
};

const base = enc as Record<string, unknown>;
const EXPECTED = Object.keys(base).filter((k) => /^d\d/.test(k));

function input(survey: Record<string, unknown>): EngineInput {
  return {
    sexo: "M",
    edad: 54,
    bisRow: biody as Record<string, unknown>,
    survey,
    expectedFieldKeys: EXPECTED,
    model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  };
}

describe("inercia de los field_key que faltan", () => {
  it("agregar los 25 campos NO mueve ninguna salida del motor", () => {
    const antes = runEngine(input({ ...base }));
    const despues = runEngine(input({ ...base, ...NUEVOS }));
    expect(despues).toEqual(antes);
  });

  it("campo por campo: ninguno mueve nada por si solo", () => {
    const antes = JSON.stringify(runEngine(input({ ...base })));
    const mueven: string[] = [];
    for (const [k, v] of Object.entries(NUEVOS)) {
      const despues = JSON.stringify(runEngine(input({ ...base, [k]: v })));
      if (despues !== antes) mueven.push(k);
    }
    expect(mueven).toEqual([]);
  });
});

describe("control negativo: el candado SI detecta un cambio real", () => {
  it("mover un campo que el motor SI lee cambia la salida", () => {
    const antes = runEngine(input({ ...base }));
    // d3_30 (tabaco) alimenta el dominio Tabaco del DFI. Si esto no mueve nada,
    // el candado de arriba esta pasando por vacio y no prueba inercia.
    const despues = runEngine(input({ ...base, d3_30: "Fumo a diario" }));
    expect(despues).not.toEqual(antes);
  });
});
