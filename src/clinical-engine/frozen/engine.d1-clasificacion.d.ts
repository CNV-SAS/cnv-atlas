// Declaraciones de tipos para engine.d1-clasificacion.js (CONGELADO, verbatim de la entrega del
// 4 de noviembre de 2026). Describen SOLO la superficie que consumen el adaptador
// (`d1-clasificacion.ts`) y la vista; el `.js` no se edita ni se convierte a TS (excepcion
// nombrada a la regla 12, ARCHITECTURE.md).

import type { PatronCat } from "./engine.patron.js";

/** Estado de UN grupo. `neutro` es "sin senal de riesgo" (grupos 8, 9 y 10), no "normal". */
export type D1Estado = "ok" | "mejorar" | "deficit" | "moderar" | "exceso" | "neutro";

/** Un grupo ya clasificado: su frecuencia 0-4 (o null si no se respondio) y su estado. */
export type D1Grupo = {
  n: number;
  cat: PatronCat;
  label: string;
  v: number | null;
  estado: D1Estado | null;
};

/** El patron global. `null` cuando no se respondio ningun grupo: sin datos no es "protector". */
export type D1Patron = "riesgo" | "moderado" | "protector" | null;

export type D1Clasificacion = {
  grupos: D1Grupo[];
  exceso: D1Grupo[];
  moderar: D1Grupo[];
  deficit: D1Grupo[];
  /** Promedio de los protectores RESPONDIDOS, o null si no hay ninguno. */
  protAvg: number | null;
  patron: D1Patron;
  respondidos: number;
};

/** Los cinco textos de frecuencia que el parrafo del patron usa ("nunca", "1 a 2 dias por semana", ...). */
export const D1_FREQ_TXT: string[];

/** El estado de un grupo suelto. `g` es un elemento de FREQ_GROUPS; `v` su frecuencia 0-4. */
export function d1EstadoGrupo(
  g: { n: number; cat: string } | null | undefined,
  v: number | string | null | undefined,
): D1Estado | null;

/**
 * Clasifica los 15 grupos de D1. `enc` trae la frecuencia por clave `d1_N_i` como ORDINAL 0-4.
 * `conRespaldo` lee ademas las claves sin sufijo `_i` de los registros antiguos del HTML; en Atlas
 * va en false, porque ninguna de las cinco versiones publicadas de la encuesta declara esas claves
 * (medido el 2026-11-05: 0 de 319 field_keys). Es tambien lo que hace SU vista D1.
 */
export function d1Clasificar(
  enc: Record<string, number | string | null | undefined> | null | undefined,
  conRespaldo?: boolean,
): D1Clasificacion;

/** Lista en prosa los grupos de una lista, cada uno con su frecuencia en palabras. */
export function d1Lista(gs: D1Grupo[]): string;

/** La frase del patron que ve el profesional. USER-FACING: tildes y enes, verbatim de su archivo. */
export function d1TextoPatron(c: D1Clasificacion | null | undefined): string;
