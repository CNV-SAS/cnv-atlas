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
