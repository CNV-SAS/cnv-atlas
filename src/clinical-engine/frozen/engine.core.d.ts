// Tipos para el núcleo CONGELADO (engine.core.js, extraído verbatim del prototipo).
// El .js no se edita; estos tipos solo describen su superficie pública.
export type Sexo = 'M' | 'F' | 'Masculino' | 'Femenino';
export interface Clase { l: string; c: string; k?: number; risk?: string; }
export interface DXResult { n: string; dx?: string; name?: string; [k: string]: unknown; }

export function calcIFC(C: number, Rinf: number): number;
export function calcIRC(Re: number, Ri: number, C: number): number;
export function calcPABU(Re: number, Ri: number, Rinf: number, C: number, sexo: Sexo): number;

export function cIFC(v: number, sexo: Sexo): Clase & { k: number };
export function cIRC(v: number, sexo: Sexo): Clase & { k: number };
export function cPABU(v: number, ifc: number): Clase;
export function cFMI(v: number, s: Sexo): Clase & { k: number };
export function cFFMI(v: number, s: Sexo): Clase & { k: number };
export function cISCM(v: number): Clase;
export function cIEHH(v: number): Clase;
export function cIAE(v: number): Clase;

export function kl(k: number | string): string;
export function getDX(ifcK: number, ircK: number, ffmiK: number, fmiK: number): DXResult;
export function efrCompose(i: string, r: string, f: string, m: string): DXResult;
export const DX: Record<string, DXResult>;
export const FYR_LABELS: Record<string, Clase>;
export const STRUCT_LABELS: Record<string, string>;
