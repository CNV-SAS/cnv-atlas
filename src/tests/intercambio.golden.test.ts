import { describe, expect, it } from "vitest";

import {
  computeIntercambio,
  grupoSinPorcion,
  porcionesDefaultPorSub,
  GRUPOS_NUCLEARES,
  INTER_TABLA_A,
  INTER_GRUPOS,
} from "@/clinical-engine/intercambio";

// GOLDEN de la lista de intercambio (CP1). Dos candados, como en 1a.1/1b + el candado de Wang:
//   (1) TRANSCRIPCION: la tabla de alimentos (INTER_TABLA_A) y los grupos son byte-identicos a los del v8
//       (extraidos verbatim al fixture de referencia). Un numero mal copiado truena aqui, no se propaga a la
//       validacion (CP3) sin que nadie lo note (cuidado a: la tabla es el dato mas grande que hemos portado).
//   (2) DIFERENCIAL: computeIntercambio reproduce el reparto de porciones del v8 (PASO 3, en el fixture) para
//       varios objetivos: uno bajo, uno alto, y un caso medio (cuidado c: el reparto puede diferir en extremos).
// Mas los EXTREMOS (cuidado d): con objetivo muy bajo algun grupo queda en 0 porciones; el modulo lo marca
// (aviso "sin-porcion"), no muestra un 0 mudo.

import { INTER_TABLA_A as REF_TABLA, INTER_GRUPOS as REF_GRUPOS, computeIntercambioRef } from "./fixtures/reference/intercambio-vigente.js";

const ref = computeIntercambioRef as unknown as (kcalObj: number) => Record<string, number>;

describe("intercambio: candado de transcripcion (tabla verbatim del v8)", () => {
  it("INTER_TABLA_A es byte-identica a la del v8 (21 alimentos x 27 campos)", () => {
    // deep-equal cubre TODOS los campos, no solo los 17 que el calculo usa hoy: los otros 10 nutrientes los
    // usa la validacion (CP3), asi que tienen que estar bien tambien (cuidado a).
    expect(INTER_TABLA_A).toEqual(REF_TABLA);
    expect(INTER_TABLA_A).toHaveLength(21);
    // cada fila trae las 29 claves (gr, sub, kcal + 26 nutrientes): atrapa una fila truncada al portar.
    for (const row of INTER_TABLA_A) expect(Object.keys(row)).toHaveLength(29);
  });
  it("INTER_GRUPOS es byte-identica a la del v8 (12 grupos)", () => {
    expect(INTER_GRUPOS).toEqual(REF_GRUPOS);
    expect(INTER_GRUPOS).toHaveLength(12);
  });
});

