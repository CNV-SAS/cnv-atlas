import { describe, expect, it } from "vitest";

import { calcPatron, type PatronEnc, type PatronResult } from "@/clinical-engine/frozen/engine.patron.js";

// GOLDEN patron: fija el COMPORTAMIENTO de `calcPatron`. `DIFF-patron` ya garantiza que los BYTES son los
// de Gildardo; este golden documenta que la matematica produce lo esperado, y suena si alguien la altera
// aunque el DIFF no cubriera un caso.
//
// ═══ RE-ANCLADO AL v16 EL 2026-11-06, Y LA MITAD DE ARRIBA YA NO SALE DE NUESTRA SALIDA ═══
//
// Hasta hoy los valores de este archivo se "capturaron ejecutando el bloque verbatim del v8", que es lo
// mas debil que un golden puede ser: fija lo que el codigo hace, no lo que deberia hacer. Su v16 §5 trae
// SIETE CASOS DE PRUEBA CON SUS VALORES ESPERADOS, calculados por el sobre su propio archivo, asi que el
// primer bloque de abajo es un golden de verdad: el valor correcto sale de SU documento.
//
// Y los siete sirven de control cruzado del porte ANTERIOR, que es lo que les da peso: su columna "ICEC
// alim. v15" (63, 60, 60, 67, 67, 69, 63) coincide exactamente con lo que daba nuestro `calcPatron` del v8
// en esos mismos siete casos. O sea que no solo el porte nuevo es el suyo: el viejo tambien lo era, y los
// dos documentos describen la misma base.
//
// El segundo bloque (los casos estructurales) SI se arma de nuestro lado, y a proposito: cubre los bordes
// de banda y los caminos que su tabla no visita (el enc vacio, todo en "Nunca", el tope de 54 con los
// protectores completos, y que los huevos ya cuenten). Cada caso lleva su aritmetica al lado, para que se
// pueda verificar a mano sin ejecutar nada.

// Helpers para construir enc por indice de frecuencia (0=Nunca .. 4=Todos los dias).
const all = (v: number, ns: number[]): PatronEnc =>
  Object.fromEntries(ns.map((n) => [`d1_${n}_i`, v]));
const PROT = [1, 2, 3, 4, 5, 6, 7];
const NEUTRO = [8, 9, 10, 15];
const RIESGO = [11, 12, 13, 14];
/** Los tres neutros que SIGUEN sumando en el v16 (cereales integrales, tuberculos, carnes blancas). */
const NEUTRO_QUE_SUMAN = [8, 9, 10];
/** Los tres de riesgo que NO son embutidos (refinados, azucares anadidos, ultraprocesados). */
const RIESGO_SIN_EMBUTIDOS = [11, 13, 14];

// nivel esperado por banda (etiqueta + color + icono verbatim del prototipo).
const OPTIMO = { l: "Óptimo", col: "#16a34a", ico: "🟢" };
const ADECUADO = { l: "Adecuado", col: "#2563eb", ico: "🔵" };
const MEJORABLE = { l: "Mejorable", col: "#d97706", ico: "🟡" };
const DEFICIENTE = { l: "Deficiente", col: "#dc2626", ico: "🔴" };

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 1 · SUS SIETE CASOS, CON SUS CIFRAS (v16 §5)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// SU BASE, textual: "protectores en 5 a 6 dias; cereales integrales, tuberculos y carnes blancas en 3 a 4
// dias; refinados, azucares y ultraprocesados en «nunca»". Lo que varia en cada caso son los embutidos
// (grupo 12) y las carnes rojas (grupo 15).
const SU_BASE: PatronEnc = {
  ...all(3, PROT),
  ...all(2, NEUTRO_QUE_SUMAN),
  ...all(0, RIESGO_SIN_EMBUTIDOS),
};

/** Sus cinco frecuencias, por su nombre, para que el caso se lea como su tabla. */
const NUNCA = 0,
  UNO_A_DOS = 1,
  TRES_A_CUATRO = 2,
  CINCO_A_SEIS = 3,
  DIARIO = 4;

type SuCaso = { caso: string; embutidos: number; rojas: number; v15: number; v16: number; nota: string };

