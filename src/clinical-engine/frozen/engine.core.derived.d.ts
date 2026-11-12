// Tipos del archivo derivado (engine.core.derived.js, generado). Re-exporta toda la superficie del
// original (engine.core.d.ts) y agrega los nombres que el mecanismo de archivo derivado expone.
// El .js no se edita; estos tipos solo describen su superficie publica.
export * from "./engine.core.js";
import type { Clase, Sexo, SexoOpcional } from "./engine.core.js";

// Abordaje por profesion del rol logueado (6ª card del estado EFR). role: substring del rol
// ("med"/"psic"/"entr"|"deport"|"ejerc", resto -> nutricionista). i/r/f/m: letras de banda del EFR.
export function efrProf(role: string, i: string, r: string, f: string, m: string): string;

// Clasificadores de composicion (columna de diagnostico de la tabla de composicion).
export function cSMM(v: number, s: Sexo): Clase;
export function cMMEM(v: number, s: Sexo): Clase;
export function cASMI(v: number, s: Sexo): Clase;
export function cFFW(v: number): Clase;
export function cEISG(v: number): Clase;

// ═══ EL BLOQUE MCCB DE LA v17 §2.4 (su Tabla 10.2 y su Tabla 11.2) ═══
//
// Gobiernan EL SECTOR de la Diana, el fenotipo del sector y la gravedad base del dominio 2. `cFFMI` y
// `cFMI` (arriba, en engine.core.d.ts) se quedan SOLO con sus banderas clinicas: literal de su
// archivo, *"cFFMI y cFMI quedan solo para sus banderas clinicas (sospecha de anabolizantes), no para
// fenotipar"*.
//
// SIN SEXO, O SIN VALOR, DEVUELVEN k = 0 y `sectorMCCB` devuelve null. No es un hueco: es su manera de
// decir que sin sexo no hay sector, igual que `cIFC` dice "Sin sexo: no se clasifica". Quien los llame
// tiene que decidir que hace con el 0; en Atlas se conserva la banda anterior (su linea 7912).
export const MCCB_CORTES: Record<"F" | "M", { fmi: [number, number]; ffmi: [number, number] }>;
export function cFFMI_MCCB(v: number, sexo: SexoOpcional): { l: string; k: number };
export function cFMI_MCCB(v: number, sexo: SexoOpcional): { l: string; k: number };

/** Un sector del libro (Tabla 11.2): su codigo S1-S9, sus dos bandas, su fenotipo y la gravedad
 *  BASE que aporta al dominio metabolico-estructural (decision suya del 7-nov-2026). */
export type SectorMCCB = { id: string; fn: number; fm: number; fen: string; g: number };
export const MCCB_SECTORES: readonly SectorMCCB[];
export function sectorMCCB(ffmi: number, fmi: number, sexo: SexoOpcional): SectorMCCB | null;

// ═══ LOS CORTES DE LAS ALERTAS CRITICAS (v17 §2.9) ═══
//
// La cola extrema de su distribucion de referencia: el P10 del IFC y el P90 del IRC de cada sexo.
// Reemplazan los umbrales unicos de su v16 (IFC < 2,0 · IRC > 5,0), que su §14 prohibe conservar.
export const ALERTA_CRITICA_REF: Record<"F" | "M", { ifcP10: number; ircP90: number }>;
/** El rango habitual del ICA-BIS de ese sexo, en texto ("−0,27 a 0,36 (H)"). */
export function icaBisRefTxt(sexo: SexoOpcional): string;
