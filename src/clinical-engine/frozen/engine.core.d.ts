// Tipos para el núcleo CONGELADO (engine.core.js, extraído verbatim del prototipo).
// El .js no se edita; estos tipos solo describen su superficie pública.
// v17 §3: el sexo se normaliza con `sexoBIS`, que acepta las dos formas y devuelve null cuando no hay
// dato. Los clasificadores por sexo reciben `Sexo | null` porque el caso "sin sexo" es una rama REAL
// de su v17 ("sin sexo: no se clasifica"), no un error del llamador.
export type Sexo = 'M' | 'F' | 'Masculino' | 'Femenino';
export type SexoOpcional = Sexo | null | undefined;
export interface Clase { l: string; c: string; k?: number; risk?: string; }
export interface DXResult { n: string; dx?: string; name?: string; [k: string]: unknown; }

export function calcIFC(C: number, Rinf: number): number;
export function calcIRC(Re: number, Ri: number, C: number): number;
export function calcPABU(Re: number, Ri: number, Rinf: number, C: number, sexo: SexoOpcional): number;

export function cIFC(v: number, sexo: SexoOpcional): Clase & { k: number };
export function cIRC(v: number, sexo: Sexo): Clase & { k: number };
// v17 §4: recibe el SEXO y lee el ICA-BIS contra los percentiles de su Tabla 7.3. Devuelve dos campos
// mas que los demas clasificadores (`dir` y `g`), que su §3 usa para las alertas criticas.
export function cPABU(v: number, sexo: SexoOpcional): Clase & { dir?: "deficit" | "exceso" | null; g?: number };
export function cFMI(v: number, s: Sexo): Clase & { k: number };
export function cFFMI(v: number, s: Sexo): Clase & { k: number };
export function cISCM(v: number): Clase;
export function cIEHH(v: number): Clase;
export function cIAE(v: number): Clase;
// cAF/cIR: ya estaban en module.exports del .js (clasificadores de angulo de fase y radio de
// impedancia), solo faltaba declararlos aqui. NO son parte de los 6 exports del mecanismo derivado.
export function cAF(v: number, sexo: Sexo): Clase;
export function cIR(v: number, sexo: Sexo): Clase;

export function kl(k: number | string): string;
export function getDX(ifcK: number, ircK: number, ffmiK: number, fmiK: number): DXResult;
export function efrCompose(i: string, r: string, f: string, m: string): DXResult;
export const DX: Record<string, DXResult>;
export const FYR_LABELS: Record<string, Clase>;
export const STRUCT_LABELS: Record<string, string>;
