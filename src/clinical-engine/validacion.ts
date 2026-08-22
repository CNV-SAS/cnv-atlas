// Validacion nutricional del plan (CP3 del plan alimentario): tabla de nutrientes con obtenido / requerido /
// % de cubrimiento / ICN, desde las porciones del intercambio (CP1). Tercera y ultima parte de la grilla.
//
// PORTE FIEL, MODULO DERIVADO (2026-08-22). Transcribe interNeed (targets DRI/RDA), INTER_NUTS (los nutrientes
// mostrados), interTot (aporte = porciones x nutriente de INTER_TABLA_A), interCob (% cubrimiento) e interICN
// (indice de calidad nutricional) del prototipo de Gildardo (ATLAS_v8.html 2026-08-19, L16881-16889). No toca
// el frozen. La tabla de alimentos INTER_TABLA_A viene del modulo de intercambio (su candado de transcripcion
// -CP1- ya la verifica byte a byte contra el v8, incluidos los nutrientes que solo consume ESTA validacion).
// Paridad probada con golden diferencial contra la funcion del v8.

import { INTER_TABLA_A } from "./intercambio";

// Los nutrientes de la tabla de validacion (verbatim, L16884). `d` = decimales de display; `lim` = es un
// nutriente a LIMITAR (sodio), no a cubrir. `l`/`u` = etiqueta y unidad (user-facing).
export const INTER_NUTS: { k: string; l: string; u: string; d: number; lim?: boolean }[] = [
  { k: "kcal", l: "Energía", u: "kcal", d: 0 },
  { k: "prot", l: "Proteína", u: "g", d: 0 },
  { k: "cho", l: "Carbohidrato", u: "g", d: 0 },
  { k: "gras", l: "Grasa", u: "g", d: 0 },
  { k: "fib", l: "Fibra", u: "g", d: 1 },
  { k: "ca", l: "Calcio", u: "mg", d: 0 },
  { k: "p", l: "Fósforo", u: "mg", d: 0 },
  { k: "fe", l: "Hierro", u: "mg", d: 1 },
  { k: "mg", l: "Magnesio", u: "mg", d: 0 },
  { k: "zn", l: "Zinc", u: "mg", d: 1 },
  { k: "k", l: "Potasio", u: "mg", d: 0 },
  { k: "na", l: "Sodio", u: "mg", d: 0, lim: true },
  { k: "va", l: "Vitamina A", u: "µg", d: 0 },
  { k: "fol", l: "Folato", u: "µg", d: 0 },
  { k: "b12", l: "Vit B12", u: "µg", d: 1 },
  { k: "vc", l: "Vitamina C", u: "mg", d: 0 },
];

type NutMap = Record<string, number>;

export type ValidacionEntrada = {
  porcionesPorSub: NutMap; // porciones por alimento (sub) del intercambio
  kcalObj: number;
  protG: number;
  choG: number;
  fatG: number;
  sexoM: boolean;
  edad: number;
};

export type NutrienteValidado = {
  k: string;
  l: string;
  u: string;
  d: number;
  lim: boolean;
  obtenido: number;
  requerido: number;
  cob: number; // % de cubrimiento
  icn: number | null; // indice de calidad nutricional (adecuacion por kcal); null si no computable
};

// Targets por nutriente (interNeed, L16881-16883): kcal/prot/cho/gras de la cadena; fib de kcal; micros DRI/RDA
// por sexo/edad. _driCa y _driFe dependen de edad/sexo.
function interNeed(e: ValidacionEntrada): NutMap {
  const driCa = e.edad > 70 ? 1200 : e.edad >= 51 ? (e.sexoM ? 1000 : 1200) : 1000;
  const driFe = e.sexoM ? 8 : e.edad <= 50 ? 18 : 8;
  return {
    kcal: e.kcalObj || 0,
    prot: e.protG || 0,
    cho: e.choG || 0,
    gras: e.fatG || 0,
    fib: Math.round((14 * (e.kcalObj || 0)) / 1000),
    ca: driCa,
    p: 700,
    fe: driFe,
    mg: e.sexoM ? 420 : 320,
    zn: e.sexoM ? 11 : 8,
    k: e.sexoM ? 3400 : 2600,
    na: 2300,
    va: e.sexoM ? 900 : 700,
    fol: 400,
    b12: 2.4,
    vc: e.sexoM ? 90 : 75,
  };
}

// Aporte total (interTot, L16886): suma porciones x contenido del nutriente, sobre todos los alimentos.
function interTot(porcionesPorSub: NutMap): NutMap {
  const keys = ["kcal", "prot", "cho", "gras", "fib", "ca", "p", "fe", "mg", "zn", "k", "na", "va", "fol", "b12", "vc"];
  const tot: NutMap = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const r of INTER_TABLA_A) {
    const n = Number(porcionesPorSub[r.sub]) || 0;
    if (n === 0) continue;
    const row = r as unknown as NutMap;
    for (const k of keys) tot[k] += n * (row[k] || 0);
  }
  return tot;
}

// Tabla de validacion: por nutriente, obtenido/requerido/% cubrimiento/ICN. interCob e interICN verbatim.
export function computeValidacion(e: ValidacionEntrada): NutrienteValidado[] {
  const need = interNeed(e);
  const tot = interTot(e.porcionesPorSub);
  const cob = (k: string) => (need[k] > 0 ? (tot[k] / need[k]) * 100 : 0);
  const icn = (k: string): number | null => {
    const nd = need[k];
    const ekcal = need.kcal;
    if (!nd || !ekcal || !tot.kcal) return null;
    const eR = tot.kcal / ekcal;
    if (eR <= 0) return null;
    return tot[k] / nd / eR;
  };
  return INTER_NUTS.map((nu) => ({
    k: nu.k,
    l: nu.l,
    u: nu.u,
    d: nu.d,
    lim: Boolean(nu.lim),
    obtenido: tot[nu.k],
    requerido: need[nu.k],
    cob: cob(nu.k),
    icn: icn(nu.k),
  }));
}