describe("intercambio: golden diferencial del reparto de porciones (PASO 3) contra el v8", () => {
  // Compara las porciones POR ALIMENTO de computeIntercambio con nx del reference (keyed por sub). Ahora cubre
  // los 21 alimentos (no solo los 12 representativos): un no-representativo debe quedar en 0 igual que el v8.
  const assertParidad = (kcalObj: number) => {
    const mine = computeIntercambio(kcalObj);
    const refNx = ref(kcalObj);
    for (const a of mine) {
      expect(a.porciones).toBe(refNx[a.sub] ?? 0);
    }
  };

  // El reparto depende SOLO del objetivo, NO de los macros (verificado contra PASO 3 del v8: no usa
  // protG/fatG/choG; los macros entran en la validacion, CP3). El objetivo que se pasa ES el EFECTIVO AJUSTADO
  // (computeProtocoloEfectivo con los 5 ajustes), asi que estos objetivos representan casos CON ajustes, no solo
  // el sugerido: 2000 medio, 1200 un deficit fuerte, 3200 un superavit. Cubre el extremo que pidio cuidado (c).
  it("objetivo medio (2000 kcal, p.ej. sugerido): paridad byte a byte", () => assertParidad(2000));
  it("objetivo BAJO (1200 kcal, p.ej. ajuste con deficit): paridad en el extremo bajo", () => assertParidad(1200));
  it("objetivo ALTO (3200 kcal, p.ej. ajuste con superavit): paridad en el extremo alto", () => assertParidad(3200));
  it("mismo objetivo -> mismas porciones (determinista; no hay otra entrada, los macros no entran)", () => {
    expect(computeIntercambio(2000)).toEqual(computeIntercambio(2000));
  });

  // Las columnas de macros de la tabla (porte del v8: kcal/porcion, kcal, proteina, CHO y grasa) se calculan
  // como porciones x el valor POR PORCION que expone computeIntercambio. Se assertan los NUMEROS contra
  // INTER_TABLA_A, no que los campos existan: un test de existencia pasaria verde con el macro equivocado
  // (p.ej. grasa donde va CHO), que es justo el error que nadie veria en pantalla.
  it("expone los macros POR PORCION con el valor exacto de INTER_TABLA_A (no solo que existan)", () => {
    const porSub = new Map(INTER_TABLA_A.map((r) => [r.sub, r]));
    const alimentos = computeIntercambio(2000);
    expect(alimentos.length).toBe(INTER_TABLA_A.length);
    for (const a of alimentos) {
      const r = porSub.get(a.sub)!;
      expect(a.kcal, `kcal de ${a.sub}`).toBe(r.kcal);
      expect(a.prot, `proteina de ${a.sub}`).toBe(r.prot);
      expect(a.cho, `CHO de ${a.sub}`).toBe(r.cho);
      expect(a.gras, `grasa de ${a.sub}`).toBe(r.gras);
    }
    // Un caso concreto, por si algun dia se reordenan los campos: las carnes magras aportan mucha proteina y
    // casi nada de CHO; si se cruzaran, este numero cambia.
    const carnes = alimentos.find((a) => a.sub === "Carnes magras")!;
    expect(carnes.prot).toBe(19.1);
    expect(carnes.cho).toBe(1);
    expect(carnes.gras).toBe(3.1);
  });

  it("Verduras (G2) es SIEMPRE 2 porciones en total, no computadas (excepcion del v8)", () => {
    for (const kcal of [1000, 2000, 3500]) {
      const totalG2 = computeIntercambio(kcal)
        .filter((a) => a.gr === "G2")
        .reduce((s, a) => s + a.porciones, 0);
      expect(totalG2).toBe(2);
    }
  });
});

describe("intercambio: extremos (cuidado d) — un grupo NUCLEAR en 0 se MARCA; un discrecional en 0 NO (seria ruido)", () => {
  it("objetivo muy bajo (400 kcal): grupos nucleares caen a 0 y grupoSinPorcion los marca; el resto no", () => {
    const porc = porcionesDefaultPorSub(400);
    const nucleoEnCero = [...GRUPOS_NUCLEARES].filter((gr) => grupoSinPorcion(gr, porc));
    expect(nucleoEnCero.length).toBeGreaterThan(0); // el objetivo implausiblemente bajo SI marca nucleares
    // grupoSinPorcion nunca marca un no-nuclear (G2 incluido, fijo en 2).
    for (const g of INTER_GRUPOS) {
      if (grupoSinPorcion(g.id, porc)) expect(GRUPOS_NUCLEARES.has(g.id)).toBe(true);
    }
  });

  it("objetivo normal (2200 kcal): ningun grupo NUCLEAR en 0, aunque un discrecional (mecato) SI puede ser 0 sin marca", () => {
    const porc = porcionesDefaultPorSub(2200);
    // ningun grupo nuclear marcado (todos tienen porciones)
    for (const gr of GRUPOS_NUCLEARES) expect(grupoSinPorcion(gr, porc)).toBe(false);
    // pero mecato (G11, discrecional) es 0 a 2200 y NO se marca: es un default sano, no una anomalia.
    const totalMecato = INTER_TABLA_A.filter((r) => r.gr === "G11").reduce((s, r) => s + (porc[r.sub] || 0), 0);
    expect(totalMecato).toBe(0);
    expect(grupoSinPorcion("G11", porc)).toBe(false);
  });
});
