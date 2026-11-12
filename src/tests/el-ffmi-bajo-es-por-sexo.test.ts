import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as core from "@/clinical-engine/frozen/engine.core.derived.js";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL FFMI BAJO ES POR SEXO EN TODOS LOS SITIOS QUE LO MIRAN  ·  v17 §11  ·  2026-11-12
//
// ═══ QUE ARREGLA, Y POR QUE NO ES UN DETALLE ═══
//
// Su §11 nombra dos sitios donde la sarcopenia se marcaba con un corte de FFMI igual para los dos sexos:
// *"Protocolo nutricional (dos funciones): sarcopenia con FFMI < 15 para ambos sexos"* y *"Pauta de
// ejercicio de la historia clínica: sarcopenia con FFMI < 17 para ambos sexos"*. En Atlas los dos del
// protocolo ya estaban por sexo (el frozen escribe `sexoM?FFMI<17:FFMI<15`); los que estaban con el corte
// unico eran la HISTORIA CLINICA y el PLAN DEL PACIENTE, los dos con el 17.
//
// Y EL 17 ES EL CORTE MASCULINO, asi que el error no era simetrico: una MUJER con FFMI entre 15 y 17
// salia marcada como sarcopenica en su historia clinica y en su plan. Son 476 de los 665 pacientes de la
// base, o sea que el falso positivo caia del lado de la mayoria.
//
// ═══ POR QUE ESTE CANDADO MIRA EL CODIGO Y NO SOLO EL RESULTADO ═══
//
// Lo que hay que impedir no es un valor, es una FORMA: que alguien vuelva a escribir el numero en vez de
// preguntarle al clasificador. Un caso que solo comprobara "una mujer con FFMI 16 no sale sarcopenica"
// pasaria verde el dia que alguien escriba `sexoM ? 17 : 15` a mano, que es la misma trampa un paso mas
// adelante: dos copias del corte que el dia que el las mueva se quedan atras.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const SITIOS = [
  "src/modules/reports/data/hc-composicion.ts",
  "src/modules/reports/data/plan-paciente-reader.ts",
];

describe("el FFMI bajo se pregunta al clasificador, no se escribe", () => {
  for (const sitio of SITIOS) {
    it(`${sitio.split("/").pop()} lo resuelve con cFFMI`, () => {
      const src = sinComentarios(readFileSync(sitio, "utf8"));
      expect(src, "ya no pregunta al clasificador por el FFMI bajo").toContain("core.cFFMI(");
      // Y NINGUN CORTE DE FFMI ESCRITO A MANO: ni el masculino (17), ni el femenino (15), ni los dos en
      // un ternario. Se permite la comparacion contra CERO, que no es un corte clinico sino la guarda de
      // "hay dato": el clasificador no distingue el cero de un FFMI real y lo pondria en la banda baja.
      expect(src, "volvio el corte de FFMI escrito a mano").not.toMatch(/FFMI\s*[<>]=?\s*(?!0\b)\d/);
    });
  }

  it("y la banda baja del clasificador es la que su archivo dice, por sexo", () => {
    // El control de que `k === 1` significa lo que este candado cree que significa. Los cortes son los
    // suyos (cFFMI, que la v17 conserva con los cortes del Excel para sus banderas clinicas).
    expect(core.cFFMI(16.99, "M").k, "hombre con FFMI 16,99").toBe(1);
    expect(core.cFFMI(17, "M").k, "hombre con FFMI 17").toBe(2);
    expect(core.cFFMI(14.99, "F").k, "mujer con FFMI 14,99").toBe(1);
    expect(core.cFFMI(15, "F").k, "mujer con FFMI 15").toBe(2);
  });

  it("LA VENTANA DEL FALSO POSITIVO: una mujer entre 15 y 17 ya no es sarcopenica", () => {
    // Es el caso concreto que se estaba comunicando mal, escrito con sus dos cortes al lado para que se
    // vea por que: con el corte masculino (17) esta mujer entraba; con el suyo (15) no.
    for (const ffmi of [15, 15.5, 16, 16.99]) {
      expect(core.cFFMI(ffmi, "F").k, `mujer con FFMI ${ffmi}`).not.toBe(1);
      expect(core.cFFMI(ffmi, "M").k, `y el mismo numero en un hombre SI es bajo (FFMI ${ffmi})`).toBe(1);
    }
  });
});
