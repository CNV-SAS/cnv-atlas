// Tipos para frozen/engine.dfi.authorized.js (el GENERADO, el que corre). Igual que el original salvo
// UN cambio: la guarda de calcLE8 (CA-3, Gildardo 2026-08-13 §1) devuelve `total: null` cuando falta
// algun insumo del LE8, asi que aqui LE8Result.total es `number | null` (el original lo tipa `number`).
// Los consumidores ya lo tratan como anulable (analysis.ts, engine.ts). DFIDomain/DFIResult no cambian:
// se reexportan del original. Solo para tsc; el .js no se edita.
import type { DFIDomain, DFIResult } from "./engine.dfi";

export type { DFIDomain, DFIResult };

export interface LE8Result {
  scores: Array<{ dom: string; v: number }>;
  total: number | null;
}

export function calcLE8(enc: Record<string, unknown>): LE8Result;
export function computeDFI(args: Record<string, unknown>): DFIResult | null;
export function computeDFIFromData(
  enc: Record<string, unknown>,
  bis: Record<string, unknown>,
): DFIResult | null;
