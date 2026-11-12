// Declaraciones de tipos para engine.indices.js (CONGELADO, verbatim del prototipo de
// Gildardo). Describen SOLO la superficie publica que consume el adaptador; el `.js` no
// se edita ni se convierte a TS (excepcion nombrada a la regla 12, ARCHITECTURE.md).

export function computeISCM(bis: Record<string, unknown>): number;
export function computeIEHH(bis: {
  Re: number;
  Rinf: number;
  C: number;
  FFW: number;
}): number;
export function computeEBBIS(
  ifc: number,
  pabu: number,
  icec: number | null,
): number | null;
export function computeIAE(eb: number | null, edad: number | null): number | null;

export const RUTA_COND: Record<
  string,
  (d: Record<string, unknown>, dominios?: Array<{ nivel: string }>) => boolean
>;
export function rutasPorCondicion(
  d: Record<string, unknown>,
  dominios?: Array<{ nivel: string }>,
): string[];

// ═══ EL IEHH Y EL ISCM-BIS DE LA v17 §5 (2026-11-12) ═══
//
// Los dos salen de UNA llamada: comparten cinco de los siete componentes y la misma tabla de
// referencias por sexo (`IEHH_ISCM_REF`, media y DE de cada componente en los 5.255 adultos de su base
// consolidada). `computeISCM` y `computeIEHH` (arriba) son las de la v16, con z GLOBALES: se conservan
// porque son su codigo y porque son la unica forma de releer un valor sellado antes del bump, pero ya
// no las llama nadie.
//
// DEVUELVE 0 COMO AUSENCIA, no como cero medido: sin sexo o sin alguno de los componentes, el indice no
// se emite. Quien llame tiene que decidir que hace con ese 0 (en `analizarDesdeBiody` se vuelve null).
export const IEHH_ISCM_REF: Record<
  "F" | "M",
  Record<"ReRinf" | "AECAICsg" | "C" | "IFC" | "MCA" | "FMI" | "FFW", [number, number]>
>;
export function calcIEHH_ISCM(componentes: {
  sexo: string | null | undefined;
  Re: number | null;
  Rinf: number | null;
  C: number | null;
  MCA: number | null;
  AECsg: number | null;
  AICsg: number | null;
  FMI: number | null;
  FFW: number | null;
}): { iehh: number; iscm: number };
