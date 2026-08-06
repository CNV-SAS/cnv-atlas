import { describe, expect, it } from "vitest";

import { calcPatron, type PatronEnc, type PatronResult } from "@/clinical-engine/frozen/engine.patron.js";

// GOLDEN patron: fija el COMPORTAMIENTO de calcPatron (el DISPLAY del patron alimentario) con
// valores capturados ejecutando el bloque verbatim del v8. DIFF-patron ya garantiza que los BYTES
// son los de Gildardo; este golden documenta que la matematica produce lo esperado, y suena si
// alguien la altera aunque el DIFF no cubriera un caso. Cubre a proposito:
//   (1) las 4 bandas de nivel (Optimo/Adecuado/Mejorable/Deficiente) con su color e icono,
//   (2) los BORDES de los umbrales de score (35 y 55, con un caso justo por encima y otro por
//       debajo; el 75 no se alcanza EXACTO con ordinales discretos, se cruza entre 70 y 82),
//   (3) el enc VACIO -> respondidos 0 y "Deficiente": la patologia real de hoy, con los d1_N_i en
//       field_key NULL calcPatron clasificaria "Deficiente" a todos (por eso el Alcance A no va),
//   (4) el passthrough de los tres horarios (salExtra/desayuna/cenaHora).

// Helpers para construir enc por indice de frecuencia (0=Nunca .. 4=Todos los dias).
const all = (v: number, ns: number[]): PatronEnc =>
  Object.fromEntries(ns.map((n) => [`d1_${n}_i`, v]));
const PROT = [1, 2, 3, 4, 5, 6, 7];
const NEUTRO = [8, 9, 10, 15];
const RIESGO = [11, 12, 13, 14];

// nivel esperado por banda (etiqueta + color + icono verbatim del prototipo).
const OPTIMO = { l: "Óptimo", col: "#16a34a", ico: "🟢" };
const ADECUADO = { l: "Adecuado", col: "#2563eb", ico: "🔵" };
const MEJORABLE = { l: "Mejorable", col: "#d97706", ico: "🟡" };
const DEFICIENTE = { l: "Deficiente", col: "#dc2626", ico: "🔴" };

type Caso = { label: string; enc: PatronEnc; expected: PatronResult };

const CASOS: Caso[] = [
  {
    label: "Optimo (score 82): protectores y neutros al maximo, riesgo en Nunca",
    enc: { ...all(4, PROT), ...all(4, NEUTRO), ...all(0, RIESGO) },
    expected: {
      score: 82, nivel: OPTIMO, protAltos: 7, protModerado: 7, riesgoAltos: 0, riesgoNunca: 4,
      prot: [4, 4, 4, 4, 4, 4, 4], neutro: [4, 4, 4, 4], riesgo: [0, 0, 0, 0],
      respondidos: 15, activos: 11, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    label: "Adecuado (score 70): protectores 5-6d, neutros 5-6d, riesgo Nunca",
    enc: { ...all(3, PROT), ...all(3, NEUTRO), ...all(0, RIESGO) },
    expected: {
      score: 70, nivel: ADECUADO, protAltos: 7, protModerado: 7, riesgoAltos: 0, riesgoNunca: 4,
      prot: [3, 3, 3, 3, 3, 3, 3], neutro: [3, 3, 3, 3], riesgo: [0, 0, 0, 0],
      respondidos: 15, activos: 11, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    label: "Borde 55 EXACTO -> Adecuado (prueba el >= 55)",
    enc: { d1_1_i: 3, d1_2_i: 3, d1_3_i: 3, d1_4_i: 3, d1_5_i: 3, d1_6_i: 2, d1_7_i: 0, ...all(0, NEUTRO), ...all(0, RIESGO) },
    expected: {
      score: 55, nivel: ADECUADO, protAltos: 5, protModerado: 6, riesgoAltos: 0, riesgoNunca: 4,
      prot: [3, 3, 3, 3, 3, 2, 0], neutro: [0, 0, 0, 0], riesgo: [0, 0, 0, 0],
      respondidos: 15, activos: 6, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    label: "Mejorable (score 36): justo por encima del umbral 35",
    enc: { ...all(2, PROT), ...all(2, NEUTRO), ...all(2, RIESGO) },
    expected: {
      score: 36, nivel: MEJORABLE, protAltos: 0, protModerado: 7, riesgoAltos: 0, riesgoNunca: 0,
      prot: [2, 2, 2, 2, 2, 2, 2], neutro: [2, 2, 2, 2], riesgo: [2, 2, 2, 2],
      respondidos: 15, activos: 11, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    label: "Borde 33 -> Deficiente: justo por debajo del umbral 35 (un grupo de riesgo a 5-6d)",
    enc: { ...all(2, PROT), ...all(2, NEUTRO), d1_11_i: 2, d1_12_i: 2, d1_13_i: 2, d1_14_i: 3 },
    expected: {
      score: 33, nivel: DEFICIENTE, protAltos: 0, protModerado: 7, riesgoAltos: 1, riesgoNunca: 0,
      prot: [2, 2, 2, 2, 2, 2, 2], neutro: [2, 2, 2, 2], riesgo: [2, 2, 2, 3],
      respondidos: 15, activos: 11, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    label: "Todo en Nunca (score 10) -> Deficiente, pero respondidos 15",
    enc: { ...all(0, PROT), ...all(0, NEUTRO), ...all(0, RIESGO) },
    expected: {
      score: 10, nivel: DEFICIENTE, protAltos: 0, protModerado: 0, riesgoAltos: 0, riesgoNunca: 4,
      prot: [0, 0, 0, 0, 0, 0, 0], neutro: [0, 0, 0, 0], riesgo: [0, 0, 0, 0],
      respondidos: 15, activos: 0, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    // La patologia de hoy: sin los d1_N_i (field_key NULL), enc llega vacio -> "Deficiente" para
    // todos y respondidos 0. Es la evidencia de que un display sin cablear (Alcance A) MIENTE.
    label: "enc VACIO -> Deficiente, respondidos 0 (la patologia del Alcance A)",
    enc: {},
    expected: {
      score: 10, nivel: DEFICIENTE, protAltos: 0, protModerado: 0, riesgoAltos: 0, riesgoNunca: 0,
      prot: [-1, -1, -1, -1, -1, -1, -1], neutro: [-1, -1, -1, -1], riesgo: [-1, -1, -1, -1],
      respondidos: 0, activos: 0, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    label: "Horarios: salExtra/desayuna/cenaHora reflejan enc.d1f_*_i",
    enc: { ...all(2, [...PROT, ...NEUTRO, ...RIESGO]), d1f_sal_i: 2, d1f_des_i: 1, d1f_noche_i: 3 },
    expected: {
      score: 36, nivel: MEJORABLE, protAltos: 0, protModerado: 7, riesgoAltos: 0, riesgoNunca: 0,
      prot: [2, 2, 2, 2, 2, 2, 2], neutro: [2, 2, 2, 2], riesgo: [2, 2, 2, 2],
      respondidos: 15, activos: 11, salExtra: 2, desayuna: 1, cenaHora: 3,
    },
  },
];

describe("GOLDEN patron: calcPatron == valores capturados del v8", () => {
  for (const c of CASOS) {
    it(c.label, () => {
      expect(calcPatron(c.enc)).toEqual(c.expected);
    });
  }
});
