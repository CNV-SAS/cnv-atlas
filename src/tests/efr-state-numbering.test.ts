import { describe, expect, it } from "vitest";

import { buildRegistryData } from "@/clinical-engine/registry-data";

// Verificacion de la numeracion de los 81 estados EFR contra la logica REAL del HTML de
// Gildardo, estado por estado (no solo la biyeccion 1..81, que solo probaria que es una
// permutacion, no la permutacion correcta).
//
// FUENTE DE VERDAD: la salida del efrNum del prototipo `ATLAS_v7.html` (L5810-5815). Los
// arreglos SEC_EFR/RNG_EFR y la formula se transcriben aqui VERBATIM del HTML. Deliberadamente
// NO se importa `EFR_RISK_ORDER` de `clinical-engine/types.ts`: este test valida la salida del
// registry (que el port genero con esa constante) contra una re-derivacion INDEPENDIENTE del
// HTML, para que la validacion no sea circular. Si el port transcribio mal el orden de riesgo,
// el registry diferiria de este `htmlEfrNum` y el test lo detectaria.
//
// Los golden tests (`clinical-engine-golden.test.ts`) siguen asertando SOLO clave/fenotipo/
// bandas, nunca el numero: la etiqueta-numero es convencion de presentacion, no ciencia.

// SEC_EFR / RNG_EFR verbatim de ATLAS_v7.html L5810-5811. Orden por rango de riesgo (0-8):
// SEC indexa [IFC, IRC]; RNG indexa [FFMI, FMI].
const SEC_EFR: ReadonlyArray<readonly [number, number]> = [
  [3, 1], [3, 2], [2, 1], [2, 2], [3, 3], [2, 3], [1, 1], [1, 2], [1, 3],
];
const RNG_EFR: ReadonlyArray<readonly [number, number]> = [
  [3, 1], [3, 2], [2, 1], [2, 2], [3, 3], [2, 3], [1, 1], [1, 2], [1, 3],
];

// efrNum verbatim de ATLAS_v7.html L5812-5815: _pSc*9 + _pRg + 1 (con _pSc/_pRg = indice del
// par de bandas en su arreglo de riesgo). Null si alguna banda no esta (no ocurre con 1/2/3).
function htmlEfrNum(ifc: number, irc: number, ffmi: number, fmi: number): number | null {
  const pSc = SEC_EFR.findIndex(([a, b]) => a === ifc && b === irc);
  const pRg = RNG_EFR.findIndex(([a, b]) => a === ffmi && b === fmi);
  return pSc >= 0 && pRg >= 0 ? pSc * 9 + pRg + 1 : null;
}

// Anclas clinicas conocidas: bandas -> numero que les asigna el HTML + significado (del
// registry). Cubren los extremos (mejor #1 al centro, peor #81 en la periferia) y el medio.
const CLINICAL_ANCHORS = [
  { bands: [3, 1, 3, 1], num: 1, key: "A_B_A_B", meaning: "Atleta" },
  { bands: [2, 2, 2, 2], num: 31, key: "N_N_N_N", meaning: "saludable" },
  { bands: [2, 2, 2, 3], num: 33, key: "N_N_N_A", meaning: "grasa alta" },
  { bands: [1, 3, 1, 3], num: 81, key: "B_A_B_A", meaning: "sarcopénica" },
] as const;

describe("numeracion EFR vs efrNum del HTML (estado por estado)", () => {
  const efrStates = buildRegistryData().efrStates;

  it("estados clinicos conocidos: el numero sale del efrNum del HTML, no de la formula del port", () => {
    const byKey = new Map(efrStates.map((s) => [s.key, s]));
    for (const a of CLINICAL_ANCHORS) {
      const [ifc, irc, ffmi, fmi] = a.bands;
      // 1. El HTML (transcripcion independiente) asigna a.num a estas bandas.
      expect(htmlEfrNum(ifc, irc, ffmi, fmi)).toBe(a.num);
      // 2. El registry (salida del port) pone el MISMO numero, con la clave y la clinica esperadas.
      const s = byKey.get(a.key);
      expect(s?.stateNumber).toBe(a.num);
      expect(s?.diagnosisName).toContain(a.meaning);
    }
  });

  it("los 81 estados del registry coinciden con el efrNum del HTML (barrido completo)", () => {
    expect(efrStates).toHaveLength(81);
    for (const s of efrStates) {
      expect(s.stateNumber).toBe(htmlEfrNum(s.ifcBand, s.ircBand, s.ffmiBand, s.fmiBand));
    }
    // Y sigue siendo una biyeccion 1..81 (ningun estado sin numero, sin duplicados).
    const nums = efrStates.map((s) => s.stateNumber);
    expect(new Set(nums).size).toBe(81);
    expect(Math.min(...nums)).toBe(1);
    expect(Math.max(...nums)).toBe(81);
  });
});
