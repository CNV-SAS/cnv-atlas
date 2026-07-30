// Tipos del archivo derivado (engine.core.derived.js, generado). Re-exporta toda la superficie del
// original (engine.core.d.ts) y agrega las 6 funciones que el mecanismo de archivo derivado expone.
// El .js no se edita; estos tipos solo describen su superficie publica.
export * from "./engine.core.js";
import type { Clase, Sexo } from "./engine.core.js";

// Abordaje por profesion del rol logueado (6ª card del estado EFR). role: substring del rol
// ("med"/"psic"/"entr"|"deport"|"ejerc", resto -> nutricionista). i/r/f/m: letras de banda del EFR.
export function efrProf(role: string, i: string, r: string, f: string, m: string): string;

// Clasificadores de composicion (columna de diagnostico de la tabla de composicion).
export function cSMM(v: number, s: Sexo): Clase;
export function cMMEM(v: number, s: Sexo): Clase;
export function cASMI(v: number, s: Sexo): Clase;
export function cFFW(v: number): Clase;
export function cEISG(v: number): Clase;