const SUS_CASOS: SuCaso[] = [
  // La columna v15 es la de SU tabla, y es tambien lo que daba nuestro porte del v8: queda escrita como
  // control cruzado, no se ejecuta (ese codigo ya no existe).
  { caso: "A", embutidos: CINCO_A_SEIS, rojas: DIARIO, v15: 63, v16: 46, nota: "48 + 9 − 7 rojas − 7 − 7 emb doble + 10" },
  { caso: "B", embutidos: DIARIO, rojas: DIARIO, v15: 60, v16: 40, nota: "48 + 9 − 7 rojas − 10 − 10 emb doble + 10" },
  { caso: "C", embutidos: CINCO_A_SEIS, rojas: NUNCA, v15: 60, v16: 54, nota: "48 + 9 + 3 − 7 − 7 + 10 = 56, y el tope lo baja a 54" },
  { caso: "D", embutidos: NUNCA, rojas: NUNCA, v15: 67, v16: 70, nota: "48 + 9 + 3 rojas bajas + 10" },
  { caso: "E", embutidos: NUNCA, rojas: UNO_A_DOS, v15: 67, v16: 70, nota: "igual que D: 1-2 dias sigue siendo consumo bajo" },
  { caso: "F", embutidos: UNO_A_DOS, rojas: TRES_A_CUATRO, v15: 69, v16: 65, nota: "48 + 9 + 0 rojas 3-4 no mueve − 1 − 1 + 10" },
  { caso: "G", embutidos: TRES_A_CUATRO, rojas: UNO_A_DOS, v15: 63, v16: 54, nota: "48 + 9 + 3 − 4 − 4 + 10 = 62, y el tope lo baja a 54" },
];

