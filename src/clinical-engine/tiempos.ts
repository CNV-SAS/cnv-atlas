// Distribucion por tiempos de comida (CP2 del plan alimentario): reparte las porciones de cada grupo del
// intercambio (CP1) entre los tiempos de comida ACTIVOS, por mayor resto. Consume CP1 sin reemplazarlo.
//
// PORTE FIEL, MODULO DERIVADO (2026-08-22). Transcribe TIEMPOS_DEF (6 tiempos con su fraccion) e interSplit
// (reparto por mayor resto) del prototipo de Gildardo (ATLAS_v8.html 2026-08-19, L16624 y L16900-16908), y la
// logica de interDistAuto (PASO 4). No toca el frozen. Su paridad se prueba con golden diferencial contra la
// propia funcion del v8 (fixtures/reference/tiempos-vigente.js).

import { INTER_TABLA_A } from "./intercambio";

// Los 6 tiempos de comida con su fraccion por defecto del objetivo (suma 1). Verbatim del v8 (L16624).
export const TIEMPOS_DEF: { id: string; n: string; p: number }[] = [
  { id: "desayuno", n: "Desayuno", p: 0.25 },
  { id: "mediasOnces", n: "Medias onces", p: 0.1 },
  { id: "almuerzo", n: "Almuerzo", p: 0.3 },
  { id: "algo", n: "Algo", p: 0.1 },
  { id: "cena", n: "Cena", p: 0.2 },
  { id: "merienda", n: "Merienda", p: 0.05 },
];

// Reparto por MAYOR RESTO (verbatim, L16900-16908): reparte `total` porciones enteras entre las proporciones
// `props`, dando las unidades sobrantes a los mayores restos fraccionarios. La suma de las partes == total
// (ninguna porcion se pierde). Determinista.
export function interSplit(total: number, props: number[]): number[] {
  const sp = props.reduce((a, b) => a + b, 0) || 1;
  const raw = props.map((p) => (total * p) / sp);
  const fl = raw.map((x) => Math.floor(x));
  const rem = total - fl.reduce((a, b) => a + b, 0);
  const ord = raw.map((x, ix) => ({ ix, fr: x - Math.floor(x) })).sort((a, b) => b.fr - a.fr);
  for (let i = 0; i < rem && ord.length; i++) {
    fl[ord[i % ord.length].ix]++;
  }
  return fl;
}

export type TiemposActivos = Record<string, boolean>;
// Distribucion: por ALIMENTO (sub) -> por tiempo -> porciones. Solo alimentos con porciones > 0 (fiel al v8,
// interDistSubs = INTER_TABLA_A.filter(porciones>0)). Los demas no aparecen.
export type TiemposDist = Record<string, Record<string, number>>;

// Los tiempos ACTIVOS (en el orden de TIEMPOS_DEF), y sus fracciones para el reparto.
export function tiemposVivos(activos: TiemposActivos): { id: string; n: string; p: number }[] {
  return TIEMPOS_DEF.filter((t) => activos[t.id]);
}

// Reparte las porciones por ALIMENTO (de CP1) entre los tiempos activos (PASO 4, interDistAuto del v8).
// Determinista; NO lee macros ni encuesta. Con cero tiempos activos, no reparte nada (la UI exige al menos
// uno). El reparto por alimento cuadra: la suma de porciones por tiempo == las porciones del alimento
// (propiedad de interSplit). Fiel al v8: itera INTER_TABLA_A por sub, solo los alimentos con porciones > 0.
export function computeTiempos(porcionesPorSub: Record<string, number>, activos: TiemposActivos): TiemposDist {
  const vivos = tiemposVivos(activos);
  const props = vivos.map((t) => t.p);
  const dist: TiemposDist = {};
  for (const r of INTER_TABLA_A) {
    const tot = porcionesPorSub[r.sub] ?? 0;
    if (tot > 0) {
      const parts = interSplit(tot, props);
      const row: Record<string, number> = {};
      vivos.forEach((t, ix) => {
        row[t.id] = parts[ix] ?? 0;
      });
      dist[r.sub] = row;
    }
  }
  return dist;
}