describe("GOLDEN patron · los siete casos de su v16 §5, con sus cifras", () => {
  for (const c of SUS_CASOS) {
    it(`caso ${c.caso}: embutidos ${c.embutidos} y rojas ${c.rojas} dan ${c.v16} (${c.nota})`, () => {
      const enc: PatronEnc = { ...SU_BASE, d1_12_i: c.embutidos, d1_15_i: c.rojas };
      expect(calcPatron(enc).score).toBe(c.v16);
    });
  }

  it("EL CONTROL: con embutidos 3-4 dias o mas, ninguno de los cuatro llega a «Adecuado»", () => {
    // Es la frase con la que cierra su §5, y es el efecto que buscaba: "aunque los protectores esten
    // completos". Si el tope se cayera, este caso lo dice en sus palabras y no en un numero.
    const conEmbutidos = SUS_CASOS.filter((c) => c.embutidos >= TRES_A_CUATRO);
    expect(conEmbutidos.map((c) => c.caso)).toEqual(["A", "B", "C", "G"]);
    for (const c of conEmbutidos) {
      const enc: PatronEnc = { ...SU_BASE, d1_12_i: c.embutidos, d1_15_i: c.rojas };
      expect(calcPatron(enc).score).toBeLessThan(55);
    }
  });

  it("y sin embutidos sube 3 puntos respecto del v15, porque ahora cuentan los huevos", () => {
    // Su otra frase de cierre. El +3 no es un ajuste suelto: es el septimo protector entrando a la escala.
    for (const c of SUS_CASOS.filter((x) => x.embutidos === NUNCA)) {
      expect(c.v16 - c.v15).toBe(3);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 2 · LOS CASOS ESTRUCTURALES, QUE SU TABLA NO VISITA
// ─────────────────────────────────────────────────────────────────────────────────────────────────

type Caso = { label: string; enc: PatronEnc; expected: PatronResult };

const CASOS: Caso[] = [
  {
    // 60 (siete protectores a diario: 70 × 6/7) + 9 (tres neutros) + 3 (rojas en Nunca) + 10 = 82.
    // ES EL MAXIMO, y su §4.2 lo dice: "el maximo sigue en 82".
    label: "Optimo (82, el maximo): protectores a diario, neutros al maximo, carnes rojas y riesgo en Nunca",
    enc: { ...all(4, PROT), ...all(4, NEUTRO_QUE_SUMAN), d1_15_i: 0, ...all(0, RIESGO) },
    expected: {
      score: 82, nivel: OPTIMO, protAltos: 7, protModerado: 7, riesgoAltos: 0, riesgoNunca: 4,
      prot: [4, 4, 4, 4, 4, 4, 4], neutro: [4, 4, 4, 0], riesgo: [0, 0, 0, 0],
      respondidos: 15, activos: 10, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    // EL CASO QUE EL v8 LLAMABA "Optimo" Y YA NO LO ES, y es el cambio entero en una linea: comer carne
    // roja TODOS LOS DIAS ya no deja el patron en lo mejor. 60 + 9 − 7 (rojas a diario) + 10 = 72.
    label: "Adecuado (72): lo mismo pero con carne roja a diario, que antes SUMABA y ahora resta",
    enc: { ...all(4, PROT), ...all(4, NEUTRO), ...all(0, RIESGO) },
    expected: {
      score: 72, nivel: ADECUADO, protAltos: 7, protModerado: 7, riesgoAltos: 0, riesgoNunca: 4,
      prot: [4, 4, 4, 4, 4, 4, 4], neutro: [4, 4, 4, 4], riesgo: [0, 0, 0, 0],
      respondidos: 15, activos: 11, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    // 36 (cuatro a 8 y dos a 5 = 42, × 6/7) + 9 + 0 (rojas 3-4 no mueve) + 10 = 55 EXACTO.
    label: "Borde 55 EXACTO: Adecuado (prueba el >= 55)",
    enc: {
      d1_1_i: 3, d1_2_i: 3, d1_3_i: 3, d1_4_i: 3, d1_5_i: 2, d1_6_i: 2, d1_7_i: 0,
      ...all(2, NEUTRO_QUE_SUMAN), d1_15_i: 2, ...all(0, RIESGO),
    },
    expected: {
      score: 55, nivel: ADECUADO, protAltos: 4, protModerado: 6, riesgoAltos: 0, riesgoNunca: 4,
      prot: [3, 3, 3, 3, 2, 2, 0], neutro: [2, 2, 2, 2], riesgo: [0, 0, 0, 0],
      respondidos: 15, activos: 10, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    // 30 (siete a 5 = 35, × 6/7) + 9 + 0 (rojas 3-4) − 12 (tres de riesgo a 3-4) − 2 (embutidos 1-2,
    // doble) + 10 = 35 EXACTO. Y el tope NO aplica: los embutidos estan en 1-2 dias.
    label: "Borde 35 EXACTO: Mejorable (prueba el >= 35)",
    enc: { ...all(2, PROT), ...all(2, NEUTRO), ...all(2, RIESGO_SIN_EMBUTIDOS), d1_12_i: 1 },
    expected: {
      score: 35, nivel: MEJORABLE, protAltos: 0, protModerado: 7, riesgoAltos: 0, riesgoNunca: 0,
      prot: [2, 2, 2, 2, 2, 2, 2], neutro: [2, 2, 2, 2], riesgo: [2, 1, 2, 2],
      respondidos: 15, activos: 11, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    // El mismo caso con los embutidos en 3-4 dias: −4 −4 en vez de −1 −1, o sea 29, y ademas el tope.
    label: "Un punto por debajo del borde: Deficiente (los embutidos suben a 3-4 dias)",
    enc: { ...all(2, PROT), ...all(2, NEUTRO), ...all(2, RIESGO) },
    expected: {
      score: 29, nivel: DEFICIENTE, protAltos: 0, protModerado: 7, riesgoAltos: 0, riesgoNunca: 0,
      prot: [2, 2, 2, 2, 2, 2, 2], neutro: [2, 2, 2, 2], riesgo: [2, 2, 2, 2],
      respondidos: 15, activos: 11, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    // EL TOPE DE 54, AISLADO: protectores y neutros al maximo (lo mejor posible) y los embutidos justo en
    // el umbral. 60 + 9 + 3 − 4 − 4 + 10 = 74, y el tope lo baja a 54. Es el control de su cuarta pieza.
    label: "El tope de 54: protectores al maximo y embutidos 3-4 dias dan 54, no 74",
    enc: { ...all(4, PROT), ...all(4, NEUTRO_QUE_SUMAN), d1_15_i: 0, ...all(0, RIESGO_SIN_EMBUTIDOS), d1_12_i: 2 },
    expected: {
      score: 54, nivel: MEJORABLE, protAltos: 7, protModerado: 7, riesgoAltos: 0, riesgoNunca: 3,
      prot: [4, 4, 4, 4, 4, 4, 4], neutro: [4, 4, 4, 0], riesgo: [0, 2, 0, 0],
      respondidos: 15, activos: 10, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    // 0 + 0 + 3 (las carnes rojas en "Nunca" SUMAN) + 10 = 13. En el v8 daba 10, porque "Nunca" en el
    // grupo 15 no sumaba nada.
    label: "Todo en Nunca (13): Deficiente, pero respondidos 15",
    enc: { ...all(0, PROT), ...all(0, NEUTRO), ...all(0, RIESGO) },
    expected: {
      score: 13, nivel: DEFICIENTE, protAltos: 0, protModerado: 0, riesgoAltos: 0, riesgoNunca: 4,
      prot: [0, 0, 0, 0, 0, 0, 0], neutro: [0, 0, 0, 0], riesgo: [0, 0, 0, 0],
      respondidos: 15, activos: 0, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    // La patologia de hoy: sin los d1_N_i (field_key NULL), enc llega vacio -> "Deficiente" para todos y
    // respondidos 0. Es la evidencia de que un display sin cablear MIENTE. Y aqui el −1 no entra a ninguna
    // rama (ni suma por "Nunca" ni resta), asi que da la base: 10.
    label: "enc VACIO: Deficiente, respondidos 0 (la patologia del display sin cablear)",
    enc: {},
    expected: {
      score: 10, nivel: DEFICIENTE, protAltos: 0, protModerado: 0, riesgoAltos: 0, riesgoNunca: 0,
      prot: [-1, -1, -1, -1, -1, -1, -1], neutro: [-1, -1, -1, -1], riesgo: [-1, -1, -1, -1],
      respondidos: 0, activos: 0, salExtra: -1, desayuna: -1, cenaHora: -1,
    },
  },
  {
    label: "Horarios: salExtra, desayuna y cenaHora reflejan enc.d1f_*_i",
    enc: { ...all(2, [...PROT, ...NEUTRO, ...RIESGO]), d1f_sal_i: 2, d1f_des_i: 1, d1f_noche_i: 3 },
    expected: {
      score: 29, nivel: DEFICIENTE, protAltos: 0, protModerado: 7, riesgoAltos: 0, riesgoNunca: 0,
      prot: [2, 2, 2, 2, 2, 2, 2], neutro: [2, 2, 2, 2], riesgo: [2, 2, 2, 2],
      respondidos: 15, activos: 11, salExtra: 2, desayuna: 1, cenaHora: 3,
    },
  },
];

describe("GOLDEN patron · los casos estructurales", () => {
  for (const c of CASOS) {
    it(c.label, () => {
      expect(calcPatron(c.enc)).toEqual(c.expected);
    });
  }

  it("LOS HUEVOS CUENTAN, que es la primera pieza de su §4.2", () => {
    // En el v8 el septimo protector no entraba (`prot.slice(0, 6)`), asi que estos dos casos daban lo
    // MISMO. Es el control que distingue el porte nuevo del viejo sin mirar una sola cifra absoluta.
    const base = { ...all(4, [1, 2, 3, 4, 5, 6]), ...all(0, NEUTRO), ...all(0, RIESGO) };
    const sinHuevos = calcPatron({ ...base, d1_7_i: 0 }).score;
    const conHuevos = calcPatron({ ...base, d1_7_i: 4 }).score;
    expect(conHuevos).toBeGreaterThan(sinHuevos);
  });

  it("y la carne roja frecuente BAJA el puntaje, donde antes lo subia", () => {
    // La causa 3 de su v16, en forma de direccion y no de numero: el grupo 15 estaba en el bono de
    // neutros y sumaba 3 puntos desde 3-4 dias.
    const base = { ...all(3, PROT), ...all(2, NEUTRO_QUE_SUMAN), ...all(0, RIESGO) };
    const pocas = calcPatron({ ...base, d1_15_i: 0 }).score;
    const muchas = calcPatron({ ...base, d1_15_i: 4 }).score;
    expect(muchas).toBeLessThan(pocas);
  });
});
